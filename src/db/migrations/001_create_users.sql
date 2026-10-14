-- Migration 001: users
-- ---------------------------------------------------------------------------
-- Passwords are NEVER stored. Only the bcrypt hash is kept (which includes its
-- own random salt and cost factor, e.g. "$2b$12$...").
-- COLLATE NOCASE makes the UNIQUE checks case-insensitive, so
-- "Sara@Mail.com" and "sara@mail.com" cannot both register.

CREATE TABLE IF NOT EXISTS users (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  email          TEXT NOT NULL UNIQUE COLLATE NOCASE,
  username       TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash  TEXT NOT NULL,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_login_at  TEXT
);
