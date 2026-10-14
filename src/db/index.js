/**
 * SQLite connection + migration runner (each .sql file in ./migrations runs once,
 * in filename order, and is recorded in the schema_migrations table).
 */
const fs = require("node:fs");
const path = require("node:path");
const Database = require("better-sqlite3");
const config = require("../config");

const MIGRATIONS_DIR = path.join(__dirname, "migrations");

function runMigrations(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  )`);
  const applied = new Set(db.prepare("SELECT name FROM schema_migrations").pluck().all());
  const record = db.prepare("INSERT INTO schema_migrations (name) VALUES (?)");

  for (const file of fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort()) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    db.transaction(() => {
      db.exec(sql);
      record.run(file);
    })();
  }
}

/** Open (or create) the database and apply pending migrations. */
function openDatabase(filename = config.dbPath) {
  if (filename !== ":memory:") fs.mkdirSync(path.dirname(filename), { recursive: true });
  const db = new Database(filename);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON"); // enforce sessions.user_id → users.id
  runMigrations(db);
  return db;
}

module.exports = { openDatabase };
