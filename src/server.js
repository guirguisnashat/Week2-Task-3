/**
 * Entry point. `npm start` loads .env (if present), opens the database and listens.
 */
const config = require("./config");
const { openDatabase } = require("./db");
const { createApp } = require("./app");

const db = openDatabase();
const server = createApp(db).listen(config.port, () => {
  console.log(`Auth system running at http://localhost:${config.port} (${config.env})`);
});

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
