/**
 * HTTP layer for auth: validate input → call the service → set/clear the cookie.
 * The JWT is only ever sent in the HttpOnly cookie, never in a response body,
 * so frontend JavaScript (and any injected script) can never read it.
 */
const config = require("../config");
const { validateRegistration, validateLogin } = require("./auth.validators");
const { readToken } = require("./auth.middleware");

/** @param {ReturnType<import("./auth.service").createAuthService>} authService */
function createAuthController(authService) {
  const requestContext = (req) => ({ userAgent: req.get("user-agent"), ip: req.ip });

  const setAuthCookie = (res, token, expiresAt) =>
    res.cookie(config.cookie.name, token, { ...config.cookie.options, expires: expiresAt });

  return {
    /** POST /api/auth/register */
    async register(req, res) {
      const input = validateRegistration(req.body);
      const { user, token, expiresAt } = await authService.register(input, requestContext(req));
      setAuthCookie(res, token, expiresAt);
      res.status(201).json({ message: "Account created successfully.", user });
    },

    /** POST /api/auth/login */
    async login(req, res) {
      const input = validateLogin(req.body);
      const { user, token, expiresAt } = await authService.login(input, requestContext(req));
      setAuthCookie(res, token, expiresAt);
      res.json({ message: "Logged in successfully.", user, expiresAt });
    },

    /** POST /api/auth/logout — revokes the session server-side and clears the cookie. */
    logout(req, res) {
      authService.logout(readToken(req));
      res.clearCookie(config.cookie.name, config.cookie.options);
      res.status(204).end();
    },

    /** POST /api/auth/logout-all (protected) — revoke every session of this user. */
    logoutAll(req, res) {
      const revoked = authService.logoutAll(req.user.id);
      res.clearCookie(config.cookie.name, config.cookie.options);
      res.json({ message: `Logged out of ${revoked} session(s).`, revoked });
    },

    /** GET /api/auth/me (protected) */
    me(req, res) {
      res.json({ user: req.user });
    },
  };
}

module.exports = { createAuthController };
