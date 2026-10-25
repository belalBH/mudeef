'use server';

import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { db } from './db';
import { createSession, destroySession, logActivity, requireUser } from './auth';
import { findOverlaps, linkGuest, recomputePaid, refreshConflicts, syncCleaningTask } from './bookings';
import { syncChannel, syncAll } from './ical';
import { CHANNEL_SOURCES, PAYMENT_METHODS, SOURCES, STAY_STATUSES, UNIT_TYPES } from './constants';
import { diffDays, todayISO } from './dates';

const token = () => crypto.randomBytes(18).toString('base64url');
const str = (fd, k) => String(fd.get(k) ?? '').trim();
const numOr = (fd, k, d = 0) => {
  const v = parseFloat(str(fd, k));
  return Number.isFinite(v) ? v : d;
};
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);
// React resets a form after its action runs; sending the values back lets the form refill on error
const fail = (fd, error, extra = {}) => {
  const values = {};
  for (const [k, v] of fd.entries()) if (k !== 'password' && !k.startsWith('$')) values[k] = String(v);
  return { error, values, ...extra };
};

/* ---------- Auth ---------- */

export async function signup(prev, fd) {
  const name = str(fd, 'name');
  const business = str(fd, 'business');
  const email = str(fd, 'email').toLowerCase();
  const password = str(fd, 'password');
  if (!name || !email || !password) return fail(fd, 'أكمل الاسم والبريد وكلمة المرور.');
  if (!/^\S+@\S+\.\S+$/.test(email)) return fail(fd, 'صيغة البريد الإلكتروني غير صحيحة.');
  if (password.length < 8) return fail(fd, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل.');
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) {
    return fail(fd, 'هذا البريد مسجّل مسبقاً. سجّل الدخول بدلاً من ذلك.');
  }
  const hash = await bcrypt.hash(password, 10);
  const user = db.transaction(() => {
    const acc = db.prepare('INSERT INTO accounts (name) VALUES (?)').run(business || name);
    const u = db
      .prepare('INSERT INTO users (account_id, name, email, password_hash) VALUES (?, ?, ?, ?)')
      .run(acc.lastInsertRowid, name, email, hash);
    return { id: Number(u.lastInsertRowid), account_id: Number(acc.lastInsertRowid) };
  })();
  await createSession(user);
  redirect('/units/new?welcome=1');
}

export async function login(prev, fd) {
  const email = str(fd, 'email').toLowerCase();
  const password = str(fd, 'password');
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return fail(fd, 'البريد أو كلمة المرور غير صحيحة.');
  }
  if (!user.active) return fail(fd, 'هذا الحساب موقوف. تواصل مع مالك النشاط.');
  await createSession(user);
  redirect(user.role === 'cleaner' ? '/tasks' : '/dashboard');
}

export async function logout() {
  await destroySession();
  redirect('/login');
}

/* ---------- Units ---------- */

const UNIT_COLS = [
  'name', 'type', 'city', 'capacity', 'base_price', 'weekend_price', 'notes', 'checkin_info',
  'description', 'amenities', 'house_rules', 'map_url', 'wifi_name', 'wifi_password', 'bedrooms', 'owner_id', 'public',
];

function unitFields(fd, accountId) {
  const type = str(fd, 'type');
  const ownerId = Number(str(fd, 'owner_id')) || null;
  const mapUrl = str(fd, 'map_url');
  return {
    name: str(fd, 'name'),
    type: UNIT_TYPES[type] ? type : 'studio',
    city: str(fd, 'city') || null,
    capacity: Math.max(1, Math.round(numOr(fd, 'capacity', 2))),
    base_price: Math.max(0, numOr(fd, 'base_price')),
    weekend_price: str(fd, 'weekend_price') ? Math.max(0, numOr(fd, 'weekend_price')) : null,
    notes: str(fd, 'notes') || null,
    checkin_info: str(fd, 'checkin_info') || null,
    description: str(fd, 'description') || null,
    amenities: str(fd, 'amenities') || null,
    house_rules: str(fd, 'house_rules') || null,
    map_url: /^https?:\/\//.test(mapUrl) ? mapUrl : null,
    wifi_name: str(fd, 'wifi_name') || null,
    wifi_password: str(fd, 'wifi_password') || null,
    bedrooms: str(fd, 'bedrooms') ? Math.max(0, Math.round(numOr(fd, 'bedrooms'))) : null,
    owner_id: ownerId && db.prepare('SELECT 1 FROM owners WHERE id = ? AND account_id = ?').get(ownerId, accountId) ? ownerId : null,
    public: fd.get('public') ? 1 : 0,
  };
}

