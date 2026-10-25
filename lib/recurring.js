import { db } from './db';
import { todayISO } from './dates';

// Adds this month's copy of every active recurring expense once its day has come
export function runRecurring(accountId = null) {
  const today = todayISO();
  const ym = today.slice(0, 7);
  const day = Number(today.slice(8));
  const rows = db
    .prepare(
      `SELECT * FROM recurring_expenses WHERE active = 1 AND (last_period IS NULL OR last_period < ?) AND day_of_month <= ? ${accountId ? 'AND account_id = ?' : ''}`
    )
    .all(...(accountId ? [ym, day, accountId] : [ym, day]));
  if (!rows.length) return 0;
  const ins = db.prepare('INSERT INTO expenses (account_id, unit_id, category, amount, spent_on, note) VALUES (?,?,?,?,?,?)');
  const mark = db.prepare('UPDATE recurring_expenses SET last_period = ? WHERE id = ?');
  db.transaction(() => {
    for (const r of rows) {
      ins.run(r.account_id, r.unit_id, r.category, r.amount, `${ym}-${String(r.day_of_month).padStart(2, '0')}`, `${r.note || 'مصروف شهري'} (تلقائي)`);
      mark.run(ym, r.id);
    }
  })();
  return rows.length;
}
