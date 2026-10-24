import 'server-only';
import { db } from './db';
import { addDays, daysInMonth, diffDays, overlapNights, todayISO } from './dates';

export function listUnits(accountId, { activeOnly = false } = {}) {
  return db
    .prepare(
      `SELECT u.*,
        (SELECT COUNT(*) FROM channels c WHERE c.unit_id = u.id) AS channel_count
       FROM units u WHERE u.account_id = ? ${activeOnly ? 'AND u.active = 1' : ''} ORDER BY u.name`
    )
    .all(accountId);
}

export function getUnit(accountId, id) {
  return db.prepare('SELECT * FROM units WHERE id = ? AND account_id = ?').get(id, accountId);
}

export function unitChannels(accountId, unitId) {
  return db.prepare('SELECT * FROM channels WHERE unit_id = ? AND account_id = ? ORDER BY source').all(unitId, accountId);
}

export function listChannels(accountId) {
  return db
    .prepare(
      `SELECT c.*, u.name AS unit_name FROM channels c JOIN units u ON u.id = c.unit_id
       WHERE c.account_id = ? ORDER BY u.name, c.source`
    )
    .all(accountId);
}

export function getBooking(accountId, id) {
  return db
    .prepare(
      `SELECT b.*, u.name AS unit_name FROM bookings b JOIN units u ON u.id = b.unit_id
       WHERE b.id = ? AND b.account_id = ?`
    )
    .get(id, accountId);
}

export function listBookings(accountId, { view = 'upcoming', unit = null, source = null, q = '' } = {}) {
  const today = todayISO();
  const where = ['b.account_id = ?'];
  const args = [accountId];
  if (view === 'upcoming') {
    where.push("b.check_out >= ? AND b.status != 'cancelled'");
    args.push(today);
  } else if (view === 'past') {
    where.push("b.check_out < ? AND b.status != 'cancelled'");
    args.push(today);
  } else if (view === 'cancelled') {
    where.push("b.status = 'cancelled'");
  } else if (view === 'conflicts') {
    where.push("b.conflict = 1 AND b.status != 'cancelled'");
  }
  if (unit) {
    where.push('b.unit_id = ?');
    args.push(unit);
  }
  if (source) {
    where.push('b.source = ?');
    args.push(source);
  }
  if (q) {
    where.push('(b.guest_name LIKE ? OR b.guest_phone LIKE ?)');
    args.push(`%${q}%`, `%${q}%`);
  }
  const order = view === 'upcoming' || view === 'conflicts' ? 'b.check_in ASC' : 'b.check_in DESC';
  return db
    .prepare(
      `SELECT b.*, u.name AS unit_name FROM bookings b JOIN units u ON u.id = b.unit_id
       WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT 300`
    )
    .all(...args);
}

export function bookingsInRange(accountId, from, to) {
  return db
    .prepare(
      `SELECT b.*, u.name AS unit_name FROM bookings b JOIN units u ON u.id = b.unit_id
       WHERE b.account_id = ? AND b.status != 'cancelled' AND b.check_in < ? AND b.check_out > ?
       ORDER BY b.check_in`
    )
    .all(accountId, to, from);
}

