import 'server-only';
import { db } from './db';
import { addDays, daysInMonth, diffDays, overlapNights, todayISO } from './dates';

/* ---------- Requests ---------- */

export function pendingRequests(accountId) {
  return db
    .prepare(
      `SELECT b.*, u.name AS unit_name FROM bookings b JOIN units u ON u.id = b.unit_id
       WHERE b.account_id = ? AND b.status = 'pending' ORDER BY b.created_at DESC`
    )
    .all(accountId);
}

/* ---------- Team & activity ---------- */

export function teamMembers(accountId) {
  return db.prepare('SELECT id, name, email, role, active, phone, created_at FROM users WHERE account_id = ? ORDER BY active DESC, role, name').all(accountId);
}

export function activity(accountId, { limit = 100, bookingId = null } = {}) {
  if (bookingId) return db.prepare('SELECT * FROM activity WHERE account_id = ? AND booking_id = ? ORDER BY id DESC LIMIT ?').all(accountId, bookingId, limit);
  return db.prepare('SELECT * FROM activity WHERE account_id = ? ORDER BY id DESC LIMIT ?').all(accountId, limit);
}

/* ---------- Units ---------- */

export function unitPhotos(unitId) {
  return db.prepare('SELECT * FROM unit_photos WHERE unit_id = ? ORDER BY sort, id').all(unitId);
}

export function coverPhotos(accountId) {
  const rows = db.prepare('SELECT unit_id, file FROM unit_photos WHERE account_id = ? ORDER BY sort, id').all(accountId);
  const map = {};
  for (const r of rows) map[r.unit_id] ||= r.file;
  return map;
}

/* ---------- Booking extras ---------- */

export function bookingItems(bookingId) {
  return db.prepare('SELECT * FROM booking_items WHERE booking_id = ? ORDER BY id').all(bookingId);
}

// Each installment is "paid" once total payments cover it and everything due before it
export function installmentSchedule(booking) {
  const rows = db.prepare('SELECT * FROM installments WHERE booking_id = ? ORDER BY due_on, id').all(booking.id);
  let covered = booking.paid_amount;
  const today = todayISO();
  return rows.map((r) => {
    const paid = Math.min(r.amount, Math.max(0, covered));
    covered -= r.amount;
    const state = paid >= r.amount - 0.5 ? 'paid' : r.due_on < today ? 'late' : r.due_on === today ? 'due' : 'upcoming';
    return { ...r, paid, state };
  });
}

export function dueInstallments(accountId) {
  const today = todayISO();
  const books = db
    .prepare(
      `SELECT DISTINCT b.*, u.name AS unit_name FROM bookings b JOIN units u ON u.id = b.unit_id JOIN installments i ON i.booking_id = b.id
       WHERE b.account_id = ? AND b.status = 'confirmed' AND i.due_on <= ?`
    )
    .all(accountId, addDays(today, 3));
  const out = [];
  for (const b of books) {
    for (const i of installmentSchedule(b)) {
      if (i.state !== 'paid' && i.due_on <= addDays(today, 3)) out.push({ ...i, booking: b, left: i.amount - i.paid });
    }
  }
  return out.sort((a, b) => a.due_on.localeCompare(b.due_on));
}

export function bookingReview(bookingId) {
  return db.prepare('SELECT * FROM reviews WHERE booking_id = ?').get(bookingId);
}

/* ---------- Reviews ---------- */

export function reviewStats(accountId, from = null, to = null) {
  const where = from ? 'AND b.check_out >= ? AND b.check_out < ?' : '';
  const args = from ? [accountId, from, to] : [accountId];
  const s = db
    .prepare(
      `SELECT COUNT(*) n, AVG(r.rating) avg, AVG(r.cleanliness) clean FROM reviews r JOIN bookings b ON b.id = r.booking_id
       WHERE r.account_id = ? ${where}`
    )
    .get(...args);
  const latest = db
    .prepare(
      `SELECT r.*, b.guest_name, b.check_out, u.name AS unit_name FROM reviews r JOIN bookings b ON b.id = r.booking_id JOIN units u ON u.id = b.unit_id
       WHERE r.account_id = ? ORDER BY r.id DESC LIMIT 6`
    )
    .all(accountId);
  return { ...s, latest };
}

/* ---------- Owners ---------- */

export function listOwners(accountId) {
  return db
    .prepare(
      `SELECT o.*, (SELECT COUNT(*) FROM units u WHERE u.owner_id = o.id) AS unit_count
       FROM owners o WHERE o.account_id = ? ORDER BY o.name`
    )
    .all(accountId);
}

export function getOwner(accountId, id) {
  return db.prepare('SELECT * FROM owners WHERE id = ? AND account_id = ?').get(id, accountId);
}

