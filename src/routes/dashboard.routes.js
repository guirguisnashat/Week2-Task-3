/**
 * Example protected API resource: GET /api/dashboard
 * Only reachable with a valid, non-revoked session (enforced by requireAuth).
 */
const express = require("express");

function createDashboardRouter(authService, { requireAuth }) {
  const router = express.Router();

  router.get("/", requireAuth, (req, res) => {
    const sessions = authService.listSessions(req.user.id).map((s) => ({
      ...s,
      id: undefined, // never expose session ids (they are the JWT ids)
      current: s.id === req.sessionId,
    }));
    res.json({
      user: req.user,
      sessions,
      stats: { activeSessions: sessions.length, totalLogins: authService.countSessions(req.user.id) },
    });
  });

  return router;
}

module.exports = { createDashboardRouter };
