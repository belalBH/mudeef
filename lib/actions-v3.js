'use server';

import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { db } from './db';
import { logActivity, requireUser, ROLES } from './auth';
import { findOverlaps, linkGuest, recomputePaid, refreshConflicts, seasonRates, syncCleaningTask } from './bookings';
import { EXPENSE_CATEGORIES, ID_TYPES, ITEM_KINDS } from './constants';
import { addDays, diffDays, todayISO } from './dates';
import { quote } from './pricing';
import { UPLOAD_DIR } from './files';

const str = (fd, k) => String(fd.get(k) ?? '').trim();
const numOr = (fd, k, d = 0) => {
  const v = parseFloat(str(fd, k));
  return Number.isFinite(v) ? v : d;
};
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const fail = (fd, error, extra = {}) => {
  const values = {};
  for (const [k, v] of fd.entries()) if (!/password|photos/.test(k) && !k.startsWith('$')) values[k] = String(v);
  return { error, values, ...extra };
};
const done = (message, extra = {}) => {
  revalidatePath('/', 'layout');
  return { ok: true, message, ...extra };
};
const ownBooking = (accountId, id) => db.prepare('SELECT * FROM bookings WHERE id = ? AND account_id = ?').get(id, accountId);
const round2 = (n) => Math.round(n * 100) / 100;

/* ---------- Team ---------- */

export async function addMember(prev, fd) {
  const user = await requireUser(['owner']);
  const name = str(fd, 'name');
  const email = str(fd, 'email').toLowerCase();
  const password = String(fd.get('password') || '');
  const role = ROLES[str(fd, 'role')] ? str(fd, 'role') : 'cleaner';
  if (!name) return fail(fd, 'اكتب اسم عضو الفريق.');
  if (!/^\S+@\S+\.\S+$/.test(email)) return fail(fd, 'صيغة البريد الإلكتروني غير صحيحة. البريد هو اسم الدخول.');
  if (password.length < 8) return fail(fd, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل.');
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) return fail(fd, 'هذا البريد مسجّل في حساب آخر.');
  db.prepare('INSERT INTO users (account_id, name, email, password_hash, role, phone) VALUES (?,?,?,?,?,?)').run(
    user.account_id, name, email, await bcrypt.hash(password, 10), role, str(fd, 'phone') || null
  );
  logActivity(user, `أضاف ${name} للفريق بصلاحية ${ROLES[role]}`);
  return done(`تمت إضافة ${name}. أرسل له البريد وكلمة المرور ليدخل.`);
}

export async function updateMember(fd) {
  const user = await requireUser(['owner']);
  const id = Number(fd.get('id'));
  const m = db.prepare('SELECT * FROM users WHERE id = ? AND account_id = ?').get(id, user.account_id);
  if (!m || m.id === user.id) return; // owners cannot lock themselves out
  const role = ROLES[str(fd, 'role')] ? str(fd, 'role') : m.role;
  const active = fd.has('active') ? (str(fd, 'active') === '1' ? 1 : 0) : m.active;
  db.prepare('UPDATE users SET role = ?, active = ? WHERE id = ?').run(role, active, m.id);
  logActivity(user, active ? `غيّر صلاحية ${m.name} إلى ${ROLES[role]}` : `أوقف حساب ${m.name}`);
  revalidatePath('/', 'layout');
}

