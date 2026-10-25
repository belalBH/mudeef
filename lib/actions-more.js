'use server';

import bcrypt from 'bcryptjs';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { db } from './db';
import { requireUser } from './auth';
import { EXPENSE_CATEGORIES, TASK_TYPES } from './constants';
import { todayISO } from './dates';

const str = (fd, k) => String(fd.get(k) ?? '').trim();
const numOr = (fd, k, d = 0) => {
  const v = parseFloat(str(fd, k));
  return Number.isFinite(v) ? v : d;
};
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const fail = (fd, error, extra = {}) => {
  const values = {};
  for (const [k, v] of fd.entries()) if (!/password/.test(k) && !k.startsWith('$')) values[k] = String(v);
  return { error, values, ...extra };
};
const ownUnit = (accountId, id) => (id ? db.prepare('SELECT id FROM units WHERE id = ? AND account_id = ?').get(id, accountId) : null);
const done = (message) => {
  revalidatePath('/', 'layout');
  return { ok: true, message };
};

/* ---------- Expenses ---------- */

export async function saveExpense(prev, fd) {
  const user = await requireUser();
  const id = Number(str(fd, 'id')) || 0;
  const amount = numOr(fd, 'amount');
  const on = str(fd, 'spent_on');
  const unitId = Number(str(fd, 'unit_id')) || null;
  const cat = EXPENSE_CATEGORIES[str(fd, 'category')] ? str(fd, 'category') : 'other';
  if (!(amount > 0)) return fail(fd, 'اكتب مبلغ المصروف.');
  if (!isDate(on)) return fail(fd, 'حدد تاريخ المصروف.');
  if (unitId && !ownUnit(user.account_id, unitId)) return fail(fd, 'الوحدة غير موجودة.');
  if (id) {
    db.prepare('UPDATE expenses SET unit_id=?, category=?, amount=?, spent_on=?, note=? WHERE id=? AND account_id=?').run(
      unitId, cat, amount, on, str(fd, 'note') || null, id, user.account_id
    );
    revalidatePath('/', 'layout');
    redirect(`/expenses?m=${on.slice(0, 7)}`);
  }
  db.prepare('INSERT INTO expenses (account_id, unit_id, category, amount, spent_on, note) VALUES (?,?,?,?,?,?)').run(
    user.account_id, unitId, cat, amount, on, str(fd, 'note') || null
  );
  return done('تمت إضافة المصروف.');
}

export async function deleteExpense(fd) {
  const user = await requireUser();
  db.prepare('DELETE FROM expenses WHERE id = ? AND account_id = ?').run(Number(fd.get('id')), user.account_id);
  revalidatePath('/', 'layout');
}

/* ---------- Tasks ---------- */

export async function saveTask(prev, fd) {
  const user = await requireUser();
  const id = Number(str(fd, 'id')) || 0;
  const unitId = Number(str(fd, 'unit_id'));
  const due = str(fd, 'due_on');
  const type = TASK_TYPES[str(fd, 'type')] ? str(fd, 'type') : 'other';
  if (!ownUnit(user.account_id, unitId)) return fail(fd, 'اختر الوحدة.');
  if (!isDate(due)) return fail(fd, 'حدد تاريخ المهمة.');
  const title = str(fd, 'title') || TASK_TYPES[type];
  if (id) {
    db.prepare('UPDATE tasks SET unit_id=?, type=?, title=?, due_on=?, assignee=?, note=? WHERE id=? AND account_id=?').run(
      unitId, type, title, due, str(fd, 'assignee') || null, str(fd, 'note') || null, id, user.account_id
    );
    return done('تم حفظ المهمة.');
  }
  db.prepare('INSERT INTO tasks (account_id, unit_id, type, title, due_on, assignee, note) VALUES (?,?,?,?,?,?,?)').run(
    user.account_id, unitId, type, title, due, str(fd, 'assignee') || null, str(fd, 'note') || null
  );
  return done('تمت إضافة المهمة.');
}

