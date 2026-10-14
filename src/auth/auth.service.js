/**
 * Auth business logic: register, log in, authenticate a token, log out.
 * It knows nothing about HTTP (no req/res), which makes it easy to test.
 */
const ApiError = require("../utils/ApiError");
const { hashPassword, verifyPassword, DUMMY_HASH } = require("./password");
const { signToken, verifyToken } = require("./token");

/** One message for "no such user" and "wrong password", so attackers can't tell which. */
const INVALID_CREDENTIALS = "Invalid email/username or password.";

/** @param {ReturnType<import("../users/user.model").createUserModel>} Users */
function createAuthService(Users) {
  /** Issue a token and record the session it belongs to. */
  function startSession(userId, { userAgent, ip }) {
    const { token, sessionId, expiresAt } = signToken(userId);
    Users.createSession({
      id: sessionId,
      userId,
      userAgent: userAgent ? String(userAgent).slice(0, 255) : null,
      ip: ip || null,
      expiresAt: expiresAt.toISOString(),
    });
    return { token, expiresAt };
  }

  return {
    /**
     * Create an account and log the new user in.
     * @throws {ApiError} 409 if the email or username is already taken
     */
    async register({ email, username, password }, context) {
      const conflicts = [];
      if (Users.emailExists(email)) conflicts.push({ field: "email", message: "An account with this email already exists." });
      if (Users.usernameExists(username)) conflicts.push({ field: "username", message: "This username is already taken." });
      if (conflicts.length) throw new ApiError(409, "Account already exists", conflicts);

      const passwordHash = await hashPassword(password);
      let user;
      try {
        user = Users.create(email, username, passwordHash);
      } catch (err) {
        // Two sign-ups racing for the same email: the UNIQUE constraint wins.
        if (err.code === "SQLITE_CONSTRAINT_UNIQUE") throw new ApiError(409, "Account already exists");
        throw err;
      }
      Users.recordLogin(user.id);
      return { user: Users.findPublicById(user.id), ...startSession(user.id, context) };
    },

    /**
     * Verify credentials and start a session.
     * @throws {ApiError} 401 with a generic message on any failure
     */
    async login({ login, password }, context) {
      const record = Users.findCredentials(login);
      // Always run bcrypt, even when the user doesn't exist (constant-time response).
      const valid = await verifyPassword(password, record ? record.passwordHash : DUMMY_HASH);
      if (!record || !valid) throw new ApiError(401, INVALID_CREDENTIALS);

      Users.recordLogin(record.id);
      return { user: Users.findPublicById(record.id), ...startSession(record.id, context) };
    },

    /**
     * Turn a raw token into { user, sessionId }.
     * Checks the signature and expiry, and that the session hasn't been revoked.
     * @throws {ApiError} 401
     */
    authenticate(token) {
      if (!token) throw new ApiError(401, "Authentication required. Please log in.");

      let payload;
      try {
        payload = verifyToken(token);
      } catch (err) {
        const message = err.name === "TokenExpiredError" ? "Your session has expired. Please log in again." : "Invalid session. Please log in again.";
        throw new ApiError(401, message);
      }

      const session = Users.findActiveSession(payload.jti);
      if (!session || String(session.userId) !== payload.sub) {
        throw new ApiError(401, "This session has been logged out. Please log in again.");
      }

      const user = Users.findPublicById(session.userId);
      if (!user) throw new ApiError(401, "Account no longer exists.");
      return { user, sessionId: session.id };
    },

    /** Revoke one session (normal logout). Safe to call with a bad or missing token. */
    logout(token) {
      if (!token) return;
      try {
        Users.revokeSession(verifyToken(token).jti);
      } catch {
        /* expired or invalid token: nothing to revoke */
      }
    },

    /** Revoke every session for a user ("log out of all devices"). */
    logoutAll(userId) {
      return Users.revokeAllSessions(userId);
    },

    listSessions: (userId) => Users.listActiveSessions(userId),
    countSessions: (userId) => Users.countSessions(userId),
  };
}

module.exports = { createAuthService, INVALID_CREDENTIALS };