export async function resetMemberPassword(prev, fd) {
  const user = await requireUser(['owner']);
  const m = db.prepare('SELECT * FROM users WHERE id = ? AND account_id = ?').get(Number(fd.get('id')), user.account_id);
  const password = String(fd.get('password') || '');
  if (!m) return { error: 'العضو غير موجود.' };
  if (password.length < 8) return { error: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل.' };
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(await bcrypt.hash(password, 10), m.id);
  logActivity(user, `غيّر كلمة مرور ${m.name}`);
  return { ok: true, message: `تم تغيير كلمة مرور ${m.name}.` };
}

/* ---------- Unit photos ---------- */

const IMG_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

export async function uploadPhotos(prev, fd) {
  const user = await requireUser();
  const unitId = Number(fd.get('unit_id'));
  if (!db.prepare('SELECT 1 FROM units WHERE id = ? AND account_id = ?').get(unitId, user.account_id)) return { error: 'الوحدة غير موجودة.' };
  const files = fd.getAll('photos').filter((f) => f && typeof f === 'object' && f.size > 0);
  if (!files.length) return { error: 'اختر صورة واحدة على الأقل.' };
  const count = db.prepare('SELECT COUNT(*) n FROM unit_photos WHERE unit_id = ?').get(unitId).n;
  if (count + files.length > 20) return { error: 'الحد الأقصى 20 صورة لكل وحدة.' };
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  let saved = 0;
  for (const f of files) {
    const ext = IMG_TYPES[f.type];
    if (!ext) return { error: `الملف ${f.name} ليس صورة JPG أو PNG أو WebP.` };
    if (f.size > 6 * 1024 * 1024) return { error: `الصورة ${f.name} أكبر من 6 ميجا.` };
    const name = `${crypto.randomBytes(12).toString('hex')}.${ext}`;
    fs.writeFileSync(path.join(UPLOAD_DIR, name), Buffer.from(await f.arrayBuffer()));
    db.prepare('INSERT INTO unit_photos (account_id, unit_id, file, sort) VALUES (?,?,?,?)').run(user.account_id, unitId, name, count + saved);
    saved++;
  }
  return done(saved === 1 ? 'تم رفع الصورة.' : `تم رفع ${saved} صور.`);
}

export async function deletePhoto(fd) {
  const user = await requireUser();
  const p = db.prepare('SELECT * FROM unit_photos WHERE id = ? AND account_id = ?').get(Number(fd.get('id')), user.account_id);
  if (!p) return;
  db.prepare('DELETE FROM unit_photos WHERE id = ?').run(p.id);
  try {
    fs.unlinkSync(path.join(UPLOAD_DIR, p.file));
  } catch {}
  revalidatePath('/', 'layout');
}

export async function makeCover(fd) {
  const user = await requireUser();
  const p = db.prepare('SELECT * FROM unit_photos WHERE id = ? AND account_id = ?').get(Number(fd.get('id')), user.account_id);
  if (!p) return;
  db.prepare('UPDATE unit_photos SET sort = sort + 1 WHERE unit_id = ?').run(p.unit_id);
  db.prepare('UPDATE unit_photos SET sort = 0 WHERE id = ?').run(p.id);
  revalidatePath('/', 'layout');
}

/* ---------- Booking requests ---------- */

export async function confirmRequest(prev, fd) {
  const user = await requireUser();
  const b = ownBooking(user.account_id, Number(fd.get('id')));
  if (!b || b.status !== 'pending') return { error: 'الطلب غير موجود أو تم التعامل معه.' };
  const clash = findOverlaps(b.unit_id, b.check_in, b.check_out, b.id);
  if (clash.length) return { error: `لا يمكن التأكيد: الوحدة محجوزة من ${clash[0].check_in} إلى ${clash[0].check_out}. عدّل التواريخ أو الوحدة أولاً.` };
  db.prepare(`UPDATE bookings SET status = 'confirmed', updated_at = datetime('now') WHERE id = ?`).run(b.id);
  refreshConflicts(b.unit_id);
  syncCleaningTask(b.id);
  logActivity(user, `أكّد طلب حجز ${b.guest_name}`, b.id);
  return done('تم تأكيد الحجز.');
}

export async function rejectRequest(fd) {
  const user = await requireUser();
  const b = ownBooking(user.account_id, Number(fd.get('id')));
  if (!b || b.status !== 'pending') return;
  const reason = str(fd, 'reason');
  db.prepare(`UPDATE bookings SET status = 'cancelled', cancel_reason = ?, updated_at = datetime('now') WHERE id = ?`).run(
    `رُفض الطلب${reason ? ': ' + reason : ''}`, b.id
  );
  logActivity(user, `رفض طلب حجز ${b.guest_name}`, b.id);
  revalidatePath('/', 'layout');
}

/* ---------- Extra charges, discounts, security deposit ---------- */

export async function addItem(prev, fd) {
  const user = await requireUser();
  const b = ownBooking(user.account_id, Number(fd.get('booking_id')));
  if (!b) return fail(fd, 'الحجز غير موجود.');
  const kind = ITEM_KINDS[str(fd, 'kind')] ? str(fd, 'kind') : 'fee';
  const label = str(fd, 'label') || ITEM_KINDS[kind];
  let amount = Math.abs(numOr(fd, 'amount'));
  if (!amount) return fail(fd, 'اكتب المبلغ.');
  if (kind === 'discount') {
    if (amount > b.total_amount) return fail(fd, 'الخصم أكبر من إجمالي الحجز.');
    amount = -amount;
  }
  db.transaction(() => {
    db.prepare('INSERT INTO booking_items (account_id, booking_id, kind, label, amount) VALUES (?,?,?,?,?)').run(user.account_id, b.id, kind, label, amount);
    db.prepare('UPDATE bookings SET total_amount = total_amount + ? WHERE id = ?').run(amount, b.id);
  })();
  logActivity(user, `أضاف ${ITEM_KINDS[kind]} "${label}" ${amount} ر.س`, b.id);
  return done(kind === 'discount' ? 'تم تطبيق الخصم.' : 'تمت الإضافة للفاتورة.');
}

export async function deleteItem(fd) {
  const user = await requireUser();
  const it = db.prepare('SELECT * FROM booking_items WHERE id = ? AND account_id = ?').get(Number(fd.get('id')), user.account_id);
  if (!it) return;
  db.transaction(() => {
    db.prepare('DELETE FROM booking_items WHERE id = ?').run(it.id);
    db.prepare('UPDATE bookings SET total_amount = MAX(0, total_amount - ?) WHERE id = ?').run(it.amount, it.booking_id);
  })();
  logActivity(user, `حذف "${it.label}" من الفاتورة`, it.booking_id);
  revalidatePath('/', 'layout');
}

export async function receiveDeposit(prev, fd) {
  const user = await requireUser();
  const b = ownBooking(user.account_id, Number(fd.get('booking_id')));
  if (!b) return { error: 'الحجز غير موجود.' };
  const amount = Math.abs(numOr(fd, 'amount'));
  if (!amount) return { error: 'اكتب مبلغ التأمين.' };
  db.prepare(`UPDATE bookings SET security_deposit = ?, deposit_status = 'held', deposit_refunded = 0 WHERE id = ?`).run(amount, b.id);
  logActivity(user, `استلم تأمين ${amount} ر.س من ${b.guest_name || 'ضيف'}`, b.id);
  return done('تم تسجيل استلام التأمين. لا يدخل في الإيرادات حتى تقرر مصيره.');
}

export async function settleDeposit(prev, fd) {
  const user = await requireUser();
  const b = ownBooking(user.account_id, Number(fd.get('booking_id')));
  if (!b || b.deposit_status !== 'held') return { error: 'لا يوجد تأمين محتجز لهذا الحجز.' };
  const refund = Math.min(b.security_deposit, Math.max(0, numOr(fd, 'refund', b.security_deposit)));
  const kept = round2(b.security_deposit - refund);
  const reason = str(fd, 'reason') || 'أضرار';
  db.transaction(() => {
    db.prepare(`UPDATE bookings SET deposit_status = ?, deposit_refunded = ? WHERE id = ?`).run(kept > 0 ? 'partial' : 'refunded', refund, b.id);
    if (kept > 0) {
      // The kept part becomes a charge on the stay, already covered by money in hand
      db.prepare('INSERT INTO booking_items (account_id, booking_id, kind, label, amount) VALUES (?,?,?,?,?)').run(
        user.account_id, b.id, 'damage', `مخصوم من التأمين: ${reason}`, kept
      );
      db.prepare('UPDATE bookings SET total_amount = total_amount + ? WHERE id = ?').run(kept, b.id);
      db.prepare('INSERT INTO payments (account_id, booking_id, amount, method, paid_on, note) VALUES (?,?,?,?,?,?)').run(
        user.account_id, b.id, kept, 'deposit', todayISO(), reason
      );
    }
  })();
  recomputePaid(b.id);
  logActivity(user, kept > 0 ? `أرجع ${refund} ر.س من التأمين وخصم ${kept} ر.س (${reason})` : `أرجع التأمين كاملاً ${refund} ر.س`, b.id);
  return done(kept > 0 ? `تم. خُصم ${kept} ر.س وأُضيف للحجز.` : 'تم إرجاع التأمين كاملاً.');
}

/* ---------- Installments for long stays ---------- */

export async function generateInstallments(fd) {
  const user = await requireUser();
  const b = ownBooking(user.account_id, Number(fd.get('booking_id')));
  if (!b || !b.total_amount) return;
  const nights = diffDays(b.check_in, b.check_out);
  const count = Math.max(1, Math.ceil(nights / 30));
  const each = Math.floor(b.total_amount / count);
  db.transaction(() => {
    db.prepare('DELETE FROM installments WHERE booking_id = ?').run(b.id);
    const ins = db.prepare('INSERT INTO installments (account_id, booking_id, due_on, amount, note) VALUES (?,?,?,?,?)');
    for (let i = 0; i < count; i++) {
      const amount = i === count - 1 ? round2(b.total_amount - each * (count - 1)) : each;
      ins.run(user.account_id, b.id, addDays(b.check_in, i * 30), amount, `دفعة ${i + 1} من ${count}`);
    }
  })();
  logActivity(user, `أنشأ جدول ${count} دفعات شهرية`, b.id);
  revalidatePath('/', 'layout');
}

export async function addInstallment(prev, fd) {
  const user = await requireUser();
  const b = ownBooking(user.account_id, Number(fd.get('booking_id')));
  if (!b) return fail(fd, 'الحجز غير موجود.');
  const amount = numOr(fd, 'amount');
  if (!(amount > 0)) return fail(fd, 'اكتب مبلغ الدفعة.');
  if (!isDate(str(fd, 'due_on'))) return fail(fd, 'حدد تاريخ الاستحقاق.');
  db.prepare('INSERT INTO installments (account_id, booking_id, due_on, amount, note) VALUES (?,?,?,?,?)').run(
    user.account_id, b.id, str(fd, 'due_on'), amount, str(fd, 'note') || null
  );
  return done('تمت إضافة الدفعة للجدول.');
}

export async function deleteInstallment(fd) {
  const user = await requireUser();
  db.prepare('DELETE FROM installments WHERE id = ? AND account_id = ?').run(Number(fd.get('id')), user.account_id);
  revalidatePath('/', 'layout');
}

/* ---------- Owners ---------- */

export async function saveOwner(prev, fd) {
  const user = await requireUser();
  const id = Number(str(fd, 'id')) || 0;
  const name = str(fd, 'name');
  if (!name) return fail(fd, 'اكتب اسم المالك.');
  const iban = str(fd, 'iban').replace(/\s/g, '').toUpperCase();
  if (iban && !/^SA\d{22}$/.test(iban)) return fail(fd, 'الآيبان السعودي يبدأ بـ SA ويتبعه 22 رقماً.');
  const fee = Math.min(100, Math.max(0, numOr(fd, 'fee_pct')));
  const vals = [name, str(fd, 'phone') || null, str(fd, 'email') || null, iban || null, fee, str(fd, 'notes') || null];
  if (id) {
    db.prepare('UPDATE owners SET name=?, phone=?, email=?, iban=?, fee_pct=?, notes=? WHERE id=? AND account_id=?').run(...vals, id, user.account_id);
    return done('تم حفظ بيانات المالك.');
  }
  const r = db.prepare('INSERT INTO owners (name, phone, email, iban, fee_pct, notes, account_id) VALUES (?,?,?,?,?,?,?)').run(...vals, user.account_id);
  logActivity(user, `أضاف المالك ${name}`);
  revalidatePath('/', 'layout');
  redirect(`/owners/${r.lastInsertRowid}`);
}

export async function deleteOwner(fd) {
  const user = await requireUser();
  db.prepare('DELETE FROM owners WHERE id = ? AND account_id = ?').run(Number(fd.get('id')), user.account_id);
  revalidatePath('/', 'layout');
  redirect('/owners');
}

export async function recordPayout(fd) {
  const user = await requireUser();
  const owner = db.prepare('SELECT * FROM owners WHERE id = ? AND account_id = ?').get(Number(fd.get('owner_id')), user.account_id);
  const period = str(fd, 'period');
  if (!owner || !/^\d{4}-\d{2}$/.test(period)) return;
  db.prepare(
    `INSERT INTO owner_payouts (account_id, owner_id, period, amount, paid_on, note) VALUES (?,?,?,?,?,?)
     ON CONFLICT(owner_id, period) DO UPDATE SET amount = excluded.amount, paid_on = excluded.paid_on, note = excluded.note`
  ).run(user.account_id, owner.id, period, numOr(fd, 'amount'), todayISO(), str(fd, 'note') || null);
  logActivity(user, `سجّل تحويل مستحقات ${owner.name} عن ${period}: ${numOr(fd, 'amount')} ر.س`);
  revalidatePath('/', 'layout');
}

export async function undoPayout(fd) {
  const user = await requireUser();
  db.prepare('DELETE FROM owner_payouts WHERE id = ? AND account_id = ?').run(Number(fd.get('id')), user.account_id);
  revalidatePath('/', 'layout');
}

/* ---------- Recurring expenses ---------- */

export async function saveRecurring(prev, fd) {
  const user = await requireUser();
  const amount = numOr(fd, 'amount');
  if (!(amount > 0)) return fail(fd, 'اكتب المبلغ الشهري.');
  const day = Math.min(28, Math.max(1, Math.round(numOr(fd, 'day_of_month', 1))));
  const unitId = Number(str(fd, 'unit_id')) || null;
  if (unitId && !db.prepare('SELECT 1 FROM units WHERE id = ? AND account_id = ?').get(unitId, user.account_id)) return fail(fd, 'الوحدة غير موجودة.');
  const cat = EXPENSE_CATEGORIES[str(fd, 'category')] ? str(fd, 'category') : 'other';
  // Start from next month when this month's day already passed, so nothing is backfilled by surprise
  const today = todayISO();
  const last = Number(today.slice(8)) >= day ? today.slice(0, 7) : null;
  db.prepare('INSERT INTO recurring_expenses (account_id, unit_id, category, amount, day_of_month, note, last_period) VALUES (?,?,?,?,?,?,?)').run(
    user.account_id, unitId, cat, amount, day, str(fd, 'note') || null, fd.get('add_now') ? null : last
  );
  logActivity(user, `أضاف مصروفاً شهرياً ${amount} ر.س (${EXPENSE_CATEGORIES[cat]})`);
  return done('تم. سيُسجَّل المصروف تلقائياً كل شهر.');
}

export async function toggleRecurring(fd) {
  const user = await requireUser();
  db.prepare('UPDATE recurring_expenses SET active = 1 - active WHERE id = ? AND account_id = ?').run(Number(fd.get('id')), user.account_id);
  revalidatePath('/', 'layout');
}

export async function deleteRecurring(fd) {
  const user = await requireUser();
  db.prepare('DELETE FROM recurring_expenses WHERE id = ? AND account_id = ?').run(Number(fd.get('id')), user.account_id);
  revalidatePath('/', 'layout');
}

/* ---------- Direct booking page settings ---------- */

export async function saveBookingPage(prev, fd) {
  const user = await requireUser(['owner']);
  const slug = str(fd, 'slug').toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{2,29}$/.test(slug)) return fail(fd, 'الرابط من 3 إلى 30 حرفاً إنجليزياً صغيراً أو أرقاماً أو شرطة (-).');
  if (db.prepare('SELECT 1 FROM accounts WHERE slug = ? AND id != ?').get(slug, user.account_id)) return fail(fd, 'هذا الرابط مستخدم، اختر غيره.');
  db.prepare('UPDATE accounts SET slug = ?, booking_enabled = ?, booking_intro = ? WHERE id = ?').run(
    slug, fd.get('booking_enabled') ? 1 : 0, str(fd, 'booking_intro') || null, user.account_id
  );
  logActivity(user, fd.get('booking_enabled') ? 'فعّل صفحة الحجز المباشر' : 'أوقف صفحة الحجز المباشر');
  return done('تم حفظ إعدادات صفحة الحجز.');
}