export async function toggleTask(fd) {
  const user = await requireUser(['owner', 'manager', 'cleaner']);
  const t = db.prepare('SELECT * FROM tasks WHERE id = ? AND account_id = ?').get(Number(fd.get('id')), user.account_id);
  if (!t) return;
  if (t.status === 'open') {
    db.prepare(`UPDATE tasks SET status = 'done', done_at = datetime('now') WHERE id = ?`).run(t.id);
    // Optional per-checkout cleaning cost becomes an expense automatically
    const fee = db.prepare('SELECT cleaning_fee FROM accounts WHERE id = ?').get(user.account_id)?.cleaning_fee || 0;
    if (t.type === 'cleaning' && fee > 0) {
      db.prepare(`INSERT INTO expenses (account_id, unit_id, category, amount, spent_on, note, task_id) VALUES (?,?,?,?,?,?,?)`).run(
        user.account_id, t.unit_id, 'cleaning', fee, todayISO(), t.assignee ? `تنظيف بعد خروج ضيف (${t.assignee})` : 'تنظيف بعد خروج ضيف', t.id
      );
    }
  } else {
    db.prepare(`UPDATE tasks SET status = 'open', done_at = NULL WHERE id = ?`).run(t.id);
    db.prepare('DELETE FROM expenses WHERE task_id = ?').run(t.id);
  }
  revalidatePath('/', 'layout');
}

export async function assignTask(fd) {
  const user = await requireUser();
  db.prepare('UPDATE tasks SET assignee = ? WHERE id = ? AND account_id = ?').run(str(fd, 'assignee') || null, Number(fd.get('id')), user.account_id);
  revalidatePath('/', 'layout');
}

export async function deleteTask(fd) {
  const user = await requireUser();
  db.prepare('DELETE FROM tasks WHERE id = ? AND account_id = ?').run(Number(fd.get('id')), user.account_id);
  revalidatePath('/', 'layout');
}

/* ---------- Guests ---------- */

export async function saveGuest(prev, fd) {
  const user = await requireUser();
  const id = Number(str(fd, 'id')) || 0;
  const name = str(fd, 'name');
  if (!name) return fail(fd, 'اكتب اسم الضيف.');
  const phone = str(fd, 'phone').replace(/\D/g, '').replace(/^966/, '0') || null;
  if (phone) {
    const dup = db.prepare('SELECT id FROM guests WHERE account_id = ? AND phone = ? AND id != ?').get(user.account_id, phone, id);
    if (dup) return fail(fd, 'يوجد ضيف آخر بنفس رقم الجوال.');
  }
  const vals = [name, phone, str(fd, 'email') || null, str(fd, 'nationality') || null, str(fd, 'notes') || null, fd.get('blacklisted') ? 1 : 0];
  if (id) {
    db.prepare('UPDATE guests SET name=?, phone=?, email=?, nationality=?, notes=?, blacklisted=? WHERE id=? AND account_id=?').run(...vals, id, user.account_id);
    db.prepare('UPDATE bookings SET guest_name = ?, guest_phone = ? WHERE guest_id = ?').run(name, phone, id);
    return done('تم حفظ بيانات الضيف.');
  }
  const r = db.prepare('INSERT INTO guests (name, phone, email, nationality, notes, blacklisted, account_id) VALUES (?,?,?,?,?,?,?)').run(...vals, user.account_id);
  revalidatePath('/', 'layout');
  redirect(`/guests/${r.lastInsertRowid}`);
}

export async function deleteGuest(fd) {
  const user = await requireUser();
  db.prepare('DELETE FROM guests WHERE id = ? AND account_id = ?').run(Number(fd.get('id')), user.account_id);
  revalidatePath('/', 'layout');
  redirect('/guests');
}

/* ---------- Season rates ---------- */