export async function saveUnit(prev, fd) {
  const user = await requireUser();
  const f = unitFields(fd, user.account_id);
  if (!f.name) return fail(fd, 'اكتب اسم الوحدة.');
  if (str(fd, 'map_url') && !f.map_url) return fail(fd, 'رابط الموقع يجب أن يبدأ بـ https، انسخه من خرائط Google.');
  const id = Number(str(fd, 'id')) || 0;
  const vals = UNIT_COLS.map((c) => f[c]);
  let unitId = id;
  if (id) {
    const r = db
      .prepare(`UPDATE units SET ${UNIT_COLS.map((c) => `${c}=?`).join(', ')}, active=? WHERE id=? AND account_id=?`)
      .run(...vals, fd.get('active') ? 1 : 0, id, user.account_id);
    if (!r.changes) return fail(fd, 'الوحدة غير موجودة.');
    logActivity(user, `عدّل بيانات الوحدة ${f.name}`);
  } else {
    const r = db
      .prepare(`INSERT INTO units (account_id, ${UNIT_COLS.join(', ')}, export_token) VALUES (?, ${UNIT_COLS.map(() => '?').join(', ')}, ?)`)
      .run(user.account_id, ...vals, token());
    unitId = Number(r.lastInsertRowid);
    logActivity(user, `أضاف الوحدة ${f.name}`);
  }
  revalidatePath('/', 'layout');
  redirect(`/units/${unitId}${id ? '?saved=1' : '?created=1'}`);
}

export async function deleteUnit(fd) {
  const user = await requireUser();
  const u = db.prepare('SELECT name FROM units WHERE id = ? AND account_id = ?').get(Number(fd.get('id')), user.account_id);
  db.prepare('DELETE FROM units WHERE id = ? AND account_id = ?').run(Number(fd.get('id')), user.account_id);
  if (u) logActivity(user, `حذف الوحدة ${u.name}`);
  revalidatePath('/', 'layout');
  redirect('/units');
}

/* ---------- Channels (iCal) ---------- */

function validFeedUrl(u) {
  try {
    const url = new URL(u);
    if (!['http:', 'https:'].includes(url.protocol)) return false;
    const h = url.hostname;
    // Keep the server from being pointed at itself or the local network
    if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|\[?::1\]?$)/i.test(h)) return false;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return false;
    return true;
  } catch {
    return false;
  }
}

