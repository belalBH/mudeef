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
db.prepare("DELETE FROM users WHERE email IN ('cleaner@mudeef.sa', 'manager@mudeef.sa')").run();
if (!db.prepare('PRAGMA table_info(owners)').all().length) {
  console.error('Database is on an older version. Start the app once so it upgrades, then run the seed.');
  process.exit(1);
}

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
    .prepare(`INSERT INTO accounts (name, phone, address, checkin_time, checkout_time, invoice_note, cleaning_fee, slug, booking_enabled, booking_intro) VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .run(
      'استوديوهات الروضة', '0550000000', 'جدة، حي الروضة', '15:00', '12:00', 'الإلغاء مجاني قبل 48 ساعة من الوصول. شكراً لإقامتكم.', 60,
      db.prepare("SELECT 1 FROM accounts WHERE slug = 'rawda'").get() ? null : 'rawda', 1,
      'استوديوهات وشقق مفروشة بالكامل في حي الروضة بجدة، دخول ذاتي وقريبة من الخدمات. احجز مباشرة بأفضل سعر.'
    )
    .lastInsertRowid;
  const hash = bcrypt.hashSync('demo1234', 10);
  db.prepare('INSERT INTO users (account_id, name, email, password_hash, role) VALUES (?,?,?,?,?)').run(acc, 'بلال', email, hash, 'owner');
  db.prepare('INSERT INTO users (account_id, name, email, password_hash, role, phone) VALUES (?,?,?,?,?,?)').run(acc, 'أم سالم', 'cleaner@mudeef.sa', hash, 'cleaner', '0559000001');
  db.prepare('INSERT INTO users (account_id, name, email, password_hash, role) VALUES (?,?,?,?,?)').run(acc, 'سعد المدير', 'manager@mudeef.sa', hash, 'manager');
  const ownerId = Number(
    db.prepare('INSERT INTO owners (account_id, name, phone, iban, fee_pct, notes) VALUES (?,?,?,?,?,?)').run(
      acc, 'أبو فيصل', '0551112233', 'SA4420000001234567891234', 20, 'يملك شقة الزهراء'
    ).lastInsertRowid
  );

  const units = [
    ['استوديو 1', 'studio', 'جدة - الروضة', 2, 280, 350, 'الدور الثاني، شقة 4. رمز القفل يُرسل يوم الوصول. الواي فاي: Rawda-1'],
    ['استوديو 2', 'studio', 'جدة - الروضة', 2, 280, 350, 'الدور الثاني، شقة 5. الواي فاي: Rawda-2'],
    ['غرفة عائلية', 'room', 'جدة - الروضة', 4, 380, 450, 'الدور الأول، المدخل الجانبي.'],
    ['شقة غرفتين', 'apartment', 'جدة - الزهراء', 5, 520, 650, 'عمارة 12، الدور الثالث. موقف خاص رقم 7.'],
  ].map(([name, type, city, cap, p, wp, info], i) =>
    Number(
      db.prepare(
        `INSERT INTO units (account_id,name,type,city,capacity,base_price,weekend_price,checkin_info,export_token,description,amenities,house_rules,wifi_name,wifi_password,map_url,bedrooms,owner_id)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      ).run(
        acc, name, type, city, cap, p, wp, info, tok(),
        ['استوديو هادئ بسرير كوين ومطبخ صغير وجلسة عمل، مناسب للأزواج ورحلات العمل.', 'استوديو مطل على الشارع بإضاءة طبيعية، سرير كوين ومطبخ مجهز.', 'غرفة واسعة بسريرين مزدوجين، مناسبة للعوائل الصغيرة.', 'شقة بغرفتي نوم وصالة ومطبخ كامل وموقف خاص، مثالية للعوائل.'][i],
        ['واي فاي، مطبخ، دخول ذاتي، مكيف، تلفزيون ذكي', 'واي فاي، مطبخ، دخول ذاتي، مكيف', 'واي فاي، ثلاجة، مكيف، سريران', 'واي فاي، مطبخ كامل، غسالة، موقف سيارة، دخول ذاتي'][i],
        'ممنوع التدخين داخل الوحدة. الهدوء بعد 11 مساءً. الحفلات غير مسموحة.',
        `Rawda-${i + 1}`, `rawda${2026 + i}`, 'https://maps.app.goo.gl/example', [0, 0, 1, 2][i], i === 3 ? ownerId : null
      ).lastInsertRowid
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
  // A monthly tenant with an installment plan
  const monthly = Number(
    ins.run(acc, units[1], 'direct', guestIds[3], people[3][0], people[3][1], 1, day(60), day(150), 21600, 0, 'upcoming').lastInsertRowid
  );
  pay.run(acc, monthly, 7200, 'transfer', TODAY, 'الدفعة الأولى مقدماً');
  task.run(acc, units[1], monthly, day(150), 'open', null, null);
  for (let i = 0; i < 3; i++)
    db.prepare('INSERT INTO installments (account_id, booking_id, due_on, amount, note) VALUES (?,?,?,?,?)').run(acc, monthly, day(60 + i * 30), 7200, `دفعة ${i + 1} من 3`);
  db.prepare(`UPDATE bookings SET security_deposit = 1000, deposit_status = 'held' WHERE id = ?`).run(monthly);
  // Requests waiting from the direct booking page
  ins.run(acc, units[2], 'direct', guestIds[6], people[6][0], people[6][1], 3, day(50), day(53), 1270, 0, 'upcoming');
  db.prepare(`UPDATE bookings SET status = 'pending', request_note = 'بنوصل متأخر حوالي الساعة 11 بالليل' WHERE id = last_insert_rowid()`).run();
  ins.run(acc, units[0], 'direct', null, 'Sara Ahmed', '0567778899', 2, day(47), day(50), 900, 0, 'upcoming');
  db.prepare(`UPDATE bookings SET status = 'pending' WHERE id = last_insert_rowid()`).run();
  // Extra charges and a discount on a few stays
  const sample = db.prepare(`SELECT id FROM bookings WHERE account_id = ? AND source = 'direct' AND status = 'confirmed' AND check_out < ? ORDER BY id DESC LIMIT 3`).all(acc, TODAY);
  for (const [i, b] of sample.entries()) {
    const [kind, label, amt] = [['fee', 'رسوم تنظيف', 80], ['extra', 'سرير إضافي', 60], ['discount', 'خصم عميل متكرر', -50]][i];
    db.prepare('INSERT INTO booking_items (account_id, booking_id, kind, label, amount) VALUES (?,?,?,?,?)').run(acc, b.id, kind, label, amt);
    db.prepare('UPDATE bookings SET total_amount = total_amount + ? WHERE id = ?').run(amt, b.id);
    if (amt > 0) pay.run(acc, b.id, amt, 'cash', TODAY, label);
  }
  // Reviews from past guests
  const past = db.prepare(`SELECT id FROM bookings WHERE account_id = ? AND status = 'confirmed' AND check_out < ? AND source != 'block' ORDER BY check_out DESC LIMIT 14`).all(acc, TODAY);
  const comments = ['المكان نظيف والدخول سهل', 'تجربة ممتازة وسنعود', null, 'المكيف يحتاج صيانة لكن الباقي ممتاز', 'قريب من كل شي', null, 'المضيف متعاون جداً'];
  for (const [i, b] of past.entries()) {
    if (i % 2) continue;
    db.prepare('INSERT INTO reviews (account_id, booking_id, rating, cleanliness, comment) VALUES (?,?,?,?,?)').run(acc, b.id, [5, 5, 4, 5, 3, 4, 5][i % 7], [5, 4, 5, 5, 4, 4, 5][i % 7], comments[i % 7]);
  }
  // A registered upcoming guest
  const reg = db.prepare(`SELECT id, guest_id FROM bookings WHERE account_id = ? AND status = 'confirmed' AND check_in > ? AND guest_id IS NOT NULL ORDER BY check_in LIMIT 1`).get(acc, TODAY);
  if (reg) {
    db.prepare(`UPDATE guests SET id_type = 'national', id_number = '1098765432', nationality = 'سعودي' WHERE id = ?`).run(reg.guest_id);
    db.prepare(`UPDATE bookings SET registered_at = datetime('now'), arrival_time = '16:30' WHERE id = ?`).run(reg.id);
  }
  // Recurring monthly costs
  db.prepare('INSERT INTO recurring_expenses (account_id, unit_id, category, amount, day_of_month, note, last_period) VALUES (?,?,?,?,?,?,?)').run(acc, units[3], 'rent', 3500, 1, 'إيجار الشقة', TODAY.slice(0, 7));
  db.prepare('INSERT INTO recurring_expenses (account_id, unit_id, category, amount, day_of_month, note, last_period) VALUES (?,?,?,?,?,?,?)').run(acc, null, 'utilities', 300, 5, 'إنترنت الألياف', TODAY.slice(0, 7));
  db.prepare('INSERT INTO recurring_expenses (account_id, unit_id, category, amount, day_of_month, note, last_period) VALUES (?,?,?,?,?,?,?)').run(acc, null, 'salaries', 2500, 27, 'راتب عاملة النظافة', TODAY.slice(0, 7));
  // Some history in the activity log
  const act = db.prepare('INSERT INTO activity (account_id, user_name, action, booking_id, created_at) VALUES (?,?,?,?,?)');
  act.run(acc, 'سعد المدير', `سجّل دفعة 7200 ر.س (تحويل بنكي) لـ ${people[3][0]}`, monthly, `${TODAY} 09:12:00`);
  act.run(acc, 'أم سالم', 'أنهت تنظيف غرفة عائلية', null, `${TODAY} 08:40:00`);
  act.run(acc, 'صفحة الحجز', `طلب حجز جديد من ${people[6][0]}`, null, `${TODAY} 07:05:00`);

  // A maintenance block
  db.prepare(`INSERT INTO bookings (account_id, unit_id, source, check_in, check_out, notes) VALUES (?,?,?,?,?,?)`).run(acc, units[2], 'block', day(20), day(23), 'صيانة المكيف');
  db.prepare(`INSERT INTO tasks (account_id, unit_id, type, title, due_on, assignee) VALUES (?,?,?,?,?,?)`).run(acc, units[2], 'maintenance', 'تصليح المكيف', day(20), 'فني التكييف');

  // Bookings are usually made a week or two before arrival
  db.prepare(`UPDATE bookings SET created_at = datetime(check_in, '-' || (8 + id % 12) || ' days') WHERE account_id = ?`).run(acc);
  db.prepare(`UPDATE bookings SET created_at = datetime('now', '-1 hours') WHERE account_id = ? AND created_at > datetime('now')`).run(acc);
  for (const r of db.prepare('SELECT id FROM bookings WHERE account_id = ?').all(acc))
    db.prepare('UPDATE bookings SET paid_amount = COALESCE((SELECT SUM(amount) FROM payments WHERE booking_id = ?),0) WHERE id = ?').run(r.id, r.id);

  const rows = db.prepare(`SELECT id, unit_id, check_in, check_out FROM bookings WHERE account_id = ? AND status = 'confirmed' ORDER BY unit_id, check_in`).all(acc);
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
