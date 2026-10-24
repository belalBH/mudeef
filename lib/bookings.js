import { db } from './db';

// Bookings on the same unit whose nights intersect [checkIn, checkOut)
export function findOverlaps(unitId, checkIn, checkOut, excludeId = 0) {
  return db
    .prepare(
      `SELECT id, guest_name, source, check_in, check_out FROM bookings
       WHERE unit_id = ? AND status != 'cancelled' AND id != ?
         AND check_in < ? AND check_out > ?`
    )
    .all(unitId, excludeId, checkOut, checkIn);
}

// Re-flag double bookings for one unit. A booking is a conflict when it shares a night with another active booking.
export function refreshConflicts(unitId) {
  const rows = db
    .prepare(
      `SELECT id, check_in, check_out FROM bookings
       WHERE unit_id = ? AND status != 'cancelled' ORDER BY check_in`
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
