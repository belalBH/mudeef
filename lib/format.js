// Formats a SQLite UTC timestamp in Riyadh time with Gregorian dates and Latin digits
export function when(ts, opts = { dateStyle: 'medium', timeStyle: 'short' }) {
  if (!ts) return '';
  return new Date(ts.replace(' ', 'T') + 'Z').toLocaleString('ar-SA-u-ca-gregory-nu-latn', { timeZone: 'Asia/Riyadh', ...opts });
}
