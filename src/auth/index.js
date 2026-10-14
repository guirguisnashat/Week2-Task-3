/**
 * Auth module entry point. Everything authentication-related lives in this
 * folder; the rest of the app only uses what this function returns:
 *
 *   const auth = createAuthModule(db);
 *   app.use("/api/auth", auth.router);
 *   app.get("/api/secret", auth.requireAuth, handler);
 */
const { createUserModel } = require("../users/user.model");
const { createAuthService } = require("./auth.service");
const { createAuthController } = require("./auth.controller");
const { createAuthMiddleware } = require("./auth.middleware");
const { createAuthRouter } = require("./auth.routes");

function createAuthModule(db) {
  const service = createAuthService(createUserModel(db));
  const middleware = createAuthMiddleware(service);
  const router = createAuthRouter(createAuthController(service), middleware);
  return { service, router, ...middleware };
}

module.exports = { createAuthModule };
