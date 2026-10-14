/**
 * Application configuration, read from environment variables (see .env.example).
 *
 * JWT_SECRET is the most sensitive setting: anyone who knows it can forge
 * login tokens. In production the server refuses to start without one.
 * In development a random secret is generated so the project runs out of the
 * box, but sessions then reset whenever the server restarts.
 */
const crypto = require("node:crypto");
const path = require("node:path");

const env = process.env.NODE_ENV || "development";
const isProduction = env === "production";

let jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.length < 32) {
  if (isProduction) {
    throw new Error("JWT_SECRET must be set to a random string of at least 32 characters in production.");
  }
  jwtSecret = crypto.randomBytes(48).toString("hex");
  if (env !== "test") {
    console.warn("⚠  JWT_SECRET not set: using a temporary random secret. Sessions will reset when the server restarts.");
  }
}

module.exports = Object.freeze({
  env,
  isProduction,
  isTest: env === "test",
  port: Number(process.env.PORT) || 3000,
  dbPath: process.env.DB_PATH || path.join(__dirname, "..", "data", "auth.db"),

  jwt: {
    secret: jwtSecret,
    expiresInSeconds: Number(process.env.JWT_EXPIRES_IN_SECONDS) || 60 * 60 * 2, // 2 hours
    issuer: "secure-auth-system",
    audience: "secure-auth-system-web",
  },

  cookie: {
    name: "auth_token",
    // HttpOnly: JavaScript cannot read it (protects against XSS token theft).
    // SameSite=Strict: not sent on cross-site requests (protects against CSRF).
    // Secure: HTTPS only, enabled in production (localhost runs on plain HTTP).
    options: {
      httpOnly: true,
      sameSite: "strict",
      secure: isProduction,
      path: "/",
    },
  },

  bcryptRounds: Number(process.env.BCRYPT_ROUNDS) || 12,
});
