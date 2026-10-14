/**
 * CSRF defence-in-depth for state-changing API requests (POST/PUT/PATCH/DELETE).
 *
 * The auth cookie is already SameSite=Strict, so browsers won't attach it to
 * requests started by other websites. As a second layer, if the browser sends
 * an Origin header, it must match this server's own origin.
 * Requests without an Origin header (curl, Postman, server-to-server) are allowed.
 */
const ApiError = require("../utils/ApiError");

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function originCheck(req, _res, next) {
  const origin = req.get("origin");
  if (SAFE_METHODS.has(req.method) || !origin) return next();

  const expected = `${req.protocol}://${req.get("host")}`;
  if (origin !== expected) return next(new ApiError(403, "Cross-site request blocked"));
  next();
}

module.exports = originCheck;
