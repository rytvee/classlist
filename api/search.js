import { db } from "../lib/db.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  try {
    // ==========================================
    // CHECK SESSION
    // ==========================================

    const cookieHeader = req.headers.cookie;

    if (!cookieHeader) {
      return res.status(401).json({
        error: "Authentication required",
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
        error: "Authentication required",
      });
    }

    const sessionResult = await db.execute({
      sql: `
        SELECT token
        FROM sessions
        WHERE token = ?
          AND expires_at > CURRENT_TIMESTAMP
      `,
      args: [token],
    });

    if (sessionResult.rows.length === 0) {
      return res.status(401).json({
        error: "Session expired",
      });
    }

    // ==========================================
    // GET SEARCH QUERY
    // ==========================================

    const query = String(req.query.q || "").trim();

    if (!query) {
      return res.status(200).json({
        query: "",
        dates: [],
        latestDate: null,
      });
    }

    // Split a search such as:
    //
    // "john present"
    //
    // into:
    //
    // ["john", "present"]
    //
    // Every search word must be found in the
    // saved sheet.
    const searchWords = query
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);

    // ==========================================
    // GET SAVED SHEETS
    // ==========================================

    const result = await db.execute(`
      SELECT date, data, updated_at
      FROM sheets
      ORDER BY date DESC
    `);

    // ==========================================
    // SEARCH SHEET DATA
    // ==========================================

    const matchingDates = [];

    for (const row of result.rows) {
      const searchableText = String(row.data || "").toLowerCase();

      const matches = searchWords.every((word) =>
        searchableText.includes(word),
      );

      if (matches) {
        matchingDates.push({
          date: row.date,
          updated_at: row.updated_at,
        });
      }
    }

    // Database dates are already sorted newest first.
    const latestDate =
      matchingDates.length > 0 ? matchingDates[0].date : null;

    // ==========================================
    // GROUP RESULTS BY MONTH
    // ==========================================

    const months = {};

    for (const sheet of matchingDates) {
      const month = sheet.date.substring(0, 7);

      if (!months[month]) {
        months[month] = [];
      }

      months[month].push(sheet.date);
    }

    return res.status(200).json({
      query,
      dates: matchingDates.map((sheet) => sheet.date),
      months,
      latestDate,
    });
  } catch (error) {
    console.error("Search error:", error);

    return res.status(500).json({
      error: "Internal server error",
    });
  }
}