// Monthly statement: what the managed units earned, what they cost, the management fee, and what the owner is owed
export function ownerStatement(accountId, ownerId, ym) {
  const owner = getOwner(accountId, ownerId);
  if (!owner) return null;
  const from = `${ym}-01`;
  const to = addDays(from, daysInMonth(ym));
  const units = db.prepare('SELECT id, name FROM units WHERE owner_id = ? AND account_id = ? ORDER BY name').all(ownerId, accountId);
  const ids = units.map((u) => u.id);
  const stays = ids.length
    ? db
        .prepare(
          `SELECT b.*, u.name AS unit_name FROM bookings b JOIN units u ON u.id = b.unit_id
           WHERE b.unit_id IN (${ids.map(() => '?').join(',')}) AND b.status = 'confirmed' AND b.source != 'block'
             AND b.check_in < ? AND b.check_out > ? ORDER BY b.check_in`
        )
        .all(...ids, to, from)
    : [];
  const lines = stays.map((b) => {
    const total = diffDays(b.check_in, b.check_out);
    const n = overlapNights(b.check_in, b.check_out, from, to);
    const share = total ? n / total : 0;
    return {
      ...b,
      nights_in: n,
      gross: b.total_amount * share,
      commission_in: b.commission * share,
      net: (b.total_amount - b.commission) * share,
    };
  });
  const expenses = ids.length
    ? db
        .prepare(
          `SELECT e.*, u.name AS unit_name FROM expenses e JOIN units u ON u.id = e.unit_id
           WHERE e.unit_id IN (${ids.map(() => '?').join(',')}) AND e.spent_on >= ? AND e.spent_on < ? ORDER BY e.spent_on`
        )
        .all(...ids, from, to)
    : [];
  const gross = lines.reduce((a, l) => a + l.gross, 0);
  const commissions = lines.reduce((a, l) => a + l.commission_in, 0);
  const net = gross - commissions;
  const expTotal = expenses.reduce((a, e) => a + e.amount, 0);
  const fee = (net * owner.fee_pct) / 100;
  const payable = net - fee - expTotal;
  const nights = lines.reduce((a, l) => a + l.nights_in, 0);
  const payout = db.prepare('SELECT * FROM owner_payouts WHERE owner_id = ? AND period = ?').get(ownerId, ym);
  return {
    owner,
    units,
    lines,
    expenses,
    gross,
    commissions,
    net,
    expTotal,
    fee,
    payable,
    nights,
    occupancy: units.length ? nights / (units.length * daysInMonth(ym)) : 0,
    payout,
  };
}

export function ownerPayouts(accountId, ownerId) {
  return db.prepare('SELECT * FROM owner_payouts WHERE owner_id = ? AND account_id = ? ORDER BY period DESC').all(ownerId, accountId);
}

/* ---------- Recurring expenses ---------- */

export function listRecurring(accountId) {
  return db
    .prepare(
      `SELECT r.*, u.name AS unit_name FROM recurring_expenses r LEFT JOIN units u ON u.id = r.unit_id
       WHERE r.account_id = ? ORDER BY r.active DESC, r.day_of_month`
    )
    .all(accountId);
}

export { runRecurring } from './recurring';

/* ---------- Search ---------- */

export function search(accountId, q) {
  const term = q.trim();
  if (!term) return { bookings: [], guests: [], units: [] };
  const like = `%${term}%`;
  const digits = term.replace(/\D/g, '');
  const bookings = db
    .prepare(
      `SELECT b.*, u.name AS unit_name FROM bookings b JOIN units u ON u.id = b.unit_id
       WHERE b.account_id = ? AND b.source != 'block'
         AND (b.guest_name LIKE ? OR b.guest_phone LIKE ? OR CAST(b.id AS TEXT) = ? OR b.notes LIKE ?)
       ORDER BY b.check_in DESC LIMIT 30`
    )
    .all(accountId, like, digits ? `%${digits}%` : like, term.replace(/^#/, ''), like);
  const guests = db
    .prepare(`SELECT * FROM guests WHERE account_id = ? AND (name LIKE ? OR phone LIKE ? OR email LIKE ? OR id_number = ?) ORDER BY name LIMIT 20`)
    .all(accountId, like, digits ? `%${digits}%` : like, like, term);
  const units = db.prepare('SELECT * FROM units WHERE account_id = ? AND (name LIKE ? OR city LIKE ?) LIMIT 10').all(accountId, like, like);
  return { bookings, guests, units };
}

/* ---------- Public pages ---------- */

export function publicAccount(slug) {
  return db.prepare('SELECT * FROM accounts WHERE slug = ? AND booking_enabled = 1').get(slug);
}

export function publicUnits(accountId) {
  return db.prepare('SELECT * FROM units WHERE account_id = ? AND active = 1 AND public = 1 ORDER BY base_price, name').all(accountId);
}

export function bookingByToken(token) {
  if (!/^[A-Za-z0-9_-]{16,40}$/.test(token || '')) return null;
  return db
    .prepare(
      `SELECT b.*, u.name AS unit_name, u.checkin_info, u.map_url, u.house_rules, u.wifi_name, u.wifi_password, u.city,
         a.name AS account_name, a.phone AS account_phone, a.checkin_time, a.checkout_time,
         g.id_type, g.id_number, g.nationality, g.birth_date
       FROM bookings b JOIN units u ON u.id = b.unit_id JOIN accounts a ON a.id = b.account_id LEFT JOIN guests g ON g.id = b.guest_id
       WHERE b.guest_token = ?`
    )
    .get(token);
}
