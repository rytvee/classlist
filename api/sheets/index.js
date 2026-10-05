import { db } from "../../lib/db.js";
import { initializeDatabase } from "../../lib/init-db.js";
import { authenticate } from "../../lib/auth.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  try {
    await initializeDatabase();

    // Check login
    const session = await authenticate(req);

    if (!session) {
      return res.status(401).json({
        error: "Unauthorized",
      });
    }

    const result = await db.execute(`
            SELECT date, updated_at
            FROM sheets
            ORDER BY date DESC
        `);

    return res.status(200).json({
      sheets: result.rows,
    });
  } catch (error) {
    console.error("Database error:", error);

    return res.status(500).json({
      error: "Internal server error",
    });
  }
}
