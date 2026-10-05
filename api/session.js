import { db } from "../lib/db.js";
import { initializeDatabase } from "../lib/init-db.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  try {
    await initializeDatabase();

    // ==========================================
    // READ COOKIE
    // ==========================================

    const cookieHeader = req.headers.cookie;

    if (!cookieHeader) {
      return res.status(401).json({
        authenticated: false,
      });
    }

    const cookies = {};

    cookieHeader.split(";").forEach((cookie) => {
      const [name, ...value] = cookie.trim().split("=");

      cookies[name] = decodeURIComponent(value.join("="));
    });

    const token = cookies.session_token;

    if (!token) {
      return res.status(401).json({
        authenticated: false,
      });
    }

    // ==========================================
    // FIND SESSION
    // ==========================================

    const result = await db.execute({
      sql: `
        SELECT token, expires_at
        FROM sessions
        WHERE token = ?
        LIMIT 1
      `,
      args: [token],
    });

    if (result.rows.length === 0) {
      return res.status(401).json({
        authenticated: false,
      });
    }

    const session = result.rows[0];

    // ==========================================
    // CHECK EXPIRATION
    // ==========================================

    if (new Date(session.expires_at) <= new Date()) {
      await db.execute({
        sql: `
          DELETE FROM sessions
          WHERE token = ?
        `,
        args: [token],
      });

      return res.status(401).json({
        authenticated: false,
      });
    }

    // ==========================================
    // VALID SESSION
    // ==========================================

    return res.status(200).json({
      authenticated: true,
    });
  } catch (error) {
    console.error("Session check error:", error);

    return res.status(500).json({
      authenticated: false,
      error: "Internal server error",
    });
  }
}