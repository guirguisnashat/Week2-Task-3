/**
 * JWT helpers. Tokens are signed with HMAC-SHA256 and contain only:
 *   sub — the user id
 *   jti — a random session id (checked against the sessions table)
 *   iat/exp — issued-at and expiry timestamps
 *   iss/aud — who issued the token and who it is for
 * No personal data goes in the token: JWT payloads are only encoded, not encrypted.
 */
const crypto = require("node:crypto");
const jwt = require("jsonwebtoken");
const config = require("../config");

const { secret, expiresInSeconds, issuer, audience } = config.jwt;

/**
 * Create a signed token for a user.
 * @returns {{token: string, sessionId: string, expiresAt: Date}}
 */
function signToken(userId) {
  const sessionId = crypto.randomUUID();
  const token = jwt.sign({ sub: String(userId) }, secret, {
    algorithm: "HS256",
    expiresIn: expiresInSeconds,
    jwtid: sessionId,
    issuer,
    audience,
  });
  return { token, sessionId, expiresAt: new Date(Date.now() + expiresInSeconds * 1000) };
}

/**
 * Verify signature, expiry, issuer and audience.
 * Pinning `algorithms` blocks the "alg: none" and algorithm-confusion attacks.
 * @throws {jwt.JsonWebTokenError | jwt.TokenExpiredError}
 */
function verifyToken(token) {
  return jwt.verify(token, secret, { algorithms: ["HS256"], issuer, audience });
}

module.exports = { signToken, verifyToken };
