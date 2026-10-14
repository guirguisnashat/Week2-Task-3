# Authentication API

Base URL: `http://localhost:3000/api`. Request and response bodies are JSON.

**How authentication works:**
- When you log in or register, the server sets an `auth_token` cookie containing a signed JWT.
- The cookie is `HttpOnly; SameSite=Strict; Path=/`, plus `Secure` in production.
- Browsers and Postman send it back automatically.
- The token is **never** included in a response body.

## Endpoints

| Method | Path | Auth required | Description |
|--------|------|:---:|-------------|
| `POST` | `/auth/register` | — | Create an account and log in |
| `POST` | `/auth/login` | — | Log in with email **or** username |
| `POST` | `/auth/logout` | — | Revoke the current session and clear the cookie |
| `POST` | `/auth/logout-all` | ✅ | Revoke **all** of the user's sessions |
| `GET` | `/auth/me` | ✅ | The current user |
| `GET` | `/dashboard` | ✅ | Example protected resource: user, active sessions, stats |
| `GET` | `/health` | — | Health check |

Page routes:

| Path | Behaviour |
|------|-----------|
| `GET /dashboard` | **Protected page.** Redirects to `/login?next=/dashboard` when not logged in, and is sent with `Cache-Control: no-store`. |
| `GET /login`, `GET /register` | Redirect to `/dashboard` if already logged in |
| `GET /` | Redirects to `/dashboard` or `/login` |

---

### `POST /auth/register`

```json
{
  "email": "sara@example.com",
  "username": "sara_dev",
  "password": "Sunrise2026!",
  "confirmPassword": "Sunrise2026!"
}
```

| Field | Rules |
|-------|-------|
| `email` | Required, valid format, at most 254 characters, stored in lower case, unique (case-insensitive) |
| `username` | Required, 3–30 characters of `a–z A–Z 0–9 _`, unique (case-insensitive) |
| `password` | Required, 8 characters to 72 bytes, at least 1 letter and 1 number, not a common password, and must not contain the username or the email name |
| `confirmPassword` | Optional; if sent, it must equal `password` |

**201 Created**, with a `Set-Cookie: auth_token=…; HttpOnly; SameSite=Strict` header:

```json
{ "message": "Account created successfully.",
  "user": { "id": 1, "email": "sara@example.com", "username": "sara_dev",
            "createdAt": "2026-10-11T12:00:00.000Z", "lastLoginAt": "2026-10-11T12:00:00.000Z" } }
```

Errors: `400` validation (per-field `details`) · `409` email or username already taken · `429` too many sign-ups

### `POST /auth/login`

```json
{ "login": "sara_dev", "password": "Sunrise2026!" }
```

`login` accepts an email or a username. → **200 OK** with the user and `expiresAt`, and the cookie is set.

Errors:
- `400` missing fields
- `401` `"Invalid email/username or password."`: the same message for an unknown user and for a wrong password
- `429` after 10 failed attempts in 15 minutes from one IP

### `POST /auth/logout`

→ **204 No Content**. The session is marked revoked in the database and the cookie is cleared. If someone kept a copy of the token, it is now rejected.

### `POST /auth/logout-all` 🔒

→ **200** `{ "message": "Logged out of 2 session(s).", "revoked": 2 }`

### `GET /auth/me` 🔒

→ **200** `{ "user": { ... } }`

### `GET /dashboard` 🔒

```json
{
  "user": { "id": 1, "email": "...", "username": "...", "createdAt": "...", "lastLoginAt": "..." },
  "sessions": [ { "userAgent": "...", "ipAddress": "...", "createdAt": "...", "expiresAt": "...", "current": true } ],
  "stats": { "activeSessions": 1, "totalLogins": 3 }
}
```

## Error format

```json
{ "error": { "status": 401, "message": "This session has been logged out. Please log in again." } }
```

| Status | Meaning |
|--------|---------|
| `400` | Invalid input or invalid JSON |
| `401` | Not logged in, or the token is invalid, expired or revoked |
| `403` | Cross-site request blocked (the Origin header does not match) |
| `404` | Unknown API route |
| `409` | Email or username already registered |
| `413` | Body larger than 10 KB |
| `429` | Rate limit reached |

## Postman

Import [`Auth-API.postman_collection.json`](Auth-API.postman_collection.json) and run it with the Collection Runner. It has 15 requests and 26 assertions covering register, duplicate, protected access, logout, wrong password and logout-all.

```bash
npx newman run docs/Auth-API.postman_collection.json --env-var baseUrl=http://localhost:3000/api
```
