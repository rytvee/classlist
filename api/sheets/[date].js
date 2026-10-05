import { db } from "../../lib/db.js";
import { initializeDatabase } from "../../lib/init-db.js";
import { authenticate } from "../../lib/auth.js";

function getTodayDate() {
  const date = new Date();

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export default async function handler(req, res) {
  const { date } = req.query;

  const session = await authenticate(req);

  if (!date) {
    return res.status(400).json({
      error: "Date is required",
    });
  }

  try {
    await initializeDatabase();

    if (!session) {
      return res.status(401).json({
        error: "Unauthorized",
      });
    }

    // Prevent access to future dates
    if (date > getTodayDate()) {
      return res.status(400).json({
        error: "Future dates cannot be accessed.",
      });
    }

    // GET SHEET
    if (req.method === "GET") {
      const result = await db.execute({
        sql: `
          SELECT date, data
          FROM sheets
          WHERE date = ?
        `,
        args: [date],
      });

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: "Sheet not found",
        });
      }

      return res.status(200).json({
        date: result.rows[0].date,
        data: JSON.parse(result.rows[0].data),
      });
    }

    // SAVE SHEET
    if (req.method === "PUT") {
      const sheet = req.body;

      if (!sheet || !sheet.columns || !sheet.rows) {
        return res.status(400).json({
          error: "Invalid sheet data",
        });
      }

      const data = JSON.stringify(sheet);

      await db.execute({
        sql: `
          INSERT INTO sheets (date, data)
          VALUES (?, ?)

          ON CONFLICT(date)
          DO UPDATE SET
              data = excluded.data,
              updated_at = CURRENT_TIMESTAMP
        `,
        args: [date, data],
      });

      return res.status(200).json({
        message: "Sheet saved successfully",
        date,
      });
    }

    // DELETE SHEET
    if (req.method === "DELETE") {
      await db.execute({
        sql: `
          DELETE FROM sheets
          WHERE date = ?
        `,
        args: [date],
      });

      return res.status(200).json({
        message: "Sheet deleted successfully",
      });
    }

    return res.status(405).json({
      error: "Method not allowed",
    });
  } catch (error) {
    console.error("Database error:", error);

    return res.status(500).json({
      error: "Internal server error",
    });
  }
}
