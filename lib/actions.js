'use server';

import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { db } from './db';
import { createSession, destroySession, requireUser } from './auth';
import { findOverlaps, refreshConflicts } from './bookings';
import { syncChannel, syncAll } from './ical';
import { CHANNEL_SOURCES, SOURCES, UNIT_TYPES } from './constants';
import { diffDays } from './dates';

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
  await createSession(user);
  redirect('/dashboard');
}

export async function logout() {
  await destroySession();
  redirect('/login');
}

/* ---------- Units ---------- */

function unitFields(fd) {
  const type = str(fd, 'type');
  return {
    name: str(fd, 'name'),
    type: UNIT_TYPES[type] ? type : 'studio',
    city: str(fd, 'city') || null,
    capacity: Math.max(1, Math.round(numOr(fd, 'capacity', 2))),
    base_price: Math.max(0, numOr(fd, 'base_price')),
    weekend_price: str(fd, 'weekend_price') ? Math.max(0, numOr(fd, 'weekend_price')) : null,
    notes: str(fd, 'notes') || null,
  };
}

export async function saveUnit(prev, fd) {
  const user = await requireUser();
  const f = unitFields(fd);
  if (!f.name) return fail(fd, 'اكتب اسم الوحدة.');
  const id = Number(str(fd, 'id')) || 0;
  let unitId = id;
  if (id) {
    const r = db
      .prepare(
        `UPDATE units SET name=?, type=?, city=?, capacity=?, base_price=?, weekend_price=?, notes=?, active=?
         WHERE id=? AND account_id=?`
      )
      .run(f.name, f.type, f.city, f.capacity, f.base_price, f.weekend_price, f.notes, fd.get('active') ? 1 : 0, id, user.account_id);
    if (!r.changes) return fail(fd, 'الوحدة غير موجودة.');
  } else {
    const r = db
      .prepare(
        `INSERT INTO units (account_id, name, type, city, capacity, base_price, weekend_price, notes, export_token)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(user.account_id, f.name, f.type, f.city, f.capacity, f.base_price, f.weekend_price, f.notes, token());
    unitId = Number(r.lastInsertRowid);
  }
  revalidatePath('/', 'layout');
  redirect(`/units/${unitId}${id ? '?saved=1' : '?created=1'}`);
}

export async function deleteUnit(fd) {
  const user = await requireUser();
  db.prepare('DELETE FROM units WHERE id = ? AND account_id = ?').run(Number(fd.get('id')), user.account_id);
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

export async function saveBooking(prev, fd) {
  const user = await requireUser();
  const id = Number(str(fd, 'id')) || 0;
  const unitId = Number(str(fd, 'unit_id'));
  const checkIn = str(fd, 'check_in');
  const checkOut = str(fd, 'check_out');
  const source = SOURCES[str(fd, 'source')] ? str(fd, 'source') : 'direct';
  const status = str(fd, 'status') === 'cancelled' ? 'cancelled' : 'confirmed';
  const unit = db.prepare('SELECT id FROM units WHERE id = ? AND account_id = ?').get(unitId, user.account_id);

  if (!unit) return fail(fd, 'اختر الوحدة.');
  if (!isDate(checkIn) || !isDate(checkOut)) return fail(fd, 'حدد تاريخ الدخول والخروج.');
  if (diffDays(checkIn, checkOut) < 1) return fail(fd, 'تاريخ الخروج يجب أن يكون بعد تاريخ الدخول بليلة على الأقل.');

  if (status === 'confirmed' && !fd.get('force')) {
    const clash = findOverlaps(unitId, checkIn, checkOut, id);
    if (clash.length) {
      const c = clash[0];
      return fail(fd, `الوحدة محجوزة في هذه الفترة (${c.guest_name || 'حجز'} من ${c.check_in} إلى ${c.check_out}). غيّر التواريخ أو فعّل "حفظ رغم التعارض".`, { clash: true });
    }
  }

  const total = Math.max(0, numOr(fd, 'total_amount'));
  let commission = Math.max(0, numOr(fd, 'commission'));
  if (!str(fd, 'commission') && source !== 'direct') {
    const ch = db.prepare('SELECT commission_rate FROM channels WHERE unit_id = ? AND source = ?').get(unitId, source);
    if (ch) commission = Math.round(total * ch.commission_rate) / 100;
  }

  const vals = [
    unitId,
    source,
    status,
    str(fd, 'guest_name') || null,
    str(fd, 'guest_phone') || null,
    Math.max(1, Math.round(numOr(fd, 'guests', 1))),
    checkIn,
    checkOut,
    total,
    commission,
    Math.max(0, numOr(fd, 'paid_amount')),
    str(fd, 'notes') || null,
  ];

  let bookingId = id;
  let oldUnit = null;
  if (id) {
    const old = db.prepare('SELECT unit_id FROM bookings WHERE id = ? AND account_id = ?').get(id, user.account_id);
    if (!old) return fail(fd, 'الحجز غير موجود.');
    oldUnit = old.unit_id;
    db.prepare(
      `UPDATE bookings SET unit_id=?, source=?, status=?, guest_name=?, guest_phone=?, guests=?, check_in=?, check_out=?,
        total_amount=?, commission=?, paid_amount=?, notes=?, updated_at=datetime('now') WHERE id=? AND account_id=?`
    ).run(...vals, id, user.account_id);
  } else {
    const r = db
      .prepare(
        `INSERT INTO bookings (unit_id, source, status, guest_name, guest_phone, guests, check_in, check_out,
          total_amount, commission, paid_amount, notes, account_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
      )
      .run(...vals, user.account_id);
    bookingId = Number(r.lastInsertRowid);
  }
  refreshConflicts(unitId);
  if (oldUnit && oldUnit !== unitId) refreshConflicts(oldUnit);
  revalidatePath('/', 'layout');
  redirect(`/bookings/${bookingId}?saved=1`);
}

export async function deleteBooking(fd) {
  const user = await requireUser();
  const id = Number(fd.get('id'));
  const b = db.prepare('SELECT unit_id FROM bookings WHERE id = ? AND account_id = ?').get(id, user.account_id);
  if (b) {
    db.prepare('DELETE FROM bookings WHERE id = ?').run(id);
    refreshConflicts(b.unit_id);
  }
  revalidatePath('/', 'layout');
  redirect('/bookings');
}
