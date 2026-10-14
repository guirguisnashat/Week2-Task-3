/**
 * An error that maps to an HTTP response. The error handler turns it into:
 *   { "error": { "status", "message", "details"? } }
 */
class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

module.exports = ApiError;
