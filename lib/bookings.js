import { db } from './db';

// Bookings on the same unit whose nights intersect [checkIn, checkOut)
export function findOverlaps(unitId, checkIn, checkOut, excludeId = 0) {
  return db
    .prepare(
      `SELECT id, guest_name, source, check_in, check_out FROM bookings
       WHERE unit_id = ? AND status = 'confirmed' AND id != ?
         AND check_in < ? AND check_out > ?`
    )
    .all(unitId, excludeId, checkOut, checkIn);
}

// Re-flag double bookings for one unit. A booking is a conflict when it shares a night with another active booking.
export function refreshConflicts(unitId) {
  const rows = db
    .prepare(
      `SELECT id, check_in, check_out FROM bookings
       WHERE unit_id = ? AND status = 'confirmed' ORDER BY check_in`
    )
    .all(unitId);
  const conflicted = new Set();
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      if (rows[j].check_in >= rows[i].check_out) break;
      conflicted.add(rows[i].id);
      conflicted.add(rows[j].id);
    }
  }
  const tx = db.transaction(() => {
    db.prepare(`UPDATE bookings SET conflict = 0 WHERE unit_id = ?`).run(unitId);
    const mark = db.prepare(`UPDATE bookings SET conflict = 1 WHERE id = ?`);
    for (const id of conflicted) mark.run(id);
  });
  tx();
  return conflicted.size;
}

// paid_amount on the booking is a cached sum of its payments
export function recomputePaid(bookingId) {
  db.prepare(
    `UPDATE bookings SET paid_amount = COALESCE((SELECT SUM(amount) FROM payments WHERE booking_id = ?), 0) WHERE id = ?`
  ).run(bookingId, bookingId);
}

// Every real stay gets one cleaning task on its checkout day; it follows date changes and disappears on cancel
export function syncCleaningTask(bookingId) {
  const b = db.prepare('SELECT id, account_id, unit_id, check_out, status, source FROM bookings WHERE id = ?').get(bookingId);
  if (!b) return;
  const task = db.prepare(`SELECT id, status FROM tasks WHERE booking_id = ? AND type = 'cleaning'`).get(b.id);
  if (b.status !== 'confirmed' || b.source === 'block') {
    if (task && task.status === 'open') db.prepare('DELETE FROM tasks WHERE id = ?').run(task.id);
    return;
  }
  if (task) {
    db.prepare(`UPDATE tasks SET due_on = ?, unit_id = ? WHERE id = ? AND status = 'open'`).run(b.check_out, b.unit_id, task.id);
  } else {
    db.prepare(
      `INSERT INTO tasks (account_id, unit_id, booking_id, type, title, due_on) VALUES (?, ?, ?, 'cleaning', 'تنظيف بعد خروج الضيف', ?)`
    ).run(b.account_id, b.unit_id, b.id, b.check_out);
  }
}

function normPhone(p) {
  const d = String(p || '').replace(/\D/g, '');
  if (!d) return null;
  if (d.startsWith('966')) return '0' + d.slice(3);
  return d;
}

// Finds the guest by phone (or exact name when no phone) and creates one when new
export function linkGuest(accountId, name, phone) {
  const cleanName = (name || '').trim();
  const p = normPhone(phone);
  if (!cleanName && !p) return null;
  if (/^ضيف /.test(cleanName) && !p) return null; // placeholder names from platform feeds
  let g = p ? db.prepare('SELECT id FROM guests WHERE account_id = ? AND phone = ?').get(accountId, p) : null;
  if (!g && cleanName && !p) g = db.prepare('SELECT id FROM guests WHERE account_id = ? AND name = ? AND phone IS NULL').get(accountId, cleanName);
  if (g) {
    if (cleanName) db.prepare('UPDATE guests SET name = ? WHERE id = ?').run(cleanName, g.id);
    return g.id;
  }
  const r = db.prepare('INSERT INTO guests (account_id, name, phone) VALUES (?, ?, ?)').run(accountId, cleanName || p, p);
  return Number(r.lastInsertRowid);
}

export function seasonRates(accountId) {
  return db.prepare('SELECT * FROM season_rates WHERE account_id = ? ORDER BY start_on').all(accountId);
}
