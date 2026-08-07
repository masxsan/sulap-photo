const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const config = require('./config');

fs.mkdirSync(path.dirname(config.databasePath), { recursive: true });
fs.mkdirSync(config.storageDir, { recursive: true });

const db = new DatabaseSync(config.databasePath);

db.exec(`
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  credits INTEGER NOT NULL DEFAULT 0,
  provider_key TEXT DEFAULT '',
  provider_base_url TEXT DEFAULT '',
  provider_model TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS credit_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL,
  note TEXT DEFAULT '',
  job_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS uploads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  original_name TEXT NOT NULL,
  mime TEXT DEFAULT '',
  size INTEGER DEFAULT 0,
  path TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  feature_id TEXT NOT NULL,
  slot_index INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'queued',
  prompt TEXT DEFAULT '',
  model TEXT DEFAULT '',
  provider TEXT DEFAULT '',
  ratio TEXT DEFAULT '1:1',
  credit_cost INTEGER NOT NULL DEFAULT 0,
  error TEXT DEFAULT '',
  result_path TEXT DEFAULT '',
  result_mime TEXT DEFAULT 'image/png',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS job_inputs (
  batch_id TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  upload_id INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_jobs_batch ON jobs(batch_id);
CREATE INDEX IF NOT EXISTS idx_jobs_user ON jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_tx_user ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_job_inputs_batch ON job_inputs(batch_id);
`);

module.exports = db;
