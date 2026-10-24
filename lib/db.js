import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'mudeef.db');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'owner',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS units (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'studio',
  city TEXT,
  capacity INTEGER NOT NULL DEFAULT 2,
  base_price REAL NOT NULL DEFAULT 0,
  weekend_price REAL,
  notes TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  export_token TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS channels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  import_url TEXT,
  export_token TEXT NOT NULL UNIQUE,
  commission_rate REAL NOT NULL DEFAULT 0,
  last_sync_at TEXT,
  last_sync_status TEXT,
  last_sync_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(unit_id, source)
);

CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  channel_id INTEGER REFERENCES channels(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'direct',
  status TEXT NOT NULL DEFAULT 'confirmed',
  guest_name TEXT,
  guest_phone TEXT,
  guests INTEGER NOT NULL DEFAULT 1,
  check_in TEXT NOT NULL,
  check_out TEXT NOT NULL,
  total_amount REAL NOT NULL DEFAULT 0,
  commission REAL NOT NULL DEFAULT 0,
  paid_amount REAL NOT NULL DEFAULT 0,
  notes TEXT,
  imported INTEGER NOT NULL DEFAULT 0,
  external_uid TEXT,
  conflict INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_bookings_unit_dates ON bookings(unit_id, check_in, check_out);
CREATE INDEX IF NOT EXISTS idx_bookings_account ON bookings(account_id, check_in);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_external ON bookings(channel_id, external_uid) WHERE external_uid IS NOT NULL;
`;

const SCHEMA_V2 = `
CREATE TABLE IF NOT EXISTS guests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  nationality TEXT,
  notes TEXT,
  blacklisted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_guests_account ON guests(account_id, name);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  amount REAL NOT NULL,
  method TEXT NOT NULL DEFAULT 'cash',
  paid_on TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_payments_booking ON payments(booking_id);

CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  unit_id INTEGER REFERENCES units(id) ON DELETE SET NULL,
  category TEXT NOT NULL DEFAULT 'other',
  amount REAL NOT NULL,
  spent_on TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_expenses_account ON expenses(account_id, spent_on);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  booking_id INTEGER REFERENCES bookings(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'cleaning',
  title TEXT,
  due_on TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  assignee TEXT,
  note TEXT,
  done_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tasks_account ON tasks(account_id, status, due_on);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_booking ON tasks(booking_id, type) WHERE booking_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS season_rates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  unit_id INTEGER REFERENCES units(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_on TEXT NOT NULL,
  end_on TEXT NOT NULL,
  price REAL NOT NULL,
  weekend_price REAL,
  min_nights INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

// Columns added after the first release; each is added only when missing so existing databases upgrade in place
const COLUMNS = {
  accounts: {
    phone: 'TEXT',
    address: 'TEXT',
    vat_number: 'TEXT',
    checkin_time: "TEXT DEFAULT '15:00'",
    checkout_time: "TEXT DEFAULT '12:00'",
    invoice_note: 'TEXT',
    wa_confirm: 'TEXT',
    wa_checkin: 'TEXT',
    wa_thanks: 'TEXT',
    cleaning_fee: 'REAL DEFAULT 0',
  },
  bookings: {
    guest_id: 'INTEGER REFERENCES guests(id) ON DELETE SET NULL',
    stay_status: "TEXT NOT NULL DEFAULT 'upcoming'",
    checked_in_at: 'TEXT',
    checked_out_at: 'TEXT',
    cancel_reason: 'TEXT',
  },
  units: {
    checkin_info: 'TEXT',
  },
  expenses: {
    task_id: 'INTEGER REFERENCES tasks(id) ON DELETE SET NULL',
  },
};

function migrate(db) {
  db.exec(SCHEMA_V2);
  for (const [table, cols] of Object.entries(COLUMNS)) {
    const have = new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name));
    for (const [name, def] of Object.entries(cols)) {
      if (!have.has(name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${def}`);
    }
  }
  // Older bookings had a free paid_amount; turn it into a payment record once
  const legacy = db
    .prepare(
      `SELECT id, account_id, paid_amount, check_in FROM bookings
       WHERE paid_amount > 0 AND id NOT IN (SELECT booking_id FROM payments)`
    )
    .all();
  const ins = db.prepare(`INSERT INTO payments (account_id, booking_id, amount, method, paid_on, note) VALUES (?,?,?,?,?,?)`);
  for (const b of legacy) ins.run(b.account_id, b.id, b.paid_amount, 'other', b.check_in, 'رصيد سابق');
}

function open() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  migrate(db);
  return db;
}

// Reuse one connection across hot reloads in development
const globalForDb = globalThis;
export const db = globalForDb.__mudeefDb || (globalForDb.__mudeefDb = open());
