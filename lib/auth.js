import { db } from "./db.js";

export async function authenticate(req) {
  const cookieHeader = req.headers.cookie;

  if (!cookieHeader) {
    return null;
  }

  const cookies = {};

  cookieHeader.split(";").forEach((cookie) => {
    const [name, ...value] = cookie.trim().split("=");

    cookies[name] = decodeURIComponent(value.join("="));
  });

  const token = cookies.session_token;

  if (!token) {
    return null;
  }

  const result = await db.execute({
    sql: `
            SELECT id, token, expires_at
            FROM sessions
            WHERE token = ?
        `,
    args: [token],
  });

  if (result.rows.length === 0) {
    return null;
  }

  const session = result.rows[0];

  // Check expiration
  if (new Date(session.expires_at) <= new Date()) {
    await db.execute({
      sql: `
                DELETE FROM sessions
                WHERE token = ?
            `,
      args: [token],
    });

    return null;
  }

  return session;
}