export function dashboard(accountId) {
  const today = todayISO();
  const ym = today.slice(0, 7);
  const mFrom = `${ym}-01`;
  const mTo = addDays(mFrom, daysInMonth(ym));
  const units = db.prepare('SELECT COUNT(*) n FROM units WHERE account_id = ? AND active = 1').get(accountId).n;

  const monthRows = bookingsInRange(accountId, mFrom, mTo);
  let nights = 0;
  let revenue = 0;
  for (const b of monthRows) {
    const total = diffDays(b.check_in, b.check_out);
    const inMonth = overlapNights(b.check_in, b.check_out, mFrom, mTo);
    nights += inMonth;
    // Revenue is spread across nights so a stay crossing months counts in each month proportionally
    revenue += total ? ((b.total_amount - b.commission) * inMonth) / total : 0;
  }
  const capacity = units * daysInMonth(ym);

  const arrivals = db
    .prepare(
      `SELECT b.*, u.name AS unit_name FROM bookings b JOIN units u ON u.id = b.unit_id
       WHERE b.account_id = ? AND b.status != 'cancelled' AND b.check_in BETWEEN ? AND ? ORDER BY b.check_in`
    )
    .all(accountId, today, addDays(today, 6));
  const departures = db
    .prepare(
      `SELECT b.*, u.name AS unit_name FROM bookings b JOIN units u ON u.id = b.unit_id
       WHERE b.account_id = ? AND b.status != 'cancelled' AND b.check_out = ? ORDER BY u.name`
    )
    .all(accountId, today);
  const inHouse = db
    .prepare(
      `SELECT COUNT(*) n FROM bookings WHERE account_id = ? AND status != 'cancelled' AND check_in <= ? AND check_out > ?`
    )
    .get(accountId, today, today).n;
  const conflicts = db
    .prepare(
      `SELECT b.*, u.name AS unit_name FROM bookings b JOIN units u ON u.id = b.unit_id
       WHERE b.account_id = ? AND b.conflict = 1 AND b.status != 'cancelled' AND b.check_out >= ? ORDER BY b.check_in`
    )
    .all(accountId, today);
  const syncErrors = db
    .prepare(
      `SELECT c.*, u.name AS unit_name FROM channels c JOIN units u ON u.id = c.unit_id
       WHERE c.account_id = ? AND c.last_sync_status = 'error'`
    )
    .all(accountId);
  const unpriced = db
    .prepare(
      `SELECT COUNT(*) n FROM bookings WHERE account_id = ? AND imported = 1 AND total_amount = 0 AND status != 'cancelled' AND check_out >= ?`
    )
    .get(accountId, addDays(today, -60)).n;

  return {
    today,
    units,
    inHouse,
    occupancy: capacity ? nights / capacity : 0,
    nights,
    revenue,
    arrivals,
    departures,
    conflicts,
    syncErrors,
    unpriced,
  };
}

export function yearReport(accountId, year) {
  const from = `${year}-01-01`;
  const to = `${year + 1}-01-01`;
  const units = db.prepare('SELECT id, name FROM units WHERE account_id = ? AND active = 1 ORDER BY name').all(accountId);
  const rows = bookingsInRange(accountId, from, to);

  const months = Array.from({ length: 12 }, (_, i) => ({ m: i + 1, revenue: 0, gross: 0, nights: 0, bookings: 0 }));
  const bySource = {};
  const byUnit = Object.fromEntries(units.map((u) => [u.id, { name: u.name, revenue: 0, nights: 0 }]));

  for (const b of rows) {
    const totalNights = diffDays(b.check_in, b.check_out);
    if (!totalNights) continue;
    const net = b.total_amount - b.commission;
    for (const mo of months) {
      const mFrom = `${year}-${String(mo.m).padStart(2, '0')}-01`;
      const mTo = addDays(mFrom, daysInMonth(mFrom.slice(0, 7)));
      const n = overlapNights(b.check_in, b.check_out, mFrom, mTo);
      if (!n) continue;
      mo.nights += n;
      mo.revenue += (net * n) / totalNights;
      mo.gross += (b.total_amount * n) / totalNights;
      if (b.check_in >= mFrom && b.check_in < mTo) mo.bookings++;
    }
    const yn = overlapNights(b.check_in, b.check_out, from, to);
    const share = yn / totalNights;
    const s = (bySource[b.source] ||= { revenue: 0, gross: 0, commission: 0, nights: 0, bookings: 0 });
    s.revenue += net * share;
    s.gross += b.total_amount * share;
    s.commission += b.commission * share;
    s.nights += yn;
    s.bookings++;
    if (byUnit[b.unit_id]) {
      byUnit[b.unit_id].revenue += net * share;
      byUnit[b.unit_id].nights += yn;
    }
  }
  for (const mo of months) {
    const cap = units.length * daysInMonth(`${year}-${String(mo.m).padStart(2, '0')}`);
    mo.occupancy = cap ? mo.nights / cap : 0;
  }
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const daysYear = isLeap ? 366 : 365;
  const unitList = Object.values(byUnit).map((u) => ({ ...u, occupancy: u.nights / daysYear }));
  const totals = months.reduce(
    (a, m) => ({ revenue: a.revenue + m.revenue, gross: a.gross + m.gross, nights: a.nights + m.nights }),
    { revenue: 0, gross: 0, nights: 0 }
  );
  totals.adr = totals.nights ? totals.gross / totals.nights : 0;
  totals.occupancy = units.length ? totals.nights / (units.length * daysYear) : 0;
  return { months, bySource, byUnit: unitList, totals };
}
