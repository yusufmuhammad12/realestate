// db/database.js
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'real_estate.db');
const db = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─────────────────────────────────────────────
//  CREATE TABLES
// ─────────────────────────────────────────────

db.exec(`
  -- Users table
  CREATE TABLE IF NOT EXISTS users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    fullname    TEXT    NOT NULL,
    email       TEXT    NOT NULL UNIQUE,
    password    TEXT    NOT NULL,
    role        TEXT    NOT NULL DEFAULT 'user',   -- 'user' | 'admin'
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  -- Properties table
  CREATE TABLE IF NOT EXISTS properties (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    title         TEXT    NOT NULL,
    developer     TEXT    NOT NULL,
    project_name  TEXT    NOT NULL,
    price         REAL    NOT NULL,
    area          TEXT    NOT NULL,
    bua           REAL    NOT NULL,
    bedrooms      INTEGER NOT NULL,
    bathrooms     INTEGER NOT NULL,
    listing_type  TEXT    NOT NULL CHECK(listing_type IN ('Sale','Rent')),
    unit_type     TEXT    NOT NULL,
    image_url     TEXT,
    amenities     TEXT    DEFAULT '[]',   -- JSON array stored as text
    description   TEXT,
    owner_phone   TEXT,
    owner_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
    status        TEXT    NOT NULL DEFAULT 'available' CHECK(status IN ('available','sold','rented')),
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  -- Inquiries / Contact requests
  CREATE TABLE IF NOT EXISTS inquiries (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    property_id  INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    user_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
    name         TEXT    NOT NULL,
    email        TEXT    NOT NULL,
    phone        TEXT,
    message      TEXT    NOT NULL,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  -- Favorites
  CREATE TABLE IF NOT EXISTS favorites (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    property_id  INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, property_id)
  );
`);

// ─────────────────────────────────────────────
//  SEED: default admin account
// ─────────────────────────────────────────────
const bcrypt = require('bcryptjs');

const adminExists = db.prepare("SELECT id FROM users WHERE email = ?").get('admin@realestate.com');
if (!adminExists) {
  const hashed = bcrypt.hashSync('Admin@1234', 10);
  db.prepare(`
    INSERT INTO users (fullname, email, password, role)
    VALUES (?, ?, ?, 'admin')
  `).run('System Admin', 'admin@realestate.com', hashed);
  console.log('✅  Default admin created → admin@realestate.com / Admin@1234');
}

module.exports = db;
