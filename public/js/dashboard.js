/**
 * Protected dashboard. The page itself is only served to logged-in users
 * (server-side check), and its data comes from GET /api/dashboard, which is
 * also protected. If the session ends (expired, logged out elsewhere), the
 * API returns 401 and we send the user back to the login page.
 */
import { apiRequest, setLoading } from "./common.js";

const $ = (id) => document.getElementById(id);
const fmt = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });
const formatDate = (iso) => (iso ? fmt.format(new Date(iso)) : "—");

/** Short, readable device name from a User-Agent string. */
function describeDevice(ua = "") {
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : ua.includes("Postman") ? "Postman" : "Unknown browser";
  const os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Mac OS/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${browser} on ${os}` : browser;
}

function renderSessions(sessions) {
  const list = $("session-list");
  list.replaceChildren(
    ...sessions.map((s) => {
      const li = document.createElement("li");
      li.className = "session";
      const info = document.createElement("div");
      const name = document.createElement("strong");
      name.textContent = describeDevice(s.userAgent);
      const meta = document.createElement("small");
      meta.textContent = `Signed in ${formatDate(s.createdAt)} · expires ${formatDate(s.expiresAt)}`;
      info.append(name, meta);
      li.append(info);
      if (s.current) {
        const badge = document.createElement("span");
        badge.className = "badge badge--success";
        badge.textContent = "This device";
        li.append(badge);
      }
      return li;
    })
  );
}

async function load() {
  try {
    const { user, sessions, stats } = await apiRequest("GET", "/api/dashboard");
    // textContent everywhere: user-provided values can never be interpreted as HTML.
    $("avatar").textContent = user.username.slice(0, 2).toUpperCase();
    $("welcome-name").textContent = user.username;
    $("welcome-title").textContent = new URLSearchParams(location.search).get("welcome") ? "Welcome aboard," : "Welcome back,";
    $("detail-username").textContent = user.username;
    $("detail-email").textContent = user.email;
    $("detail-id").textContent = `#${user.id}`;
    $("detail-created").textContent = formatDate(user.createdAt);
    $("detail-last-login").textContent = formatDate(user.lastLoginAt);
    $("stat-sessions").textContent = `${stats.activeSessions} active session${stats.activeSessions === 1 ? "" : "s"}`;
    renderSessions(sessions);
    $("loading").hidden = true;
    $("content").hidden = false;
    history.replaceState(null, "", "/dashboard"); // drop ?welcome=1 from the address bar
  } catch (error) {
    if (error.status === 401) location.replace("/login?next=/dashboard");
    else $("loading").textContent = error.message;
  }
}

async function logout(url, button, busyLabel) {
  setLoading(button, true, { busy: busyLabel, idle: button.lastChild.textContent });
  try {
    await apiRequest("POST", url);
  } finally {
    // Even if the request failed, the cookie is cleared server-side on the next
    // protected request; send the user to the login page either way.
    location.replace("/login?loggedOut=1");
  }
}

$("logout-btn").addEventListener("click", (e) => logout("/api/auth/logout", e.currentTarget, "Logging out…"));
$("logout-all-btn").addEventListener("click", (e) => logout("/api/auth/logout-all", e.currentTarget, "Logging out everywhere…"));

load();
