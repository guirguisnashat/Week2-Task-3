/**
 * Consistent JSON errors:  { "error": { "status", "message", "details"? } }
 * Unexpected errors are logged on the server, and the client gets a generic message.
 */
const ApiError = require("../utils/ApiError");

const notFound = (req, _res, next) => next(new ApiError(404, `Route ${req.method} ${req.originalUrl} not found`));

// eslint-disable-next-line no-unused-vars -- Express needs the 4-argument signature
function errorHandler(err, _req, res, _next) {
  let status = err.status || err.statusCode || 500;
  let message = err.message;
  let details = err.details;

  if (err.type === "entity.parse.failed") {
    status = 400;
    message = "Request body contains invalid JSON";
  } else if (err.type === "entity.too.large") {
    status = 413;
    message = "Request body is too large";
  } else if (!(err instanceof ApiError) && status >= 500) {
    console.error(err);
    message = "Internal server error";
    details = undefined;
  }

  res.status(status).json({ error: { status, message, ...(details && { details }) } });
}

module.exports = { notFound, errorHandler };
