/**
 * db.js — SQLite database layer (better-sqlite3)
 *
 * මේ file එක **synchronous** API එකක් expose කරනවා, ඇයි කියන එක:
 * auth.js සහ billing.js ටික `db.prepare(sql).get(...) / .run(...)` කියන
 * better-sqlite3 style එකෙන් ලියලා තියෙනවා. better-sqlite3 එකේ
 * prepare/get/run/all ඔක්කොම සැබෑ synchronous — මේ ලොතරැයි app එකේ
 * පොඩි queries නිසා performance ඉතා හොඳයි.
 *
 * ⚠️ පරණ version එකේ තිබුණ ප්‍රශ්න:
 *   1. `sqlite3` package එක require කළා — ඒක install කරලා තිබුනේ නෑ,
 *      ඒ නිසා app එක load වෙනකොටම crash වුනා.
 *   2. `db.prepare().get()` කියන්නේ හිස් stub එකක් — කවදාවත් query එකක්
 *      run කළේ නෑ, හැමවෙලාවෙම `undefined` return කළා. ඒ නිසා
 *      register/login/quota/payment ඔක්කොම වැඩ කළේ නෑ.
 *   3. `.run()` එක `lastInsertRowid: Date.now()` කියලා ව්‍යාජ ID එකක්
 *      return කළා.
 */

'use strict';

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'app.db');

const db = new Database(DB_PATH);

// WAL = concurrent read + write, හොඳ crash-safety. Foreign keys off by default
// in SQLite — payments.userId reference එක enforce වෙන්න ඕන.
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

