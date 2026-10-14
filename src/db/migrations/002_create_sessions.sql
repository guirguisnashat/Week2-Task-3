-- Migration 002: sessions
-- ---------------------------------------------------------------------------
-- A JWT on its own cannot be "un-issued": it stays valid until it expires.
-- To make logout actually invalidate a token, every JWT carries a unique id
-- (the `jti` claim) that must exist here and must not be revoked.
-- Logout sets revoked_at, so the same token is rejected even if it was copied.

CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,                -- the JWT's jti (random UUID)
  user_id     INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  user_agent  TEXT,
  ip_address  TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expires_at  TEXT NOT NULL,
  revoked_at  TEXT
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id);
