/**
 * Express application factory (the database is passed in, so tests can use
 * an in-memory one).
 *
 * Request pipeline:
 *   helmet (security headers) → JSON body parser (10 KB max) → cookie parser
 *   → origin check on /api → API routes → HTML pages → static assets → errors
 */
const path = require("node:path");
const express = require("express");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const { createAuthModule } = require("./auth");
const { createDashboardRouter } = require("./routes/dashboard.routes");
const originCheck = require("./middleware/originCheck");
const { notFound, errorHandler } = require("./middleware/errorHandler");

const VIEWS = path.join(__dirname, "..", "views");

function createApp(db) {
  const app = express();
  const auth = createAuthModule(db);

  app.disable("x-powered-by");
  app.set("trust proxy", "loopback"); // correct req.ip / protocol behind a local reverse proxy

  // Security headers: Content-Security-Policy, X-Frame-Options, HSTS (prod), etc.
  // The CSP only allows scripts from this origin, so injected <script> tags won't run.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          "default-src": ["'self'"],
          "script-src": ["'self'"],
          "style-src": ["'self'", "https://fonts.googleapis.com"],
          "font-src": ["'self'", "https://fonts.gstatic.com"],
          "img-src": ["'self'", "data:"],
          "form-action": ["'self'"],
          "frame-ancestors": ["'none'"],
        },
      },
    })
  );
  app.use(express.json({ limit: "10kb" }));
  app.use(cookieParser());

  // ---- API ----
  app.use("/api", originCheck);
  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
  app.use("/api/auth", auth.router);
  app.use("/api/dashboard", createDashboardRouter(auth.service, auth));
  app.use("/api", notFound);

  // ---- Pages ----
  const page = (name) => (_req, res) => res.sendFile(path.join(VIEWS, `${name}.html`));
  app.get("/", auth.redirectIfAuthenticated, (_req, res) => res.redirect("/login"));
  app.get("/login", auth.redirectIfAuthenticated, page("login"));
  app.get("/register", auth.redirectIfAuthenticated, page("register"));
  app.get("/dashboard", auth.requirePageAuth, page("dashboard")); // protected page

  // ---- Static assets (CSS / JS) ----
  app.use(express.static(path.join(__dirname, "..", "public"), { index: false }));

  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
