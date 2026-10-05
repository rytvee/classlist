import { createClient } from "@libsql/client";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const localDatabasePath = path.join(__dirname, "../data/attendance.db");

const databaseUrl =
  process.env.TURSO_DATABASE_URL || `file:${localDatabasePath}`;

export const db = createClient({
  url: databaseUrl,
  authToken: process.env.TURSO_AUTH_TOKEN,
});
