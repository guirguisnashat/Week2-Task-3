/**
 * Route protection middleware.
 *
 *   requireAuth             — for API routes: 401 JSON if not logged in
 *   requirePageAuth         — for HTML pages: redirect to /login if not logged in
 *   redirectIfAuthenticated — for /login and /register: skip them when already logged in
 *
 * On success, `req.user` and `req.sessionId` are available to the next handler.
 */
const config = require("../config");

const readToken = (req) => req.cookies?.[config.cookie.name];

/** @param {ReturnType<import("./auth.service").createAuthService>} authService */
function createAuthMiddleware(authService) {
  const clearCookie = (res) => res.clearCookie(config.cookie.name, config.cookie.options);

  function requireAuth(req, res, next) {
    try {
      Object.assign(req, authService.authenticate(readToken(req)));
      next();
    } catch (err) {
      clearCookie(res); // drop a bad or revoked cookie so the browser stops sending it
      next(err);
    }
  }

  function requirePageAuth(req, res, next) {
    try {
      Object.assign(req, authService.authenticate(readToken(req)));
      // Protected pages must never be cached, so "Back" after logout can't show them.
      res.set("Cache-Control", "no-store");
      next();
    } catch {
      clearCookie(res);
      res.redirect(`/login?next=${encodeURIComponent(req.originalUrl)}`);
    }
  }

  function redirectIfAuthenticated(req, res, next) {
    try {
      authService.authenticate(readToken(req));
      res.redirect("/dashboard");
    } catch {
      next();
    }
  }

  return { requireAuth, requirePageAuth, redirectIfAuthenticated };
}

module.exports = { createAuthMiddleware, readToken };
