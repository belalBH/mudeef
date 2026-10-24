// Creates a demo account with sample data: npm run seed
// Login: demo@mudeef.sa / demo1234
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'mudeef.db');
if (!fs.existsSync(DB_PATH)) {
  console.error('Database not found. Start the app once (npm run dev / npm start) so the tables are created, then run the seed.');
  process.exit(1);
}
const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');
const cols = db.prepare('PRAGMA table_info(bookings)').all().map((c) => c.name);
if (!cols.includes('stay_status')) {
  console.error('Database is on an older version. Start the app once so it upgrades, then run the seed.');
  process.exit(1);
}

const email = 'demo@mudeef.sa';
const old = db.prepare('SELECT account_id FROM users WHERE email = ?').get(email);
if (old) db.prepare('DELETE FROM accounts WHERE id = ?').run(old.account_id);

const tok = () => crypto.randomBytes(18).toString('base64url');
const iso = (d) => d.toISOString().slice(0, 10);
const today = new Date(Date.now() + 3 * 3600e3);
today.setUTCHours(0, 0, 0, 0);
const TODAY = iso(today);
const day = (n) => {
  const d = new Date(today);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
};

const seed = db.transaction(() => {
  const acc = db
    .prepare(`INSERT INTO accounts (name, phone, address, checkin_time, checkout_time, invoice_note, cleaning_fee) VALUES (?,?,?,?,?,?,?)`)
    .run('استوديوهات الروضة', '0550000000', 'جدة، حي الروضة', '15:00', '12:00', 'الإلغاء مجاني قبل 48 ساعة من الوصول. شكراً لإقامتكم.', 60)
    .lastInsertRowid;
  db.prepare('INSERT INTO users (account_id, name, email, password_hash) VALUES (?,?,?,?)').run(acc, 'بلال', email, bcrypt.hashSync('demo1234', 10));

  const units = [
    ['استوديو 1', 'studio', 'جدة - الروضة', 2, 280, 350, 'الدور الثاني، شقة 4. رمز القفل يُرسل يوم الوصول. الواي فاي: Rawda-1'],
    ['استوديو 2', 'studio', 'جدة - الروضة', 2, 280, 350, 'الدور الثاني، شقة 5. الواي فاي: Rawda-2'],
    ['غرفة عائلية', 'room', 'جدة - الروضة', 4, 380, 450, 'الدور الأول، المدخل الجانبي.'],
    ['شقة غرفتين', 'apartment', 'جدة - الزهراء', 5, 520, 650, 'عمارة 12، الدور الثالث. موقف خاص رقم 7.'],
  ].map(([name, type, city, cap, p, wp, info]) =>
    Number(
      db.prepare(
        'INSERT INTO units (account_id,name,type,city,capacity,base_price,weekend_price,checkin_info,export_token) VALUES (?,?,?,?,?,?,?,?,?)'
      ).run(acc, name, type, city, cap, p, wp, info, tok()).lastInsertRowid
    )
  );

  const rates = { airbnb: 3, booking: 15, gathern: 10 };
  for (const u of units)
    for (const [src, rate] of Object.entries(rates))
      db.prepare('INSERT INTO channels (account_id,unit_id,source,export_token,commission_rate) VALUES (?,?,?,?,?)').run(acc, u, src, tok(), rate);

  db.prepare('INSERT INTO season_rates (account_id, unit_id, name, start_on, end_on, price, weekend_price, min_nights) VALUES (?,?,?,?,?,?,?,?)').run(
    acc, null, 'إجازة منتصف العام', day(70), day(84), 420, 480, 2
  );
  db.prepare('INSERT INTO season_rates (account_id, unit_id, name, start_on, end_on, price, weekend_price, min_nights) VALUES (?,?,?,?,?,?,?,?)').run(
    acc, units[3], 'موسم الشتاء', day(30), day(60), 600, 720, 1
  );

  const people = [
    ['محمد العتيبي', '0551234001'], ['سارة القحطاني', '0551234002'], ['Ahmed Hassan', '0551234003'], ['عبدالله الشهري', '0551234004'],
    ['Emily Clark', null], ['فهد الزهراني', '0551234006'], ['نورة المالكي', '0551234007'], ['خالد الغامدي', '0551234008'],
    ['ريم الحربي', '0551234009'], ['Omar Farouk', '0551234010'], ['تركي الدوسري', '0551234011'], ['هند السبيعي', '0551234012'],
  ];
  const guestIds = people.map(([n, p]) => Number(db.prepare('INSERT INTO guests (account_id, name, phone) VALUES (?,?,?)').run(acc, n, p).lastInsertRowid));
  db.prepare('UPDATE guests SET blacklisted = 1, notes = ? WHERE id = ?').run('ترك الوحدة بحالة سيئة في زيارة سابقة', guestIds[9]);

  const sources = ['airbnb', 'booking', 'gathern', 'direct', 'gathern', 'airbnb'];
  const methods = { direct: 'cash', airbnb: 'platform', booking: 'transfer', gathern: 'platform' };
  const ins = db.prepare(
    `INSERT INTO bookings (account_id,unit_id,source,guest_id,guest_name,guest_phone,guests,check_in,check_out,total_amount,commission,stay_status)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
  );
  const pay = db.prepare('INSERT INTO payments (account_id, booking_id, amount, method, paid_on, note) VALUES (?,?,?,?,?,?)');
  const task = db.prepare(
    `INSERT INTO tasks (account_id, unit_id, booking_id, type, title, due_on, status, assignee, done_at) VALUES (?,?,?,'cleaning','تنظيف بعد خروج الضيف',?,?,?,?)`
  );
  const cleaners = ['أم سالم', 'فريق النظافة'];
  let k = 0;
  for (const [ui, u] of units.entries()) {
    let cursor = -150 + ui * 3;
    while (cursor < 45) {
      const nights = 1 + ((k * 7 + ui) % 5);
      const gap = (k * 3 + ui) % 4;
      const src = sources[(k + ui) % sources.length];
      const price = Math.round([280, 280, 380, 520][ui] * nights * (1 + ((k % 3) - 1) * 0.1));
      const commission = src === 'direct' ? 0 : Math.round(price * rates[src]) / 100;
      const gi = k % people.length;
      const ci = day(cursor);
      const co = day(cursor + nights);
      const stay = co <= TODAY ? 'checked_out' : ci < TODAY ? 'checked_in' : ci === TODAY && k % 2 ? 'checked_in' : 'upcoming';
      const id = Number(ins.run(acc, u, src, guestIds[gi], people[gi][0], people[gi][1], 1 + (k % 3), ci, co, price, commission, stay).lastInsertRowid);
      if (co <= TODAY) pay.run(acc, id, price, methods[src], ci, null);
      else if (k % 3 === 0) pay.run(acc, id, Math.round(price / 2), methods[src], ci < TODAY ? ci : TODAY, 'عربون');
      const done = co < TODAY;
      task.run(acc, u, id, co, done ? 'done' : 'open', cleaners[k % 2], done ? co + ' 14:00:00' : null);
      cursor += nights + gap;
      k++;
    }
  }
  // One overlapping stay so the double-booking warning is visible
  const extra = Number(ins.run(acc, units[0], 'booking', null, 'Liam Walker', null, 2, day(2), day(4), 600, 90, 'upcoming').lastInsertRowid);
  task.run(acc, units[0], extra, day(4), 'open', null, null);
  // A maintenance block
  db.prepare(`INSERT INTO bookings (account_id, unit_id, source, check_in, check_out, notes) VALUES (?,?,?,?,?,?)`).run(acc, units[2], 'block', day(20), day(23), 'صيانة المكيف');
  db.prepare(`INSERT INTO tasks (account_id, unit_id, type, title, due_on, assignee) VALUES (?,?,?,?,?,?)`).run(acc, units[2], 'maintenance', 'تصليح المكيف', day(20), 'فني التكييف');

  // Bookings are usually made a week or two before arrival
  db.prepare(`UPDATE bookings SET created_at = datetime(check_in, '-' || (8 + id % 12) || ' days') WHERE account_id = ?`).run(acc);
  db.prepare(`UPDATE bookings SET created_at = datetime('now', '-1 hours') WHERE account_id = ? AND created_at > datetime('now')`).run(acc);
  for (const r of db.prepare('SELECT id FROM bookings WHERE account_id = ?').all(acc))
    db.prepare('UPDATE bookings SET paid_amount = COALESCE((SELECT SUM(amount) FROM payments WHERE booking_id = ?),0) WHERE id = ?').run(r.id, r.id);

  const rows = db.prepare(`SELECT id, unit_id, check_in, check_out FROM bookings WHERE account_id = ? AND status != 'cancelled' ORDER BY unit_id, check_in`).all(acc);
  for (let i = 0; i < rows.length; i++)
    for (let j = i + 1; j < rows.length && rows[j].unit_id === rows[i].unit_id; j++)
      if (rows[j].check_in < rows[i].check_out) db.prepare('UPDATE bookings SET conflict = 1 WHERE id IN (?, ?)').run(rows[i].id, rows[j].id);

  // Expenses over the last five months
  const exp = db.prepare('INSERT INTO expenses (account_id, unit_id, category, amount, spent_on, note) VALUES (?,?,?,?,?,?)');
  for (let m = 0; m < 5; m++) {
    const base = -m * 30;
    exp.run(acc, null, 'utilities', 900 + m * 40, day(base - 2), 'كهرباء وماء وإنترنت');
    exp.run(acc, null, 'supplies', 350, day(base - 8), 'مستلزمات ضيافة');
    exp.run(acc, units[3], 'rent', 3500, day(base - 1), 'إيجار الشقة');
    exp.run(acc, null, 'laundry', 420, day(base - 14), 'غسيل مفارش');
    if (m % 2 === 0) exp.run(acc, units[m % 4], 'maintenance', 250 + m * 60, day(base - 5), 'صيانة سباكة');
  }
  return k + 1;
});

const n = seed();
console.log(`Seeded ${n} bookings across 4 units with guests, payments, expenses and tasks. Login: ${email} / demo1234`);
