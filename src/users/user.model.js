/**
 * Data access for users and sessions. Every query uses bound parameters,
 * so user input is never concatenated into SQL.
 */

/** Public user fields: the password hash never leaves this module unless asked for explicitly. */
const PUBLIC_FIELDS = "id, email, username, created_at AS createdAt, last_login_at AS lastLoginAt";

/** @param {import("better-sqlite3").Database} db */
function createUserModel(db) {
  const q = {
    insertUser: db.prepare("INSERT INTO users (email, username, password_hash) VALUES (?, ?, ?)"),
    publicById: db.prepare(`SELECT ${PUBLIC_FIELDS} FROM users WHERE id = ?`),
    // Login accepts either an email or a username in one field.
    credentialsByLogin: db.prepare(
      "SELECT id, password_hash AS passwordHash FROM users WHERE email = ? OR username = ?"
    ),
    emailExists: db.prepare("SELECT 1 FROM users WHERE email = ?").pluck(),
    usernameExists: db.prepare("SELECT 1 FROM users WHERE username = ?").pluck(),
    touchLogin: db.prepare("UPDATE users SET last_login_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?"),

    insertSession: db.prepare(
      "INSERT INTO sessions (id, user_id, user_agent, ip_address, expires_at) VALUES (@id, @userId, @userAgent, @ip, @expiresAt)"
    ),
    activeSession: db.prepare(`
      SELECT id, user_id AS userId FROM sessions
       WHERE id = ? AND revoked_at IS NULL AND expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    `),
    revokeSession: db.prepare(
      "UPDATE sessions SET revoked_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND revoked_at IS NULL"
    ),
    revokeAllSessions: db.prepare(
      "UPDATE sessions SET revoked_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE user_id = ? AND revoked_at IS NULL"
    ),
    listActiveSessions: db.prepare(`
      SELECT id, user_agent AS userAgent, ip_address AS ipAddress, created_at AS createdAt, expires_at AS expiresAt
        FROM sessions
       WHERE user_id = ? AND revoked_at IS NULL AND expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       ORDER BY created_at DESC
    `),
    countSessions: db.prepare("SELECT COUNT(*) FROM sessions WHERE user_id = ?").pluck(),
  };

  return {
    create: (email, username, passwordHash) => q.publicById.get(q.insertUser.run(email, username, passwordHash).lastInsertRowid),
    findPublicById: (id) => q.publicById.get(id),
    findCredentials: (login) => q.credentialsByLogin.get(login, login),
    emailExists: (email) => Boolean(q.emailExists.get(email)),
    usernameExists: (username) => Boolean(q.usernameExists.get(username)),
    recordLogin: (id) => q.touchLogin.run(id),

    createSession: (session) => q.insertSession.run(session),
    findActiveSession: (id) => q.activeSession.get(id),
    revokeSession: (id) => q.revokeSession.run(id).changes > 0,
    revokeAllSessions: (userId) => q.revokeAllSessions.run(userId).changes,
    listActiveSessions: (userId) => q.listActiveSessions.all(userId),
    countSessions: (userId) => q.countSessions.get(userId),
  };
}

module.exports = { createUserModel };
