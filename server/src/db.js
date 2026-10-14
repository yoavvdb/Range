// One SQLite file (Node's built-in driver). Every row that belongs to a person carries user_id and is
// deleted with the account.
import { DatabaseSync } from "node:sqlite";

export function openDb(file) {
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, pw TEXT NOT NULL, created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS connections (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider TEXT NOT NULL, label TEXT, secret BLOB, state BLOB, options TEXT,
      status TEXT NOT NULL DEFAULT 'pending', error TEXT, info TEXT,
      last_sync INTEGER, next_sync INTEGER NOT NULL DEFAULT 0, fails INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS workouts (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      conn_id TEXT NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
      date TEXT NOT NULL, title TEXT, text TEXT, result TEXT, logged_at TEXT, source TEXT,
      PRIMARY KEY (user_id, conn_id, date));
    CREATE TABLE IF NOT EXISTS app_state (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, data TEXT NOT NULL, updated INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS push_subs (
      endpoint TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, sub TEXT NOT NULL);
  `);
  return db;
}