/* ---------- Public: direct booking request ---------- */

export async function createRequest(prev, fd) {
  if (str(fd, 'website')) return { error: 'تعذر إرسال الطلب.' }; // honeypot for bots
  const acc = db.prepare('SELECT * FROM accounts WHERE slug = ? AND booking_enabled = 1').get(str(fd, 'slug'));
  if (!acc) return { error: 'صفحة الحجز غير متاحة.' };
  const unit = db.prepare('SELECT * FROM units WHERE id = ? AND account_id = ? AND active = 1 AND public = 1').get(Number(fd.get('unit_id')), acc.id);
  const checkIn = str(fd, 'check_in');
  const checkOut = str(fd, 'check_out');
  const name = str(fd, 'name');
  const phone = str(fd, 'phone').replace(/[^\d+]/g, '');
  const guests = Math.max(1, Math.round(numOr(fd, 'guests', 1)));
  const today = todayISO();
  if (!unit) return fail(fd, 'الوحدة غير متاحة.');
  if (!isDate(checkIn) || !isDate(checkOut) || checkIn < today || checkOut <= checkIn) return fail(fd, 'اختر تاريخ وصول من اليوم فصاعداً وتاريخ مغادرة بعده.');
  if (diffDays(checkIn, checkOut) > 365) return fail(fd, 'مدة الإقامة طويلة جداً، تواصل معنا مباشرة.');
  if (name.length < 2) return fail(fd, 'اكتب اسمك.');
  if (!/^(05\d{8}|\+?9665\d{8}|\+?\d{8,15})$/.test(phone)) return fail(fd, 'اكتب رقم جوال صحيح، مثل 05xxxxxxxx.');
  if (guests > unit.capacity) return fail(fd, `الوحدة تتسع لـ ${unit.capacity} ضيوف كحد أقصى.`);
  const q = quote(unit, checkIn, checkOut, seasonRates(acc.id));
  if (diffDays(checkIn, checkOut) < q.minNights) return fail(fd, `أقل مدة حجز في هذه الفترة ${q.minNights} ليالٍ.`);
  if (findOverlaps(unit.id, checkIn, checkOut).length) return fail(fd, 'للأسف الوحدة محجوزة في هذه التواريخ. جرّب تواريخ أخرى.');
  const recent = db
    .prepare(`SELECT COUNT(*) n FROM bookings WHERE account_id = ? AND status = 'pending' AND created_at > datetime('now', '-1 day') AND guest_phone = ?`)
    .get(acc.id, phone).n;
  const flood = db.prepare(`SELECT COUNT(*) n FROM bookings WHERE account_id = ? AND status = 'pending' AND created_at > datetime('now', '-1 day')`).get(acc.id).n;
  if (recent >= 3 || flood >= 40) return fail(fd, 'وصلنا عدد كبير من الطلبات من هذا الرقم. سنتواصل معك قريباً.');

  const guestId = linkGuest(acc.id, name, phone);
  const r = db
    .prepare(
      `INSERT INTO bookings (account_id, unit_id, source, status, guest_id, guest_name, guest_phone, guests, check_in, check_out, total_amount, request_note)
       VALUES (?, ?, 'direct', 'pending', ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(acc.id, unit.id, guestId, name, phone, guests, checkIn, checkOut, q.total, str(fd, 'note').slice(0, 500) || null);
  const b = db.prepare('SELECT guest_token FROM bookings WHERE id = ?').get(r.lastInsertRowid);
  logActivity({ account_id: acc.id, name: 'صفحة الحجز' }, `طلب حجز جديد من ${name} (${checkIn} إلى ${checkOut})`, Number(r.lastInsertRowid));
  revalidatePath('/', 'layout');
  redirect(`/g/${b.guest_token}?new=1`);
}

/* ---------- Public: guest registration and review ---------- */

function guestBooking(token) {
  if (!/^[A-Za-z0-9_-]{16,40}$/.test(token)) return null;
  return db.prepare('SELECT * FROM bookings WHERE guest_token = ?').get(token);
}

export async function registerGuest(prev, fd) {
  const b = guestBooking(str(fd, 'token'));
  if (!b || b.status === 'cancelled') return { error: 'الرابط غير صالح.' };
  if (b.check_out < todayISO()) return { error: 'انتهت هذه الإقامة.' };
  const type = ID_TYPES[str(fd, 'id_type')] ? str(fd, 'id_type') : null;
  const num = str(fd, 'id_number').replace(/\s/g, '');
  const name = str(fd, 'full_name');
  if (name.length < 3) return fail(fd, 'اكتب الاسم الكامل كما في الهوية.');
  if (!type) return fail(fd, 'اختر نوع الهوية.');
  if ((type === 'national' && !/^1\d{9}$/.test(num)) || (type === 'iqama' && !/^2\d{9}$/.test(num))) {
    return fail(fd, type === 'national' ? 'رقم الهوية الوطنية 10 أرقام يبدأ بـ 1.' : 'رقم الإقامة 10 أرقام يبدأ بـ 2.');
  }
  if (num.length < 5 || num.length > 20) return fail(fd, 'رقم الهوية غير صحيح.');
  const birth = isDate(str(fd, 'birth_date')) ? str(fd, 'birth_date') : null;
  const arrival = /^\d{2}:\d{2}$/.test(str(fd, 'arrival_time')) ? str(fd, 'arrival_time') : null;
  db.transaction(() => {
    let guestId = b.guest_id;
    if (!guestId) {
      guestId = Number(db.prepare('INSERT INTO guests (account_id, name, phone) VALUES (?,?,?)').run(b.account_id, name, b.guest_phone).lastInsertRowid);
    }
    db.prepare('UPDATE guests SET name = ?, id_type = ?, id_number = ?, nationality = ?, birth_date = ? WHERE id = ?').run(
      name, type, num, str(fd, 'nationality') || null, birth, guestId
    );
    db.prepare(`UPDATE bookings SET guest_id = ?, guest_name = ?, arrival_time = ?, companions = ?, guests = MAX(guests, ?), registered_at = datetime('now') WHERE id = ?`).run(
      guestId, name, arrival, str(fd, 'companions').slice(0, 500) || null, Math.max(1, Math.round(numOr(fd, 'guests', b.guests))), b.id
    );
  })();
  logActivity({ account_id: b.account_id, name: 'الضيف' }, `${name} أكمل تسجيل بياناته`, b.id);
  revalidatePath('/', 'layout');
  return { ok: true, message: 'تم تسجيل بياناتك، شكراً لك.' };
}

export async function submitReview(prev, fd) {
  const b = guestBooking(str(fd, 'token'));
  if (!b || b.status !== 'confirmed') return { error: 'الرابط غير صالح.' };
  if (b.check_out > todayISO() && b.stay_status !== 'checked_out') return { error: 'تقدر تقيّم إقامتك بعد المغادرة.' };
  const rating = Math.round(numOr(fd, 'rating'));
  if (rating < 1 || rating > 5) return fail(fd, 'اختر تقييماً من 1 إلى 5.');
  const clean = Math.round(numOr(fd, 'cleanliness'));
  try {
    db.prepare('INSERT INTO reviews (account_id, booking_id, rating, cleanliness, comment) VALUES (?,?,?,?,?)').run(
      b.account_id, b.id, rating, clean >= 1 && clean <= 5 ? clean : null, str(fd, 'comment').slice(0, 1000) || null
    );
  } catch {
    return { error: 'تم استلام تقييمك مسبقاً.' };
  }
  logActivity({ account_id: b.account_id, name: 'الضيف' }, `${b.guest_name || 'ضيف'} قيّم الإقامة ${rating} من 5`, b.id);
  revalidatePath('/', 'layout');
  return { ok: true, message: 'شكراً لتقييمك.' };
}

