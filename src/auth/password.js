/**
 * Password hashing with bcrypt (the bcryptjs package, a pure-JavaScript
 * implementation of the same algorithm, so no native build tools are needed).
 *
 * bcrypt automatically generates a random salt per password and embeds it,
 * together with the cost factor, in the resulting hash string:
 *
 *   $2b$12$<22-char salt><31-char hash>
 *
 * The cost factor (12 = 2^12 rounds) makes each guess slow for an attacker who
 * steals the database, while a single login still takes only ~250 ms.
 */
const bcrypt = require("bcryptjs");
const config = require("../config");

/** Hash a plain-text password. */
const hashPassword = (password) => bcrypt.hash(password, config.bcryptRounds);

/** Compare a plain-text password with a stored hash (constant-time comparison). */
const verifyPassword = (password, hash) => bcrypt.compare(password, hash);

/**
 * A real bcrypt hash of a random value. When a login names a user that does
 * not exist, we still compare against this hash, so the response takes the
 * same time as a wrong password. Without it, attackers could discover which
 * emails are registered by measuring response times (user enumeration).
 */
const DUMMY_HASH = bcrypt.hashSync(require("node:crypto").randomBytes(16).toString("hex"), config.bcryptRounds);

module.exports = { hashPassword, verifyPassword, DUMMY_HASH };
