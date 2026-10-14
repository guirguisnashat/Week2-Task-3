/**
 * Shared helpers for the auth pages.
 *
 * Note: the frontend never sees the JWT. The browser stores it in an HttpOnly
 * cookie and sends it automatically (credentials: "same-origin").
 */

/** POST/GET JSON to the API. Throws an Error with .status and .details on failure. */
export async function apiRequest(method, url, body) {
  let res;
  try {
    res = await fetch(url, {
      method,
      credentials: "same-origin",
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw Object.assign(new Error("Cannot reach the server. Please check your connection and try again."), { status: 0, details: [] });
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = data.error || {};
    throw Object.assign(new Error(error.message || `Request failed (${res.status})`), {
      status: res.status,
      details: error.details || [],
    });
  }
  return data;
}

/** Show (or clear) an error under one field. */
export function setFieldError(form, name, message) {
  const input = form.elements[name];
  if (!input) return;
  const field = input.closest(".field");
  field.classList.toggle("is-invalid", Boolean(message));
  input.setAttribute("aria-invalid", String(Boolean(message)));
  const errorEl = document.getElementById(`${name}-error`);
  if (errorEl) errorEl.textContent = message || "";
}

/** Show an alert banner (textContent only — never innerHTML with server data). */
export function showAlert(el, message, type = "error") {
  el.className = `alert alert--${type}`;
  el.textContent = message;
  el.hidden = !message;
}

export function setLoading(button, loading, label) {
  button.disabled = loading;
  button.classList.toggle("is-loading", loading);
  if (label) button.lastChild.textContent = loading ? label.busy : label.idle;
}

/** Wire up every show/hide password button on the page. */
export function initPasswordToggles() {
  document.querySelectorAll(".toggle-password").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = document.getElementById(btn.getAttribute("aria-controls"));
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      btn.setAttribute("aria-pressed", String(show));
      btn.setAttribute("aria-label", show ? "Hide password" : "Show password");
    });
  });
}

/** Only allow redirects to paths on this site (prevents open-redirect attacks via ?next=). */
export function safeNextUrl(fallback = "/dashboard") {
  const next = new URLSearchParams(location.search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}
