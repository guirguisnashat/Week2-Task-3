/**
 * Login page: validates the form, calls POST /api/auth/login and redirects.
 */
import { apiRequest, setFieldError, showAlert, setLoading, initPasswordToggles, safeNextUrl } from "./common.js";

const form = document.getElementById("login-form");
const alertEl = document.getElementById("form-alert");
const submit = document.getElementById("submit-btn");

initPasswordToggles();

// Messages passed from other pages (e.g. after logout or when a session expired).
const params = new URLSearchParams(location.search);
if (params.get("loggedOut")) showAlert(alertEl, "You have been logged out successfully.", "success");
else if (params.get("next")) showAlert(alertEl, "Please log in to continue.", "info");

function validate() {
  const errors = {};
  if (!form.elements.login.value.trim()) errors.login = "Please enter your email or username.";
  if (!form.elements.password.value) errors.password = "Please enter your password.";
  ["login", "password"].forEach((name) => setFieldError(form, name, errors[name]));
  return errors;
}

form.addEventListener("input", (event) => {
  if (event.target.getAttribute("aria-invalid") === "true") validate();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  showAlert(alertEl, "");
  const errors = validate();
  const firstInvalid = Object.keys(errors)[0];
  if (firstInvalid) return form.elements[firstInvalid].focus();

  setLoading(submit, true, { busy: "Signing in…", idle: "Sign in" });
  try {
    await apiRequest("POST", "/api/auth/login", {
      login: form.elements.login.value.trim(),
      password: form.elements.password.value,
    });
    location.assign(safeNextUrl());
  } catch (error) {
    // 401 → generic "invalid credentials"; 429 → rate limited; 400 → field errors.
    error.details.forEach((d) => setFieldError(form, d.field, d.message));
    showAlert(alertEl, error.message);
    form.elements.password.value = "";
    form.elements.password.focus();
    setLoading(submit, false, { busy: "Signing in…", idle: "Sign in" });
  }
});