export async function saveChannel(prev, fd) {
  const user = await requireUser();
  const unitId = Number(str(fd, 'unit_id'));
  const source = str(fd, 'source');
  const importUrl = str(fd, 'import_url');
  const rate = Math.min(100, Math.max(0, numOr(fd, 'commission_rate')));
  const unit = db.prepare('SELECT id FROM units WHERE id = ? AND account_id = ?').get(unitId, user.account_id);
  if (!unit) return fail(fd, 'الوحدة غير موجودة.');
  if (!CHANNEL_SOURCES.includes(source)) return fail(fd, 'اختر المنصة.');
  if (importUrl && !validFeedUrl(importUrl)) return fail(fd, 'رابط التقويم غير صالح. انسخه كما هو من المنصة (يبدأ بـ https).');

  const existing = db.prepare('SELECT id FROM channels WHERE unit_id = ? AND source = ?').get(unitId, source);
  let channelId;
  if (existing) {
    db.prepare('UPDATE channels SET import_url = ?, commission_rate = ? WHERE id = ?').run(importUrl || null, rate, existing.id);
    channelId = existing.id;
  } else {
    const r = db
      .prepare(
        'INSERT INTO channels (account_id, unit_id, source, import_url, export_token, commission_rate) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(user.account_id, unitId, source, importUrl || null, token(), rate);
    channelId = Number(r.lastInsertRowid);
  }
  let result = null;
  if (importUrl) result = await syncChannel(channelId);
  revalidatePath('/', 'layout');
  return {
    ok: true,
    message: result ? (result.ok ? `تم الربط والمزامنة: ${result.message}` : `تم الحفظ لكن فشلت المزامنة: ${result.message}`) : 'تم الحفظ.',
  };
}

export async function deleteChannel(fd) {
  const user = await requireUser();
  const id = Number(fd.get('id'));
  const ch = db.prepare('SELECT unit_id FROM channels WHERE id = ? AND account_id = ?').get(id, user.account_id);
  if (!ch) return;
  db.transaction(() => {
    // Upcoming imported stays only existed because of this link
    db.prepare(`DELETE FROM bookings WHERE channel_id = ? AND imported = 1 AND total_amount = 0`).run(id);
    db.prepare('DELETE FROM channels WHERE id = ?').run(id);
  })();
  refreshConflicts(ch.unit_id);
  revalidatePath('/', 'layout');
}

export async function syncNow(fd) {
  const user = await requireUser();
  const id = Number(fd.get('id'));
  if (id) {
    const ch = db.prepare('SELECT id FROM channels WHERE id = ? AND account_id = ?').get(id, user.account_id);
    if (ch) await syncChannel(ch.id);
  } else {
    await syncAll(user.account_id);
  }
  revalidatePath('/', 'layout');
}

/* ---------- Bookings ---------- */

function ownBooking(accountId, id) {
  return db.prepare('SELECT * FROM bookings WHERE id = ? AND account_id = ?').get(id, accountId);
}

function afterBookingChange(b, oldUnit = null) {
  refreshConflicts(b.unit_id);
  if (oldUnit && oldUnit !== b.unit_id) refreshConflicts(oldUnit);
  syncCleaningTask(b.id);
  revalidatePath('/', 'layout');
}

export async function saveBooking(prev, fd) {
  const user = await requireUser();
  const id = Number(str(fd, 'id')) || 0;
  const unitId = Number(str(fd, 'unit_id'));
  const checkIn = str(fd, 'check_in');
  const checkOut = str(fd, 'check_out');
  const rawSource = str(fd, 'source');
  const source = SOURCES[rawSource] || rawSource === 'block' ? rawSource : 'direct';
  const block = source === 'block';
  const unit = db.prepare('SELECT id FROM units WHERE id = ? AND account_id = ?').get(unitId, user.account_id);
  const existing = id ? ownBooking(user.account_id, id) : null;

  if (id && !existing) return fail(fd, 'الحجز غير موجود.');
  if (!unit) return fail(fd, 'اختر الوحدة.');
  if (!isDate(checkIn) || !isDate(checkOut)) return fail(fd, 'حدد تاريخ الدخول والخروج.');
  if (diffDays(checkIn, checkOut) < 1) return fail(fd, 'تاريخ الخروج يجب أن يكون بعد تاريخ الدخول بليلة على الأقل.');

  const status = existing ? existing.status : 'confirmed';
  if (status === 'confirmed' && !fd.get('force')) {
    const clash = findOverlaps(unitId, checkIn, checkOut, id);
    if (clash.length) {
      const c = clash[0];
      const who = c.source === 'block' ? 'إغلاق' : c.guest_name || 'حجز';
      return fail(fd, `الوحدة محجوزة في هذه الفترة (${who} من ${c.check_in} إلى ${c.check_out}). غيّر التواريخ أو فعّل "حفظ رغم التعارض".`, { clash: true });
    }
  }

  const guestName = block ? null : str(fd, 'guest_name') || null;
  const guestPhone = block ? null : str(fd, 'guest_phone') || null;
  const total = block ? 0 : Math.max(0, numOr(fd, 'total_amount'));
  let commission = block ? 0 : Math.max(0, numOr(fd, 'commission'));
  if (!block && !str(fd, 'commission') && source !== 'direct') {
    const ch = db.prepare('SELECT commission_rate FROM channels WHERE unit_id = ? AND source = ?').get(unitId, source);
    if (ch) commission = Math.round(total * ch.commission_rate) / 100;
  }
  const guestId = block ? null : linkGuest(user.account_id, guestName, guestPhone);
  if (guestId && !id) {
    const g = db.prepare('SELECT blacklisted, notes FROM guests WHERE id = ?').get(guestId);
    if (g?.blacklisted && !fd.get('force_guest')) {
      return fail(fd, `هذا الضيف في قائمة الحظر${g.notes ? ': ' + g.notes : ''}. فعّل "تجاهل الحظر" إذا تبي تكمل.`, { blacklisted: true });
    }
  }

  const vals = [
    unitId, source, guestName, guestPhone, guestId,
    Math.max(1, Math.round(numOr(fd, 'guests', 1))),
    checkIn, checkOut, total, commission,
    str(fd, 'notes') || null,
  ];

  let bookingId = id;
  if (existing) {
    db.prepare(
      `UPDATE bookings SET unit_id=?, source=?, guest_name=?, guest_phone=?, guest_id=?, guests=?, check_in=?, check_out=?,
        total_amount=?, commission=?, notes=?, updated_at=datetime('now') WHERE id=? AND account_id=?`
    ).run(...vals, id, user.account_id);
  } else {
    const r = db
      .prepare(
        `INSERT INTO bookings (unit_id, source, guest_name, guest_phone, guest_id, guests, check_in, check_out,
          total_amount, commission, notes, account_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
      )
      .run(...vals, user.account_id);
    bookingId = Number(r.lastInsertRowid);
    const deposit = Math.max(0, numOr(fd, 'deposit'));
    if (deposit > 0 && !block) {
      db.prepare(`INSERT INTO payments (account_id, booking_id, amount, method, paid_on, note) VALUES (?,?,?,?,?,?)`).run(
        user.account_id, bookingId, deposit, PAYMENT_METHODS[str(fd, 'deposit_method')] ? str(fd, 'deposit_method') : 'cash', todayISO(), 'عربون عند الحجز'
      );
      recomputePaid(bookingId);
    }
  }
  afterBookingChange({ id: bookingId, unit_id: unitId }, existing?.unit_id);
  logActivity(
    user,
    block
      ? `${existing ? 'عدّل' : 'أغلق'} تواريخ ${checkIn} إلى ${checkOut}`
      : `${existing ? 'عدّل حجز' : 'سجّل حجزاً جديداً لـ'} ${guestName || 'ضيف'} (${checkIn} إلى ${checkOut})`,
    bookingId
  );
  redirect(block ? `/units/${unitId}?blocked=1` : `/bookings/${bookingId}?saved=1`);
}

export async function deleteBooking(fd) {
  const user = await requireUser();
  const id = Number(fd.get('id'));
  const b = ownBooking(user.account_id, id);
  if (b) {
    db.prepare('DELETE FROM bookings WHERE id = ?').run(id);
    refreshConflicts(b.unit_id);
    logActivity(user, b.source === 'block' ? `فتح تواريخ مغلقة ${b.check_in} إلى ${b.check_out}` : `حذف حجز ${b.guest_name || ''} (${b.check_in})`);
  }
  revalidatePath('/', 'layout');
  redirect(b?.source === 'block' ? `/units/${b.unit_id}` : '/bookings');
}

export async function setStayStatus(fd) {
  const user = await requireUser();
  const b = ownBooking(user.account_id, Number(fd.get('id')));
  const to = str(fd, 'to');
  if (!b || !STAY_STATUSES[to]) return;
  const stamp = { checked_in: 'checked_in_at', checked_out: 'checked_out_at' }[to];
  db.prepare(`UPDATE bookings SET stay_status = ?, updated_at = datetime('now') ${stamp ? `, ${stamp} = datetime('now')` : ''} WHERE id = ?`).run(to, b.id);
  // Guest left early: free the remaining nights and move the cleaning to today
  if (to === 'checked_out' && fd.get('early') && b.check_out > todayISO() && b.check_in < todayISO()) {
    db.prepare('UPDATE bookings SET check_out = ? WHERE id = ?').run(todayISO(), b.id);
  }
  afterBookingChange(b);
  logActivity(user, `${STAY_STATUSES[to]}: ${b.guest_name || 'ضيف'}`, b.id);
}

export async function cancelBooking(fd) {
  const user = await requireUser();
  const b = ownBooking(user.account_id, Number(fd.get('id')));
  if (!b) return;
  db.prepare(`UPDATE bookings SET status = 'cancelled', cancel_reason = ?, updated_at = datetime('now') WHERE id = ?`).run(
    str(fd, 'reason') || null, b.id
  );
  afterBookingChange(b);
  logActivity(user, `ألغى حجز ${b.guest_name || 'ضيف'}${str(fd, 'reason') ? ': ' + str(fd, 'reason') : ''}`, b.id);
}

export async function restoreBooking(fd) {
  const user = await requireUser();
  const b = ownBooking(user.account_id, Number(fd.get('id')));
  if (!b) return;
  db.prepare(`UPDATE bookings SET status = 'confirmed', cancel_reason = NULL, updated_at = datetime('now') WHERE id = ?`).run(b.id);
  afterBookingChange(b);
  logActivity(user, `استعاد حجز ${b.guest_name || 'ضيف'}`, b.id);
}

export async function addPayment(prev, fd) {
  const user = await requireUser();
  const b = ownBooking(user.account_id, Number(str(fd, 'booking_id')));
  if (!b) return fail(fd, 'الحجز غير موجود.');
  const amount = numOr(fd, 'amount');
  if (!(amount > 0)) return fail(fd, 'اكتب مبلغاً أكبر من صفر.');
  const method = PAYMENT_METHODS[str(fd, 'method')] ? str(fd, 'method') : 'cash';
  const on = isDate(str(fd, 'paid_on')) ? str(fd, 'paid_on') : todayISO();
  const refund = fd.get('refund') ? -1 : 1;
  db.prepare(`INSERT INTO payments (account_id, booking_id, amount, method, paid_on, note) VALUES (?,?,?,?,?,?)`).run(
    user.account_id, b.id, amount * refund, method, on, str(fd, 'note') || (refund < 0 ? 'استرجاع' : null)
  );
  recomputePaid(b.id);
  logActivity(user, `${refund < 0 ? 'سجّل استرجاع' : 'سجّل دفعة'} ${amount} ر.س (${PAYMENT_METHODS[method]}) لـ ${b.guest_name || 'ضيف'}`, b.id);
  revalidatePath('/', 'layout');
  return { ok: true, message: refund < 0 ? 'تم تسجيل الاسترجاع.' : 'تم تسجيل الدفعة.' };
}

export async function deletePayment(fd) {
  const user = await requireUser();
  const p = db.prepare('SELECT booking_id, amount FROM payments WHERE id = ? AND account_id = ?').get(Number(fd.get('id')), user.account_id);
  if (!p) return;
  db.prepare('DELETE FROM payments WHERE id = ?').run(Number(fd.get('id')));
  recomputePaid(p.booking_id);
  logActivity(user, `حذف دفعة ${p.amount} ر.س`, p.booking_id);
  revalidatePath('/', 'layout');
}