export async function saveSeason(prev, fd) {
  const user = await requireUser();
  const id = Number(str(fd, 'id')) || 0;
  const unitId = Number(str(fd, 'unit_id')) || null;
  const name = str(fd, 'name');
  const s = str(fd, 'start_on');
  const e = str(fd, 'end_on');
  const price = numOr(fd, 'price');
  if (!name) return fail(fd, 'اكتب اسم الموسم، مثل: موسم الحج أو إجازة الصيف.');
  if (!isDate(s) || !isDate(e) || e < s) return fail(fd, 'حدد بداية ونهاية الموسم، والنهاية بعد البداية.');
  if (!(price > 0)) return fail(fd, 'اكتب سعر الليلة في الموسم.');
  if (unitId && !ownUnit(user.account_id, unitId)) return fail(fd, 'الوحدة غير موجودة.');
  const wp = str(fd, 'weekend_price') ? numOr(fd, 'weekend_price') : null;
  const min = Math.max(1, Math.round(numOr(fd, 'min_nights', 1)));
  if (id) {
    db.prepare('UPDATE season_rates SET unit_id=?, name=?, start_on=?, end_on=?, price=?, weekend_price=?, min_nights=? WHERE id=? AND account_id=?').run(
      unitId, name, s, e, price, wp, min, id, user.account_id
    );
    return done('تم حفظ الموسم.');
  }
  db.prepare('INSERT INTO season_rates (account_id, unit_id, name, start_on, end_on, price, weekend_price, min_nights) VALUES (?,?,?,?,?,?,?,?)').run(
    user.account_id, unitId, name, s, e, price, wp, min
  );
  return done('تمت إضافة الموسم.');
}

export async function deleteSeason(fd) {
  const user = await requireUser();
  db.prepare('DELETE FROM season_rates WHERE id = ? AND account_id = ?').run(Number(fd.get('id')), user.account_id);
  revalidatePath('/', 'layout');
}

/* ---------- Settings ---------- */

export async function saveBusiness(prev, fd) {
  const user = await requireUser();
  const name = str(fd, 'name');
  if (!name) return fail(fd, 'اكتب اسم النشاط.');
  const vat = str(fd, 'vat_number').replace(/\s/g, '');
  if (vat && !/^3\d{13}3$/.test(vat)) return fail(fd, 'الرقم الضريبي في السعودية 15 رقماً يبدأ وينتهي بـ 3.');
  const time = (k, d) => (/^\d{2}:\d{2}$/.test(str(fd, k)) ? str(fd, k) : d);
  db.prepare(
    `UPDATE accounts SET name=?, phone=?, address=?, vat_number=?, checkin_time=?, checkout_time=?, invoice_note=?, cleaning_fee=? WHERE id=?`
  ).run(
    name, str(fd, 'phone') || null, str(fd, 'address') || null, vat || null,
    time('checkin_time', '15:00'), time('checkout_time', '12:00'), str(fd, 'invoice_note') || null,
    Math.max(0, numOr(fd, 'cleaning_fee')), user.account_id
  );
  return done('تم حفظ بيانات النشاط.');
}

export async function saveTemplates(prev, fd) {
  const user = await requireUser();
  db.prepare('UPDATE accounts SET wa_confirm=?, wa_checkin=?, wa_thanks=? WHERE id=?').run(
    str(fd, 'wa_confirm') || null, str(fd, 'wa_checkin') || null, str(fd, 'wa_thanks') || null, user.account_id
  );
  return done('تم حفظ نصوص الرسائل.');
}

export async function saveProfile(prev, fd) {
  const user = await requireUser(['owner', 'manager', 'cleaner']);
  const name = str(fd, 'name');
  const email = str(fd, 'email').toLowerCase();
  if (!name) return fail(fd, 'اكتب اسمك.');
  if (!/^\S+@\S+\.\S+$/.test(email)) return fail(fd, 'صيغة البريد الإلكتروني غير صحيحة.');
  if (db.prepare('SELECT 1 FROM users WHERE email = ? AND id != ?').get(email, user.id)) return fail(fd, 'هذا البريد مستخدم في حساب آخر.');
  db.prepare('UPDATE users SET name = ?, email = ? WHERE id = ?').run(name, email, user.id);
  return done('تم حفظ بياناتك.');
}

export async function changePassword(prev, fd) {
  const user = await requireUser(['owner', 'manager', 'cleaner']);
  const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(user.id);
  const current = String(fd.get('current_password') || '');
  const next = String(fd.get('new_password') || '');
  if (!(await bcrypt.compare(current, row.password_hash))) return { error: 'كلمة المرور الحالية غير صحيحة.' };
  if (next.length < 8) return { error: 'كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل.' };
  if (next !== String(fd.get('confirm_password') || '')) return { error: 'تأكيد كلمة المرور لا يطابق.' };
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(await bcrypt.hash(next, 10), user.id);
  return { ok: true, message: 'تم تغيير كلمة المرور.' };
}
