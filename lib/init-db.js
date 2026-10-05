import { db } from "./db.js";

export async function initializeDatabase() {
  // ==========================================
  // SHEETS
  // ==========================================

  await db.execute(`
    CREATE TABLE IF NOT EXISTS sheets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      data TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ==========================================
  // SESSIONS
  // ==========================================

  await db.execute(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT NOT NULL UNIQUE,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      expires_at TEXT NOT NULL
    )
  `);

  // ==========================================
  // DELETE EXPIRED SESSIONS
  // ==========================================

  await db.execute(`
    DELETE FROM sessions
    WHERE expires_at <= datetime('now')
  `);
}