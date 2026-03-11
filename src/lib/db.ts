import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export function createDb(path: string): Database.Database {
  if (path !== ":memory:") {
    mkdirSync(dirname(path), { recursive: true });
  }

  const db = new Database(path);

  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      intensity TEXT NOT NULL CHECK (intensity IN ('mycket', 'mellan', 'lite')),
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_movements_created_at ON movements(created_at);
  `);

  db.pragma("user_version = 1");

  return db;
}

export function getDb(): Database.Database {
  const g = globalThis as unknown as { __movemonitorDb?: Database.Database };
  if (!g.__movemonitorDb) {
    g.__movemonitorDb = createDb(
      process.env.DB_PATH ?? "./data/movemonitor.db"
    );
  }
  return g.__movemonitorDb;
}