// ---------------------------------------------------------------
// Schema
// ---------------------------------------------------------------
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    email              TEXT UNIQUE NOT NULL,
    passwordHash       TEXT,
    googleId           TEXT UNIQUE,
    name               TEXT,
    plan               TEXT NOT NULL DEFAULT 'free',
    planExpiresAt      TEXT,
    scansUsedToday     INTEGER NOT NULL DEFAULT 0,
    scansUsedThisMonth INTEGER NOT NULL DEFAULT 0,
    lastScanDate       TEXT,
    lastScanMonth      TEXT,
    createdAt          TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- පොඩි key-value store — auto-scrape status එක වගේ දේවල්
  -- server restart උනත් රැකෙන්න.
  CREATE TABLE IF NOT EXISTS meta (
    key       TEXT PRIMARY KEY,
    value     TEXT,
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- ---------------------------------------------------------------
  -- draws — හැම ලොතරැයියකගේම සම්පූර්ණ ප්‍රතිඵල ඉතිහාසය (මාස 6+).
  -- data.json එකේ තියෙන දේම මෙතනට sync වෙනවා — ඒත් මෙතනින්
  -- දිනයක්/පරාසයක් අනුව ඉක්මනින් query කරන්න පුළුවන් (index තියෙන නිසා),
  -- සහ දත්ත වැඩි වුනත් වේගය රැකෙනවා.
  -- ---------------------------------------------------------------
  CREATE TABLE IF NOT EXISTS draws (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    slug        TEXT NOT NULL,
    provider    TEXT,
    lotteryName TEXT,
    drawNo      TEXT NOT NULL,
    date        TEXT,
    letter      TEXT,
    zodiac      TEXT,
    superNumber TEXT,
    numbers     TEXT,
    updatedAt   TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(slug, drawNo)
  );
  CREATE INDEX IF NOT EXISTS idx_draws_slug_date ON draws(slug, date);
  CREATE INDEX IF NOT EXISTS idx_draws_date      ON draws(date);

  CREATE TABLE IF NOT EXISTS payments (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    userId      INTEGER NOT NULL REFERENCES users(id),
    orderId     TEXT UNIQUE NOT NULL,
    plan        TEXT NOT NULL,
    amountRs    INTEGER NOT NULL,
    status      TEXT NOT NULL DEFAULT 'pending',
    payhereRaw  TEXT,
    createdAt   TEXT NOT NULL DEFAULT (datetime('now')),
    completedAt TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_payments_userId ON payments(userId);
  CREATE INDEX IF NOT EXISTS idx_users_googleId ON users(googleId);
  CREATE INDEX IF NOT EXISTS idx_users_email    ON users(email);

  -- ---------------------------------------------------------------
  -- checks — හැම ticket check එකක්ම (manual හෝ AI scan) මෙතන save වෙනවා.
  -- මේක තමයි user history, ලොතරැයි අනුව report එකයි admin panel එකේ
  -- statistics වලට පාදක වෙන data එක.
  -- ---------------------------------------------------------------
  CREATE TABLE IF NOT EXISTS checks (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    userId        INTEGER REFERENCES users(id),   -- guest නම් NULL
    slug          TEXT NOT NULL,
    provider      TEXT,
    lotteryName   TEXT,
    lotteryNameSi TEXT,
    drawNo        TEXT,
    drawDate      TEXT,
    tier          TEXT,
    prizeLabel    TEXT,
    won           INTEGER NOT NULL DEFAULT 0,
    prizeAmountRs REAL,
    letter        TEXT,
    zodiac        TEXT,
    superNumber   TEXT,
    numbers       TEXT,                            -- JSON array
    engine        TEXT,
    source        TEXT NOT NULL DEFAULT 'manual',  -- 'manual' | 'scan'
    createdAt     TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_checks_userId    ON checks(userId);
  CREATE INDEX IF NOT EXISTS idx_checks_slug      ON checks(slug);
  CREATE INDEX IF NOT EXISTS idx_checks_won       ON checks(won);
  CREATE INDEX IF NOT EXISTS idx_checks_createdAt ON checks(createdAt);

  -- ---------------------------------------------------------------
  -- profiles — "🍀 මගේ වාසනාව" (Lucky Guess) feature එකට ඕන උපන් විස්තර
  -- ---------------------------------------------------------------
  CREATE TABLE IF NOT EXISTS profiles (
    userId        INTEGER PRIMARY KEY REFERENCES users(id),
    fullName      TEXT,
    birthday      TEXT,     -- YYYY-MM-DD
    birthTime     TEXT,     -- HH:MM (24h ලෙස save වෙනවා)
    birthMeridiem TEXT,     -- 'AM' | 'PM' (user ලියපු විදිහ — display එකට)
    birthPlace    TEXT,
    updatedAt     TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- ---------------------------------------------------------------
  -- guesses — හැම "අනුමානය"ක්ම save වෙනවා (user history + audit)
  -- ---------------------------------------------------------------
  CREATE TABLE IF NOT EXISTS guesses (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    userId         INTEGER REFERENCES users(id),
    slug           TEXT NOT NULL,
    lotteryName    TEXT,
    provider       TEXT,
    drawNo         TEXT,
    drawDate       TEXT,
    numbers        TEXT,     -- JSON array
    letter         TEXT,
    zodiac         TEXT,
    superNumber    TEXT,
    confidence     TEXT,
    reasoning      TEXT,
    patternSummary TEXT,
    numerology     TEXT,     -- JSON
    model          TEXT,
    source         TEXT NOT NULL DEFAULT 'manual',   -- 'manual' | 'scan'
    aiUsed         INTEGER NOT NULL DEFAULT 0,
    createdAt      TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_guesses_userId    ON guesses(userId);
  CREATE INDEX IF NOT EXISTS idx_guesses_slug      ON guesses(slug);
  CREATE INDEX IF NOT EXISTS idx_guesses_createdAt ON guesses(createdAt);
`);

// ---------------------------------------------------------------
// පොඩි migrations — පරණ DB file එකක් තිබ්බත් අලුත් columns එකතු වෙනවා.
// (CREATE TABLE IF NOT EXISTS එකෙන් පරණ table එකට අලුත් column එකක්
//  එකතු වෙන්නේ නෑ — ඒ නිසා මේක ඕන.)
// ---------------------------------------------------------------
function ensureColumn(table, column, ddl) {
  try {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all();
    if (!cols.some(c => c.name === column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
      console.log(`✓ db migration: ${table}.${column} එකතු කළා`);
    }
  } catch (e) {
    console.error(`⚠️  db migration fail (${table}.${column}):`, e.message);
  }
}

ensureColumn('guesses', 'agreedDisclaimer', 'TEXT');

/**
 * prepared statement cache — හැම request එකකටම අලුතින් prepare කරන එක
 * නිකම් වැඩක්. SQL string එකම key එක විදිහට ගන්නවා.
 */
const stmtCache = new Map();

function prepare(sql) {
  let stmt = stmtCache.get(sql);
  if (!stmt) {
    stmt = db.prepare(sql);
    stmtCache.set(sql, stmt);
  }
  return stmt;
}

/** Graceful shutdown — server close වෙනකොට DB file එක හරියට flush වෙන්න */
function close() {
  try {
    db.close();
  } catch (e) {
    /* already closed */
  }
}

module.exports = {
  db,
  prepare,
  close,
  DB_PATH,
  DATA_DIR,
};
