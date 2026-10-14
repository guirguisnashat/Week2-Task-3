/**
 * Input validation and sanitisation for the auth endpoints.
 *
 * - Strings are type-checked and trimmed; emails are lower-cased.
 * - Every problem is collected, so the client can show all errors at once.
 * - Passwords are NOT trimmed (spaces are allowed and are part of the secret).
 */
const ApiError = require("../utils/ApiError");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,30}$/;
// bcrypt only uses the first 72 BYTES of a password, so longer input is rejected
// instead of being silently truncated.
const PASSWORD_MAX_BYTES = 72;
const PASSWORD_MIN_LENGTH = 8;
const COMMON_PASSWORDS = new Set([
  "password", "password1", "password123", "12345678", "123456789", "1234567890",
  "qwerty123", "11111111", "iloveyou1", "admin123", "welcome1", "letmein1", "abc12345",
]);

const asString = (value) => (typeof value === "string" ? value : "");

/**
 * Check password strength. Returns an error message, or "" if acceptable.
 * Exported so the same rules can be reused and unit-tested.
 */
function checkPassword(password, { username = "", email = "" } = {}) {
  if (!password) return "Password is required.";
  if (password.length < PASSWORD_MIN_LENGTH) return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  if (Buffer.byteLength(password, "utf8") > PASSWORD_MAX_BYTES) return "Password is too long (maximum 72 bytes).";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "Password must contain at least one letter and one number.";
  if (COMMON_PASSWORDS.has(password.toLowerCase())) return "This password is too common. Please choose another.";
  const lower = password.toLowerCase();
  if (username && lower.includes(username.toLowerCase())) return "Password must not contain your username.";
  if (email && lower.includes(email.split("@")[0].toLowerCase())) return "Password must not contain your email name.";
  return "";
}

/** @returns {{email: string, username: string, password: string}} */
function validateRegistration(body = {}) {
  const errors = [];
  const email = asString(body.email).trim().toLowerCase();
  const username = asString(body.username).trim();
  const password = asString(body.password);

  if (!email) errors.push({ field: "email", message: "Email is required." });
  else if (email.length > 254 || !EMAIL_PATTERN.test(email)) errors.push({ field: "email", message: "Please enter a valid email address." });

  if (!username) errors.push({ field: "username", message: "Username is required." });
  else if (!USERNAME_PATTERN.test(username)) {
    errors.push({ field: "username", message: "Username must be 3–30 characters: letters, numbers and underscores only." });
  }

  const passwordError = checkPassword(password, { username, email });
  if (passwordError) errors.push({ field: "password", message: passwordError });

  if (body.confirmPassword !== undefined && body.confirmPassword !== password) {
    errors.push({ field: "confirmPassword", message: "Passwords do not match." });
  }

  if (errors.length) throw new ApiError(400, "Validation failed", errors);
  return { email, username, password };
}

/** @returns {{login: string, password: string}} — login may be an email or a username */
function validateLogin(body = {}) {
  const errors = [];
  const login = asString(body.login ?? body.email ?? body.username).trim();
  const password = asString(body.password);

  if (!login) errors.push({ field: "login", message: "Email or username is required." });
  else if (login.length > 254) errors.push({ field: "login", message: "Email or username is too long." });
  if (!password) errors.push({ field: "password", message: "Password is required." });
  else if (Buffer.byteLength(password, "utf8") > PASSWORD_MAX_BYTES) errors.push({ field: "password", message: "Password is too long." });

  if (errors.length) throw new ApiError(400, "Validation failed", errors);
  return { login: login.includes("@") ? login.toLowerCase() : login, password };
}

module.exports = { validateRegistration, validateLogin, checkPassword };
