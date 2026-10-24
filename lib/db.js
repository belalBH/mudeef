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

function open() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  return db;
}

// Reuse one connection across hot reloads in development
const globalForDb = globalThis;
export const db = globalForDb.__mudeefDb || (globalForDb.__mudeefDb = open());
