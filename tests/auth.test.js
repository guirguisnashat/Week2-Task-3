/**
 * Authentication integration tests — `npm test`
 *
 * Runs the real Express app on a random port with an in-memory database and
 * exercises every flow over HTTP, including the security edge cases.
 */
process.env.NODE_ENV = "test";
process.env.BCRYPT_ROUNDS = "4"; // fast hashing in tests only (production uses 12)

const { test, describe, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const config = require("../src/config");
const { openDatabase } = require("../src/db");
const { createApp } = require("../src/app");

let db, server, baseUrl;

/** fetch wrapper that returns status, parsed body, headers and the auth cookie value. */
async function call(method, path, { body, cookie, headers = {} } = {}) {
  const res = await fetch(baseUrl + path, {
    method,
    redirect: "manual",
    headers: {
      ...(body !== undefined && { "Content-Type": "application/json" }),
      ...(cookie && { Cookie: `${config.cookie.name}=${cookie}` }),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const setCookie = res.headers.getSetCookie().find((c) => c.startsWith(`${config.cookie.name}=`));
  const text = await res.text();
  let parsed = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
  return {
    status: res.status,
    body: parsed,
    headers: res.headers,
    setCookie,
    token: setCookie ? decodeURIComponent(setCookie.split(";")[0].split("=")[1]) : undefined,
  };
}

const newUser = (overrides = {}) => ({
  email: "sara@example.com",
  username: "sara_dev",
  password: "Sunrise2026!",
  confirmPassword: "Sunrise2026!",
  ...overrides,
});

const register = (overrides) => call("POST", "/api/auth/register", { body: newUser(overrides) });

before(async () => {
  db = openDatabase(":memory:");
  server = createApp(db).listen(0);
  await new Promise((r) => server.once("listening", r));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
after(() => { server.close(); db.close(); });
beforeEach(() => db.exec("DELETE FROM sessions; DELETE FROM users;"));

describe("Registration", () => {
  test("creates the user, logs them in and sets a secure cookie", async () => {
    const res = await register();
    assert.equal(res.status, 201);
    assert.equal(res.body.user.email, "sara@example.com");
    assert.equal(res.body.user.username, "sara_dev");
    assert.ok(res.token, "auth cookie is set");
    assert.match(res.setCookie, /HttpOnly/i);
    assert.match(res.setCookie, /SameSite=Strict/i);
    assert.equal(JSON.stringify(res.body).includes(res.token), false, "token is never in the response body");
    assert.equal(res.body.user.passwordHash, undefined, "hash is never returned");
  });

  test("stores a bcrypt hash, never the plain password", async () => {
    await register();
    const { password_hash } = db.prepare("SELECT password_hash FROM users").get();
    assert.match(password_hash, /^\$2[aby]\$\d{2}\$.{53}$/);
    assert.equal(password_hash.includes("Sunrise2026!"), false);
  });

  test("normalises the email to lower case", async () => {
    const res = await register({ email: "  Sara@Example.COM " });
    assert.equal(res.body.user.email, "sara@example.com");
  });

  test("rejects invalid input with per-field messages", async () => {
    const cases = [
      [{ email: "not-an-email" }, "email"],
      [{ username: "a" }, "username"],
      [{ username: "bad name!" }, "username"],
      [{ password: "short1", confirmPassword: "short1" }, "password"],
      [{ password: "onlyletters", confirmPassword: "onlyletters" }, "password"],
      [{ password: "password123", confirmPassword: "password123" }, "password"],
      [{ password: "sara_dev2026", confirmPassword: "sara_dev2026" }, "password"],
      [{ password: "x1".repeat(40), confirmPassword: "x1".repeat(40) }, "password"], // > 72 bytes
      [{ confirmPassword: "Different123" }, "confirmPassword"],
    ];
    for (const [override, field] of cases) {
      const res = await register(override);
      assert.equal(res.status, 400, JSON.stringify(override));
      assert.ok(res.body.error.details.some((d) => d.field === field), `expected ${field} error for ${JSON.stringify(override)}`);
    }
  });

  test("rejects a duplicate email (case-insensitive) and username with 409", async () => {
    await register();
    const dupEmail = await register({ email: "SARA@example.com", username: "someone_else" });
    assert.equal(dupEmail.status, 409);
    assert.equal(dupEmail.body.error.details[0].field, "email");

    const dupUser = await register({ email: "other@example.com", username: "SARA_DEV" });
    assert.equal(dupUser.status, 409);
    assert.equal(dupUser.body.error.details[0].field, "username");
  });
});

describe("Login", () => {
  beforeEach(() => register());

  test("logs in with email or username", async () => {
    const byEmail = await call("POST", "/api/auth/login", { body: { login: "SARA@example.com", password: "Sunrise2026!" } });
    assert.equal(byEmail.status, 200);
    assert.ok(byEmail.token);

    const byUsername = await call("POST", "/api/auth/login", { body: { login: "sara_dev", password: "Sunrise2026!" } });
    assert.equal(byUsername.status, 200);
    assert.notEqual(byUsername.token, byEmail.token, "each login gets its own session");
  });

  test("wrong password and unknown user return the same generic 401", async () => {
    const wrong = await call("POST", "/api/auth/login", { body: { login: "sara_dev", password: "WrongPass1" } });
    const unknown = await call("POST", "/api/auth/login", { body: { login: "ghost@example.com", password: "WrongPass1" } });
    assert.equal(wrong.status, 401);
    assert.equal(unknown.status, 401);
    assert.equal(wrong.body.error.message, unknown.body.error.message, "no user enumeration");
    assert.equal(wrong.token, undefined);
  });

  test("SQL injection in the login field is just a failed login", async () => {
    const res = await call("POST", "/api/auth/login", { body: { login: "' OR '1'='1' --", password: "x' OR 1=1 --" } });
    assert.equal(res.status, 401);
  });

  test("missing fields return 400", async () => {
    const res = await call("POST", "/api/auth/login", { body: {} });
    assert.equal(res.status, 400);
    assert.deepEqual(res.body.error.details.map((d) => d.field).sort(), ["login", "password"]);
  });
});

describe("Protected routes", () => {
  let token;
  beforeEach(async () => { token = (await register()).token; });

  test("401 without a token", async () => {
    assert.equal((await call("GET", "/api/auth/me")).status, 401);
    assert.equal((await call("GET", "/api/dashboard")).status, 401);
  });

  test("200 with a valid token", async () => {
    const me = await call("GET", "/api/auth/me", { cookie: token });
    assert.equal(me.status, 200);
    assert.equal(me.body.user.username, "sara_dev");

    const dash = await call("GET", "/api/dashboard", { cookie: token });
    assert.equal(dash.status, 200);
    assert.equal(dash.body.sessions.length, 1);
    assert.equal(dash.body.sessions[0].current, true);
    assert.equal(dash.body.sessions[0].id, undefined, "session ids are not exposed");
  });

  test("rejects a tampered token", async () => {
    const [h, p, s] = token.split(".");
    const payload = JSON.parse(Buffer.from(p, "base64url").toString());
    payload.sub = "999";
    const forged = [h, Buffer.from(JSON.stringify(payload)).toString("base64url"), s].join(".");
    assert.equal((await call("GET", "/api/auth/me", { cookie: forged })).status, 401);
  });

  test("rejects a token signed with another secret", async () => {
    const { jti } = jwt.decode(token);
    const fake = jwt.sign({ sub: "1" }, "attacker-secret-attacker-secret-1234", {
      jwtid: jti, issuer: config.jwt.issuer, audience: config.jwt.audience,
    });
    assert.equal((await call("GET", "/api/auth/me", { cookie: fake })).status, 401);
  });

  test('rejects an unsigned "alg: none" token', async () => {
    const { jti, sub } = jwt.decode(token);
    const none = jwt.sign({ sub, jti, iss: config.jwt.issuer, aud: config.jwt.audience }, null, { algorithm: "none" });
    assert.equal((await call("GET", "/api/auth/me", { cookie: none })).status, 401);
  });

  test("rejects an expired token", async () => {
    const { jti, sub } = jwt.decode(token);
    const expired = jwt.sign({ sub, exp: Math.floor(Date.now() / 1000) - 10 }, config.jwt.secret, {
      jwtid: jti, issuer: config.jwt.issuer, audience: config.jwt.audience,
    });
    const res = await call("GET", "/api/auth/me", { cookie: expired });
    assert.equal(res.status, 401);
    assert.match(res.body.error.message, /expired/i);
  });

  test("blocks cross-site POSTs (Origin check)", async () => {
    const res = await call("POST", "/api/auth/logout-all", { cookie: token, headers: { Origin: "https://evil.example" } });
    assert.equal(res.status, 403);
  });
});

describe("Logout", () => {
  test("revokes the session server-side: the old token stops working", async () => {
    const { token } = await register();
    assert.equal((await call("GET", "/api/auth/me", { cookie: token })).status, 200);

    const out = await call("POST", "/api/auth/logout", { cookie: token });
    assert.equal(out.status, 204);
    assert.match(out.setCookie, /Expires=Thu, 01 Jan 1970/i, "cookie is cleared");

    // Even if someone kept a copy of the token, it is now rejected.
    const reuse = await call("GET", "/api/auth/me", { cookie: token });
    assert.equal(reuse.status, 401);
    assert.match(reuse.body.error.message, /logged out/i);
  });

  test("logout-all ends every session of the user", async () => {
    const first = (await register()).token;
    const second = (await call("POST", "/api/auth/login", { body: { login: "sara_dev", password: "Sunrise2026!" } })).token;

    const res = await call("POST", "/api/auth/logout-all", { cookie: second });
    assert.equal(res.status, 200);
    assert.equal(res.body.revoked, 2);
    assert.equal((await call("GET", "/api/auth/me", { cookie: first })).status, 401);
    assert.equal((await call("GET", "/api/auth/me", { cookie: second })).status, 401);
  });

  test("logout without a session still succeeds", async () => {
    assert.equal((await call("POST", "/api/auth/logout")).status, 204);
  });
});

describe("Pages", () => {
  test("/dashboard redirects to /login when not authenticated", async () => {
    const res = await call("GET", "/dashboard");
    assert.equal(res.status, 302);
    assert.equal(res.headers.get("location"), "/login?next=%2Fdashboard");
  });

  test("/dashboard is served (and not cached) when authenticated", async () => {
    const { token } = await register();
    const res = await call("GET", "/dashboard", { cookie: token });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("cache-control"), "no-store");
  });

  test("/login and /register redirect to /dashboard when already logged in", async () => {
    const { token } = await register();
    assert.equal((await call("GET", "/login", { cookie: token })).headers.get("location"), "/dashboard");
    assert.equal((await call("GET", "/register", { cookie: token })).headers.get("location"), "/dashboard");
  });

  test("security headers are set", async () => {
    const res = await call("GET", "/login");
    assert.match(res.headers.get("content-security-policy"), /script-src 'self'/);
    assert.equal(res.headers.get("x-content-type-options"), "nosniff");
    assert.equal(res.headers.get("x-powered-by"), null);
  });
});
