import { db } from "../lib/db.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  try {
    const cookieHeader = req.headers.cookie;

    if (cookieHeader) {
      const cookies = {};

      cookieHeader.split(";").forEach((cookie) => {
        const [name, ...value] = cookie.trim().split("=");

        cookies[name] = decodeURIComponent(value.join("="));
      });

      const token = cookies.session_token;

      if (token) {
        await db.execute({
          sql: `
            DELETE FROM sessions
            WHERE token = ?
          `,
          args: [token],
        });
      }
    }

    // ==========================================
    // DELETE COOKIE
    // ==========================================

    const secureFlag =
      process.env.NODE_ENV === "production"
        ? "; Secure"
        : "";

    res.setHeader(
      "Set-Cookie",
      `session_token=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax${secureFlag}`
    );

    return res.status(200).json({
      success: true,
      message: "Logout successful",
    });
  } catch (error) {
    console.error("Logout error:", error);

    return res.status(500).json({
      error: "Internal server error",
    });
  }
}