import 'server-only';
import { db } from './db';
import { addDays, addMonths, daysInMonth, diffDays, overlapNights, todayISO } from './dates';

/* ---------- Account ---------- */

export function getAccount(accountId) {
  return db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId);
}

/* ---------- Units ---------- */

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

export function unitBlocks(accountId, unitId) {
  return db
    .prepare(
      `SELECT * FROM bookings WHERE account_id = ? AND unit_id = ? AND source = 'block' AND status != 'cancelled' AND check_out >= ?
       ORDER BY check_in`
    )
    .all(accountId, unitId, todayISO());
}

export function listChannels(accountId) {
  return db
    .prepare(
      `SELECT c.*, u.name AS unit_name FROM channels c JOIN units u ON u.id = c.unit_id
       WHERE c.account_id = ? ORDER BY u.name, c.source`
    )
    .all(accountId);
}

export function listSeasons(accountId) {
  return db
    .prepare(
      `SELECT s.*, u.name AS unit_name FROM season_rates s LEFT JOIN units u ON u.id = s.unit_id
       WHERE s.account_id = ? ORDER BY s.start_on`
    )
    .all(accountId);
}

/* ---------- Bookings ---------- */

export function getBooking(accountId, id) {
  return db
    .prepare(
      `SELECT b.*, u.name AS unit_name, u.checkin_info, g.blacklisted AS guest_blacklisted, g.notes AS guest_notes
       FROM bookings b JOIN units u ON u.id = b.unit_id LEFT JOIN guests g ON g.id = b.guest_id
       WHERE b.id = ? AND b.account_id = ?`
    )
    .get(id, accountId);
}

export function bookingPayments(accountId, bookingId) {
  return db.prepare('SELECT * FROM payments WHERE booking_id = ? AND account_id = ? ORDER BY paid_on, id').all(bookingId, accountId);
}

export function bookingTasks(accountId, bookingId) {
  return db.prepare('SELECT * FROM tasks WHERE booking_id = ? AND account_id = ? ORDER BY due_on').all(bookingId, accountId);
}

