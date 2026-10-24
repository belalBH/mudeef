// All booking dates are stored as 'YYYY-MM-DD' strings and treated as plain calendar days (UTC math).

export function toISO(d) {
  return d.toISOString().slice(0, 10);
}

export function parseISO(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function addDays(s, n) {
  const d = parseISO(s);
  d.setUTCDate(d.getUTCDate() + n);
  return toISO(d);
}

export function diffDays(a, b) {
  return Math.round((parseISO(b) - parseISO(a)) / 86400000);
}

export function todayISO() {
  // Business days follow Saudi time
  const now = new Date(Date.now() + 3 * 3600 * 1000);
  return toISO(now);
}

export function monthStart(s) {
  return s.slice(0, 7) + '-01';
}

export function daysInMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function addMonths(ym, n) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return toISO(d).slice(0, 7);
}

// Nights of [checkIn, checkOut) that fall inside [from, to)
export function overlapNights(checkIn, checkOut, from, to) {
  const s = checkIn > from ? checkIn : from;
  const e = checkOut < to ? checkOut : to;
  return Math.max(0, diffDays(s, e));
}

const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const WEEKDAYS_AR = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

export function monthName(ym) {
  const [y, m] = ym.split('-').map(Number);
  return `${MONTHS_AR[m - 1]} ${y}`;
}

export function monthShort(m) {
  return MONTHS_AR[m - 1];
}

export function weekday(s) {
  return WEEKDAYS_AR[parseISO(s).getUTCDay()];
}

export function isWeekend(s) {
  const d = parseISO(s).getUTCDay();
  return d === 4 || d === 5; // Thursday & Friday nights are the Saudi weekend peak
}

export function prettyDate(s) {
  if (!s) return '';
  const d = parseISO(s);
  return `${d.getUTCDate()} ${MONTHS_AR[d.getUTCMonth()]}`;
}

export function nightsLabel(n) {
  if (n === 1) return 'ليلة واحدة';
  if (n === 2) return 'ليلتان';
  if (n >= 3 && n <= 10) return `${n} ليالٍ`;
  return `${n} ليلة`;
}
