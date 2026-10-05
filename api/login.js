import crypto from "crypto";
import { db } from "../lib/db.js";
import { initializeDatabase } from "../lib/init-db.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  try {
    await initializeDatabase();

    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        error: "Username and password are required",
      });
    }

    if (
      username !== process.env.ADMIN_USERNAME ||
      password !== process.env.ADMIN_PASSWORD
    ) {
      return res.status(401).json({
        error: "Invalid username or password",
      });
    }

    // ==========================================
    // CREATE SESSION
    // ==========================================

    const token = crypto.randomBytes(32).toString("hex");

    // Server-side maximum lifetime: 24 hours.
    const expiresAt = new Date(
      Date.now() + 24 * 60 * 60 * 1000
    ).toISOString();

    await db.execute({
      sql: `
        INSERT INTO sessions (
          token,
          expires_at
        )
        VALUES (?, ?)
      `,
      args: [token, expiresAt],
    });

    // ==========================================
    // SESSION COOKIE
    // ==========================================

    // No Max-Age.
    // No Expires.
    //
    // Therefore this is a session cookie.
    //
    // It is shared across tabs and windows.

    const secureFlag =
      process.env.NODE_ENV === "production"
        ? "; Secure"
        : "";

    res.setHeader(
      "Set-Cookie",
      `session_token=${token}; HttpOnly; Path=/; SameSite=Lax${secureFlag}`
    );

    return res.status(200).json({
      success: true,
      message: "Login successful",
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      error: "Internal server error",
    });
  }
}