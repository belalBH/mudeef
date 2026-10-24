// Creates a demo account with sample units and bookings: npm run seed
// Login: demo@mudeef.sa / demo1234
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'mudeef.db');
if (!fs.existsSync(DB_PATH)) {
  console.error('Database not found. Start the app once (npm run dev) so the tables are created, then run the seed.');
  process.exit(1);
}
const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

const email = 'demo@mudeef.sa';
const old = db.prepare('SELECT account_id FROM users WHERE email = ?').get(email);
if (old) db.prepare('DELETE FROM accounts WHERE id = ?').run(old.account_id);

const tok = () => crypto.randomBytes(18).toString('base64url');
const iso = (d) => d.toISOString().slice(0, 10);
const today = new Date(Date.now() + 3 * 3600e3);
today.setUTCHours(0, 0, 0, 0);
const day = (n) => {
  const d = new Date(today);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
};

const acc = db.prepare('INSERT INTO accounts (name) VALUES (?)').run('استوديوهات الروضة').lastInsertRowid;
db.prepare('INSERT INTO users (account_id, name, email, password_hash) VALUES (?,?,?,?)').run(
  acc, 'بلال', email, bcrypt.hashSync('demo1234', 10)
);

const units = [
  ['استوديو 1', 'studio', 'جدة - الروضة', 2, 280, 350],
  ['استوديو 2', 'studio', 'جدة - الروضة', 2, 280, 350],
  ['غرفة عائلية', 'room', 'جدة - الروضة', 4, 380, 450],
  ['شقة غرفتين', 'apartment', 'جدة - الزهراء', 5, 520, 650],
].map(([name, type, city, cap, p, wp]) =>
  Number(
    db.prepare(
      'INSERT INTO units (account_id,name,type,city,capacity,base_price,weekend_price,export_token) VALUES (?,?,?,?,?,?,?,?)'
    ).run(acc, name, type, city, cap, p, wp, tok()).lastInsertRowid
  )
);

const rates = { airbnb: 3, booking: 15, gathern: 10 };
for (const u of units)
  for (const [src, rate] of Object.entries(rates))
    db.prepare('INSERT INTO channels (account_id,unit_id,source,export_token,commission_rate) VALUES (?,?,?,?,?)').run(acc, u, src, tok(), rate);

const names = ['محمد العتيبي', 'سارة القحطاني', 'Ahmed Hassan', 'عبدالله الشهري', 'Emily Clark', 'فهد الزهراني', 'نورة المالكي', 'خالد الغامدي', 'ريم الحربي', 'Omar Farouk', 'تركي الدوسري', 'هند السبيعي'];
const sources = ['airbnb', 'booking', 'gathern', 'direct', 'gathern', 'airbnb'];
const ins = db.prepare(
  `INSERT INTO bookings (account_id,unit_id,source,guest_name,guest_phone,guests,check_in,check_out,total_amount,commission,paid_amount)
   VALUES (?,?,?,?,?,?,?,?,?,?,?)`
);
let k = 0;
for (const [ui, u] of units.entries()) {
  let cursor = -150 + ui * 3;
  while (cursor < 45) {
    const nights = 1 + ((k * 7 + ui) % 5);
    const gap = (k * 3 + ui) % 4;
    const src = sources[(k + ui) % sources.length];
    const price = [280, 280, 380, 520][ui] * nights * (1 + ((k % 3) - 1) * 0.1);
    const commission = src === 'direct' ? 0 : Math.round(price * rates[src]) / 100;
    ins.run(acc, u, src, names[k % names.length], src === 'direct' ? '0550000' + String(100 + k).slice(-3) : null,
      1 + (k % 3), day(cursor), day(cursor + nights), Math.round(price), commission, cursor < 0 ? Math.round(price) : 0);
    cursor += nights + gap;
    k++;
  }
}
// One overlapping stay so the double-booking warning is visible
ins.run(acc, units[0], 'booking', 'Liam Walker', null, 2, day(2), day(4), 600, 90, 0);
const rows = db.prepare(`SELECT id, unit_id, check_in, check_out FROM bookings WHERE account_id = ? AND status != 'cancelled' ORDER BY unit_id, check_in`).all(acc);
for (let i = 0; i < rows.length; i++)
  for (let j = i + 1; j < rows.length && rows[j].unit_id === rows[i].unit_id; j++)
    if (rows[j].check_in < rows[i].check_out) db.prepare('UPDATE bookings SET conflict = 1 WHERE id IN (?, ?)').run(rows[i].id, rows[j].id);

console.log(`Seeded ${k + 1} bookings across ${units.length} units. Login: ${email} / demo1234`);
