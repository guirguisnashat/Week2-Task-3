/**
 * Auth API routes, mounted at /api/auth.
 *
 *   POST /register     create account + log in          (rate limited)
 *   POST /login        log in with email or username    (rate limited)
 *   POST /logout       end the current session
 *   POST /logout-all   end every session      (protected)
 *   GET  /me           current user           (protected)
 */
const express = require("express");
const rateLimit = require("express-rate-limit");
const config = require("../config");

function createAuthRouter(controller, { requireAuth }) {
  const router = express.Router();

  // Slow down password guessing: 10 failed logins per 15 minutes per IP.
  // Successful logins don't count, so real users are never locked out by typing correctly.
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    skipSuccessfulRequests: true,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skip: () => config.isTest,
    message: { error: { status: 429, message: "Too many failed login attempts. Please try again in 15 minutes." } },
  });

  // Limit automated account creation: 10 sign-ups per hour per IP.
  const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skip: () => config.isTest,
    message: { error: { status: 429, message: "Too many accounts created from this network. Please try again later." } },
  });

  router.post("/register", registerLimiter, controller.register);
  router.post("/login", loginLimiter, controller.login);
  router.post("/logout", controller.logout);
  router.post("/logout-all", requireAuth, controller.logoutAll);
  router.get("/me", requireAuth, controller.me);

  return router;
}

module.exports = { createAuthRouter };