export function listBookings(accountId, { view = 'upcoming', unit = null, source = null, q = '', from = null, to = null } = {}) {
  const today = todayISO();
  const where = ['b.account_id = ?', "b.source != 'block'"];
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
  } else if (view === 'due') {
    where.push("b.status != 'cancelled' AND b.total_amount - b.paid_amount > 0.5");
  } else if (view === 'inhouse') {
    where.push("b.status != 'cancelled' AND b.check_in <= ? AND b.check_out > ?");
    args.push(today, today);
  }
  if (unit) {
    where.push('b.unit_id = ?');
    args.push(unit);
  }
  if (source) {
    where.push('b.source = ?');
    args.push(source);
  }
  if (from) {
    where.push('b.check_out > ?');
    args.push(from);
  }
  if (to) {
    where.push('b.check_in < ?');
    args.push(to);
  }
  if (q) {
    where.push('(b.guest_name LIKE ? OR b.guest_phone LIKE ? OR CAST(b.id AS TEXT) = ?)');
    args.push(`%${q}%`, `%${q}%`, q.replace(/^#/, ''));
  }
  const order = ['upcoming', 'conflicts', 'inhouse', 'due'].includes(view) ? 'b.check_in ASC' : 'b.check_in DESC';
  return db
    .prepare(
      `SELECT b.*, u.name AS unit_name FROM bookings b JOIN units u ON u.id = b.unit_id
       WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT 500`
    )
    .all(...args);
}

export function bookingsInRange(accountId, from, to, { withBlocks = false } = {}) {
  return db
    .prepare(
      `SELECT b.*, u.name AS unit_name FROM bookings b JOIN units u ON u.id = b.unit_id
       WHERE b.account_id = ? AND b.status != 'cancelled' AND b.check_in < ? AND b.check_out > ?
         ${withBlocks ? '' : "AND b.source != 'block'"}
       ORDER BY b.check_in`
    )
    .all(accountId, to, from);
}

/* ---------- Money helpers ---------- */

// Net revenue and nights of the stays that fall inside [from, to), spread by night
function periodStats(accountId, from, to, units) {
  const rows = bookingsInRange(accountId, from, to);
  let nights = 0;
  let revenue = 0;
  let gross = 0;
  const bySource = {};
  for (const b of rows) {
    const total = diffDays(b.check_in, b.check_out);
    const n = overlapNights(b.check_in, b.check_out, from, to);
    if (!total || !n) continue;
    nights += n;
    const net = ((b.total_amount - b.commission) * n) / total;
    revenue += net;
    gross += (b.total_amount * n) / total;
    bySource[b.source] = (bySource[b.source] || 0) + net;
  }
  const days = diffDays(from, to);
  const expenses = db
    .prepare('SELECT COALESCE(SUM(amount),0) s FROM expenses WHERE account_id = ? AND spent_on >= ? AND spent_on < ?')
    .get(accountId, from, to).s;
  return {
    nights,
    revenue,
    gross,
    expenses,
    profit: revenue - expenses,
    adr: nights ? gross / nights : 0,
    occupancy: units * days ? nights / (units * days) : 0,
    bySource,
  };
}

/* ---------- Dashboard ---------- */

export function dashboard(accountId) {
  const today = todayISO();
  const ym = today.slice(0, 7);
  const mFrom = `${ym}-01`;
  const mTo = addDays(mFrom, daysInMonth(ym));
  const prevYm = addMonths(ym, -1);
  const pFrom = `${prevYm}-01`;
  // Compare with the same number of days last month so a half-finished month isn't judged against a full one
  const dayOfMonth = Number(today.slice(8));
  const pTo = addDays(pFrom, Math.min(daysInMonth(prevYm), dayOfMonth));
  const units = listUnits(accountId, { activeOnly: true });
  const n = units.length;

  const month = periodStats(accountId, mFrom, mTo, n);
  const monthToDate = periodStats(accountId, mFrom, addDays(today, 1), n);
  const lastMonthToDate = periodStats(accountId, pFrom, pTo, n);

  const newBookings = (from, to) =>
    db
      .prepare(
        `SELECT COUNT(*) n FROM bookings WHERE account_id = ? AND source != 'block' AND date(created_at) >= ? AND date(created_at) < ?`
      )
      .get(accountId, from, to).n;

  const trend = [];
  for (let i = 5; i >= 0; i--) {
    const m = addMonths(ym, -i);
    const f = `${m}-01`;
    const t = addDays(f, daysInMonth(m));
    const s = periodStats(accountId, f, t, n);
    trend.push({ ym: m, revenue: s.revenue, expenses: s.expenses, occupancy: s.occupancy });
  }

  const sel = `SELECT b.*, u.name AS unit_name FROM bookings b JOIN units u ON u.id = b.unit_id WHERE b.account_id = ? AND b.status != 'cancelled' AND b.source != 'block'`;
  const arrivals = db.prepare(`${sel} AND b.check_in BETWEEN ? AND ? ORDER BY b.check_in, u.name`).all(accountId, today, addDays(today, 6));
  const departures = db.prepare(`${sel} AND b.check_out = ? ORDER BY u.name`).all(accountId, today);
  const lateCheckouts = db
    .prepare(`${sel} AND b.check_out < ? AND b.check_out >= ? AND b.stay_status = 'checked_in' ORDER BY b.check_out`)
    .all(accountId, today, addDays(today, -14));
  const noShows = db
    .prepare(`${sel} AND b.check_in < ? AND b.check_out > ? AND b.stay_status = 'upcoming' ORDER BY b.check_in`)
    .all(accountId, today, today);
  const dues = db
    .prepare(`${sel} AND b.total_amount - b.paid_amount > 0.5 AND b.check_in <= ? AND b.check_out >= ? ORDER BY b.check_in LIMIT 8`)
    .all(accountId, addDays(today, 3), addDays(today, -30));
  const dueTotal = db
    .prepare(`SELECT COALESCE(SUM(total_amount - paid_amount),0) s FROM bookings WHERE account_id = ? AND status != 'cancelled' AND source != 'block' AND total_amount - paid_amount > 0.5 AND check_in <= ?`)
    .get(accountId, today).s;

  // What each unit is doing right now
  const board = units.map((u) => {
    const stay = db
      .prepare(`SELECT * FROM bookings WHERE unit_id = ? AND status != 'cancelled' AND check_in <= ? AND check_out > ? ORDER BY source = 'block' LIMIT 1`)
      .get(u.id, today, today);
    const leaving = db
      .prepare(`SELECT * FROM bookings WHERE unit_id = ? AND status != 'cancelled' AND source != 'block' AND check_out = ? LIMIT 1`)
      .get(u.id, today);
    const next = db
      .prepare(`SELECT * FROM bookings WHERE unit_id = ? AND status != 'cancelled' AND source != 'block' AND check_in > ? ORDER BY check_in LIMIT 1`)
      .get(u.id, today);
    const cleaning = db
      .prepare(`SELECT * FROM tasks WHERE unit_id = ? AND status = 'open' AND type = 'cleaning' AND due_on <= ? ORDER BY due_on LIMIT 1`)
      .get(u.id, today);
    let state = 'vacant';
    if (stay?.source === 'block') state = 'blocked';
    else if (stay) state = 'occupied';
    else if (cleaning) state = 'dirty';
    return { unit: u, state, stay, leaving, next, cleaning };
  });

  const tasksToday = db
    .prepare(
      `SELECT t.*, u.name AS unit_name FROM tasks t JOIN units u ON u.id = t.unit_id
       WHERE t.account_id = ? AND t.status = 'open' AND t.due_on <= ? ORDER BY t.due_on, u.name`
    )
    .all(accountId, today);
  const conflicts = db
    .prepare(`${sel} AND b.conflict = 1 AND b.check_out >= ? ORDER BY b.check_in`)
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
  const upcoming30 = periodStats(accountId, addDays(today, 1), addDays(today, 31), n);

  return {
    today,
    units: n,
    inHouse: board.filter((b) => b.state === 'occupied').length,
    month,
    monthToDate,
    lastMonthToDate,
    newThisMonth: newBookings(mFrom, addDays(today, 1)),
    newLastMonth: newBookings(pFrom, pTo),
    trend,
    board,
    arrivals,
    departures,
    lateCheckouts,
    noShows,
    dues,
    dueTotal,
    tasksToday,
    conflicts,
    syncErrors,
    unpriced,
    upcoming30,
  };
}

/* ---------- Reports ---------- */

export function yearReport(accountId, year) {
  const from = `${year}-01-01`;
  const to = `${year + 1}-01-01`;
  const units = db.prepare('SELECT id, name FROM units WHERE account_id = ? AND active = 1 ORDER BY name').all(accountId);
  const rows = bookingsInRange(accountId, from, to);

  const months = Array.from({ length: 12 }, (_, i) => ({ m: i + 1, revenue: 0, gross: 0, nights: 0, bookings: 0, expenses: 0 }));
  const bySource = {};
  const byUnit = Object.fromEntries(units.map((u) => [u.id, { id: u.id, name: u.name, revenue: 0, nights: 0, expenses: 0 }]));

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

  const exp = db.prepare('SELECT * FROM expenses WHERE account_id = ? AND spent_on >= ? AND spent_on < ?').all(accountId, from, to);
  const byCategory = {};
  let generalExpenses = 0;
  for (const e of exp) {
    months[Number(e.spent_on.slice(5, 7)) - 1].expenses += e.amount;
    byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
    if (e.unit_id && byUnit[e.unit_id]) byUnit[e.unit_id].expenses += e.amount;
    else generalExpenses += e.amount;
  }

  for (const mo of months) {
    const cap = units.length * daysInMonth(`${year}-${String(mo.m).padStart(2, '0')}`);
    mo.occupancy = cap ? mo.nights / cap : 0;
    mo.profit = mo.revenue - mo.expenses;
  }
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const daysYear = isLeap ? 366 : 365;
  const unitList = Object.values(byUnit).map((u) => ({ ...u, occupancy: u.nights / daysYear, profit: u.revenue - u.expenses }));
  const totals = months.reduce(
    (a, m) => ({ revenue: a.revenue + m.revenue, gross: a.gross + m.gross, nights: a.nights + m.nights, expenses: a.expenses + m.expenses }),
    { revenue: 0, gross: 0, nights: 0, expenses: 0 }
  );
  totals.profit = totals.revenue - totals.expenses;
  totals.adr = totals.nights ? totals.gross / totals.nights : 0;
  totals.occupancy = units.length ? totals.nights / (units.length * daysYear) : 0;
  return { months, bySource, byUnit: unitList, byCategory, generalExpenses, totals };
}

/* ---------- Expenses ---------- */

export function listExpenses(accountId, ym) {
  const from = `${ym}-01`;
  const to = addDays(from, daysInMonth(ym));
  return db
    .prepare(
      `SELECT e.*, u.name AS unit_name FROM expenses e LEFT JOIN units u ON u.id = e.unit_id
       WHERE e.account_id = ? AND e.spent_on >= ? AND e.spent_on < ? ORDER BY e.spent_on DESC, e.id DESC`
    )
    .all(accountId, from, to);
}

export function getExpense(accountId, id) {
  return db.prepare('SELECT * FROM expenses WHERE id = ? AND account_id = ?').get(id, accountId);
}

/* ---------- Tasks ---------- */

export function listTasks(accountId, view = 'open') {
  const today = todayISO();
  const where = ['t.account_id = ?'];
  const args = [accountId];
  if (view === 'open') where.push("t.status = 'open'");
  else if (view === 'today') {
    where.push("t.status = 'open' AND t.due_on <= ?");
    args.push(today);
  } else if (view === 'done') where.push("t.status = 'done'");
  const order = view === 'done' ? 't.done_at DESC' : 't.due_on ASC, u.name';
  return db
    .prepare(
      `SELECT t.*, u.name AS unit_name, b.guest_name, b.check_in AS b_check_in
       FROM tasks t JOIN units u ON u.id = t.unit_id LEFT JOIN bookings b ON b.id = t.booking_id
       WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT 300`
    )
    .all(...args);
}

export function assignees(accountId) {
  return db
    .prepare(`SELECT DISTINCT assignee FROM tasks WHERE account_id = ? AND assignee IS NOT NULL AND assignee != '' ORDER BY assignee`)
    .all(accountId)
    .map((r) => r.assignee);
}

/* ---------- Guests ---------- */

export function listGuests(accountId, q = '') {
  const like = `%${q}%`;
  return db
    .prepare(
      `SELECT g.*,
         COUNT(b.id) AS stays,
         COALESCE(SUM(CASE WHEN b.status != 'cancelled' THEN b.total_amount ELSE 0 END), 0) AS spent,
         MAX(b.check_in) AS last_stay
       FROM guests g LEFT JOIN bookings b ON b.guest_id = g.id
       WHERE g.account_id = ? AND (? = '' OR g.name LIKE ? OR g.phone LIKE ?)
       GROUP BY g.id ORDER BY last_stay DESC NULLS LAST, g.name LIMIT 500`
    )
    .all(accountId, q, like, like);
}

export function getGuest(accountId, id) {
  const g = db.prepare('SELECT * FROM guests WHERE id = ? AND account_id = ?').get(id, accountId);
  if (!g) return null;
  g.bookings = db
    .prepare(
      `SELECT b.*, u.name AS unit_name FROM bookings b JOIN units u ON u.id = b.unit_id WHERE b.guest_id = ? ORDER BY b.check_in DESC`
    )
    .all(id);
  return g;
}
