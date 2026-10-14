/**
 * Registration page: live validation, password strength meter and checklist,
 * then POST /api/auth/register. The server re-checks every rule.
 */
import { apiRequest, setFieldError, showAlert, setLoading, initPasswordToggles } from "./common.js";

const form = document.getElementById("register-form");
const alertEl = document.getElementById("form-alert");
const submit = document.getElementById("submit-btn");
const meter = document.getElementById("strength");
const meterLabel = document.getElementById("strength-label");
const FIELDS = ["email", "username", "password", "confirmPassword"];

initPasswordToggles();

/** Same rules as the server (src/auth/auth.validators.js). */
const passwordRules = {
  length: (p) => p.length >= 8,
  letter: (p) => /[A-Za-z]/.test(p),
  number: (p) => /\d/.test(p),
  maxBytes: (p) => new TextEncoder().encode(p).length <= 72,
};

/** 0–4 score: length, mixed case, digits and symbols each add a point. */
function strengthScore(p) {
  if (!p) return 0;
  let score = 0;
  if (p.length >= 8) score++;
  if (p.length >= 12) score++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) score++;
  if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) score++;
  return Math.max(1, score);
}

function updatePasswordUi() {
  const p = form.elements.password.value;
  document.querySelectorAll(".rules [data-rule]").forEach((li) => {
    li.classList.toggle("is-met", passwordRules[li.dataset.rule](p));
  });
  const score = strengthScore(p);
  meter.dataset.score = String(score);
  meterLabel.textContent = p ? `Strength: ${["", "Weak", "Fair", "Good", "Strong"][score]}` : "";
}

function validate() {
  const v = Object.fromEntries(FIELDS.map((f) => [f, form.elements[f].value]));
  const email = v.email.trim();
  const username = v.username.trim();
  const errors = {};

  if (!email) errors.email = "Email is required.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.email = "Please enter a valid email address.";

  if (!username) errors.username = "Username is required.";
  else if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) errors.username = "3–30 characters: letters, numbers and underscores.";

  const p = v.password;
  if (!p) errors.password = "Password is required.";
  else if (!passwordRules.length(p)) errors.password = "Password must be at least 8 characters.";
  else if (!passwordRules.maxBytes(p)) errors.password = "Password is too long (maximum 72 bytes).";
  else if (!passwordRules.letter(p) || !passwordRules.number(p)) errors.password = "Use at least one letter and one number.";
  else if (username && p.toLowerCase().includes(username.toLowerCase())) errors.password = "Password must not contain your username.";

  if (!v.confirmPassword) errors.confirmPassword = "Please confirm your password.";
  else if (v.confirmPassword !== p) errors.confirmPassword = "Passwords do not match.";

  return errors;
}

function render(errors, only) {
  (only ? [only] : FIELDS).forEach((name) => setFieldError(form, name, errors[name]));
}

form.elements.password.addEventListener("input", updatePasswordUi);
updatePasswordUi();

// Validate a field when the user leaves it, and live once it has shown an error.
form.addEventListener("focusout", (event) => {
  if (FIELDS.includes(event.target.name) && event.target.value) render(validate(), event.target.name);
});
form.addEventListener("input", (event) => {
  if (event.target.getAttribute("aria-invalid") === "true") render(validate(), event.target.name);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  showAlert(alertEl, "");
  const errors = validate();
  render(errors);
  const firstInvalid = FIELDS.find((f) => errors[f]);
  if (firstInvalid) return form.elements[firstInvalid].focus();

  const label = { busy: "Creating account…", idle: "Create account" };
  setLoading(submit, true, label);
  try {
    await apiRequest("POST", "/api/auth/register", {
      email: form.elements.email.value.trim(),
      username: form.elements.username.value.trim(),
      password: form.elements.password.value,
      confirmPassword: form.elements.confirmPassword.value,
    });
    location.assign("/dashboard?welcome=1");
  } catch (error) {
    // 409 duplicate email/username and 400 validation errors come with per-field details.
    error.details.forEach((d) => setFieldError(form, d.field, d.message));
    showAlert(alertEl, error.status === 409 ? "That email or username is already registered." : error.message);
    const first = error.details[0]?.field;
    if (first && form.elements[first]) form.elements[first].focus();
    setLoading(submit, false, label);
  }
});
