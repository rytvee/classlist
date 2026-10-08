import { db } from "../lib/db.js";

export default async function handler(req, res) {
  try {
    const result = await db.execute(`
            SELECT 1 AS connected
        `);

    return res.status(200).json({
      success: true,
      message: "Database connection successful",
      database: result.rows[0].connected === 1,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Database connection failed",
      error: error.message,
    });
  }
}
