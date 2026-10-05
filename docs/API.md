# Classlist API Documentation

## Overview

Classlist uses Vercel Serverless Functions, `@libsql/client`, local SQLite during development, and Turso in production.

Local base URL:

```text
http://localhost:3000
```

---

## Authentication

The administrator credentials are stored in environment variables:

```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-password
```

A successful login:

1. Verifies the username and password.
2. Generates a random session token.
3. Stores the token in the `sessions` table.
4. Sends the token as an HTTP-only browser cookie named `session_token`.

The cookie is a **browser-session cookie**. It does not specify `Max-Age` or `Expires`, so the application does not intentionally make the cookie persistent.

The session is shared automatically across tabs and windows belonging to the same browser profile.

The application therefore supports:

```text
Same browser
├── Tab 1 ──┐
├── Tab 2 ──┤
├── Tab 3 ──┤── Same session cookie
└── Window ──┘
```

Closing a tab does not log the user out.

The browser may restore session cookies when restoring a previous browser session, depending on the browser's session-restore behavior. The application itself does not set a persistent cookie.

Protected requests must include the `session_token` cookie.

---

## Session Validation

The frontend checks the current login state using:

```http
GET /api/session
```

This check runs when the application starts.

While the session is being checked, the application displays the session-loading screen instead of rendering the main attendance interface.

If the session is valid:

```text
Checking session
       ↓
Session valid
       ↓
Load attendance data
       ↓
Show attendance section
```

If the session is invalid or missing:

```text
Checking session
       ↓
Session invalid
       ↓
Show login section
```

An invalid or expired session results in:

```http
401 Unauthorized
```

---

## Browser Session Behavior

The application uses a browser-session cookie rather than a persistent cookie.

The login endpoint does **not** set:

```text
Max-Age
Expires
```

Therefore the cookie is intended to exist only for the browser session.

The cookie is configured with:

```text
HttpOnly
Path=/
SameSite=Lax
```

In production, the `Secure` attribute is also added:

```text
Secure
```

The `HttpOnly` attribute prevents JavaScript from directly reading the authentication cookie.

---

## Endpoint Summary

| Method   | Endpoint            | Purpose                     | Authentication |
| -------- | ------------------- | --------------------------- | -------------- |
| `GET`    | `/api/test`         | Test database connection    | No             |
| `POST`   | `/api/login`        | Log in administrator        | No             |
| `GET`    | `/api/session`      | Check current login session | Cookie         |
| `POST`   | `/api/logout`       | Log out current session     | Cookie         |
| `GET`    | `/api/sheets/`      | List saved sheet dates      | Yes            |
| `GET`    | `/api/sheets/:date` | Get a sheet                 | Yes            |
| `PUT`    | `/api/sheets/:date` | Create or update a sheet    | Yes            |
| `DELETE` | `/api/sheets/:date` | Delete a sheet              | Yes            |

The date format is:

```text
YYYY-MM-DD
```

Example:

```text
2026-09-21
```

Future dates are not allowed by the frontend.

---

# 1. Test Database Connection

```http
GET /api/test
```

This endpoint tests whether the database connection is working.

### Successful response

```json
{
  "success": true,
  "message": "Database connection successful",
  "database": true
}
```

### Failed response

```json
{
  "success": false,
  "message": "Database connection failed",
  "error": "..."
}
```

---

# 2. Login

```http
POST /api/login
Content-Type: application/json
```

### Request body

```json
{
  "username": "admin",
  "password": "your-password"
}
```

The credentials are compared with:

```env
ADMIN_USERNAME
ADMIN_PASSWORD
```

### Successful response

```json
{
  "success": true,
  "message": "Login successful"
}
```

The response also sets the `session_token` HTTP-only cookie.

### Possible errors

Missing credentials:

```json
{
  "error": "Username and password are required"
}
```

Status:

```text
400 Bad Request
```

Invalid credentials:

```json
{
  "error": "Invalid username or password"
}
```

Status:

```text
401 Unauthorized
```

---

# 3. Check Session

```http
GET /api/session
```

This endpoint checks whether the current browser has a valid authenticated session.

The browser automatically sends the `session_token` cookie.

### Authenticated response

The endpoint returns a response indicating that the session is authenticated.

Example:

```json
{
  "authenticated": true
}
```

The frontend uses this response during application startup before showing the attendance section.

### Unauthenticated response

If the session is missing, invalid, or expired:

```http
401 Unauthorized
```

The frontend then displays the login section.

---

# 4. Logout

```http
POST /api/logout
```

The endpoint:

1. Reads the `session_token` cookie.
2. Deletes the corresponding session from the `sessions` table.
3. Clears the browser cookie.

### Successful response

```json
{
  "success": true,
  "message": "Logout successful"
}
```

Logout also resets the frontend application state.

The attendance sidebar is closed when logging out so that it cannot remain open when the login screen is displayed.

---

# 5. List Saved Sheets

```http
GET /api/sheets/
```

Authentication is required.

The endpoint returns the dates for which attendance sheets have been saved.

### Successful response

```json
{
  "sheets": [
    {
      "date": "2026-09-21",
      "updated_at": "2026-09-21 14:40:30"
    }
  ]
}
```

The frontend uses this list to populate the saved-date interface.

---

# 6. Get a Sheet

```http
GET /api/sheets/2026-09-21
```

Authentication is required.

### Successful response

```json
{
  "date": "2026-09-21",
  "data": {
    "columns": ["Name", "Monday", "Tuesday"],
    "rows": [
      ["John", "Present", "Present"],
      ["Mary", "Absent", "Present"]
    ]
  }
}
```

If the sheet does not exist:

```json
{
  "error": "Sheet not found"
}
```

Status:

```text
404 Not Found
```

---

# 7. Create or Update a Sheet

```http
PUT /api/sheets/2026-09-21
Content-Type: application/json
```

Authentication is required.

### Request body

```json
{
  "columns": ["Name", "Monday", "Tuesday"],
  "rows": [
    ["John", "Present", "Present"],
    ["Mary", "Absent", "Present"]
  ]
}
```

The endpoint uses an upsert operation.

If the date already exists, the existing sheet is updated.

If the date does not exist, a new sheet is created.

### Successful response

```json
{
  "message": "Sheet saved successfully",
  "date": "2026-09-21"
}
```

If `columns` or `rows` is missing:

```json
{
  "error": "Invalid sheet data"
}
```

Status:

```text
400 Bad Request
```

---

# 8. Delete a Sheet

```http
DELETE /api/sheets/2026-09-21
```

Authentication is required.

The endpoint permanently removes the saved attendance sheet for that date.

### Successful response

```json
{
  "message": "Sheet deleted successfully"
}
```

The frontend also removes the deleted date from the saved-date list and creates a fresh empty sheet for the currently selected date.

---

# 9. Future Date Restriction

Attendance sheets cannot be accessed for dates in the future.

The frontend compares the selected date with today's date.

For example, if today is:

```text
2026-09-21
```

then:

```text
2026-09-20  ✓ Allowed
2026-09-21  ✓ Allowed
2026-09-22  ✗ Not allowed
```

The date picker is also restricted using its `max` value:

```html
<input type="date" id="datePicker" />
```

The JavaScript sets:

```js
datePicker.max = getTodayDate();
```

The previous and next date controls also prevent moving beyond today's date.

If a future date is selected manually, the application displays:

```text
Future dates cannot be accessed.
```

and restores the currently selected valid date.

---

# 10. Date Navigation

The frontend supports:

- Previous date
- Next date
- Today
- Date picker
- Previous month
- Next month
- Saved attendance dates

The currently selected date is stored in:

```js
currentDate;
```

The displayed month is stored in:

```js
displayedMonth;
```

The application does not allow navigation beyond the current date.

---

# 11. Sheet Reset

The frontend provides a reset option for the current attendance sheet.

Resetting a sheet:

1. Asks the user for confirmation.
2. Sends a `DELETE` request.
3. Removes the date from `savedDates`.
4. Removes the sheet from the local JavaScript cache.
5. Creates a new empty sheet.
6. Re-renders the table.
7. Updates the saved-date list.

The API operation is:

```http
DELETE /api/sheets/:date
```

---

# 12. Sheet Data Format

A sheet is stored in the database as JSON in the `data` column.

Example:

```json
{
  "columns": ["Name", "Monday", "Tuesday"],
  "rows": [
    ["John", "Present", "Present"],
    ["Mary", "Absent", "Present"]
  ]
}
```

The frontend converts the database data back into the editable attendance table.

---

# Status Codes

| Status | Meaning                           |
| ------ | --------------------------------- |
| `200`  | Request successful                |
| `400`  | Missing or invalid request data   |
| `401`  | Authentication failed or required |
| `404`  | Sheet not found                   |
| `405`  | HTTP method is not supported      |
| `500`  | Internal server or database error |

---

# Database Tables

## `sheets`

```sql
CREATE TABLE IF NOT EXISTS sheets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  data TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

The `data` column stores the attendance sheet as JSON.

The `date` column is unique, allowing one saved attendance sheet per date.

---

## `sessions`

```sql
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT NOT NULL UNIQUE,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL
);
```

The `token` contains a randomly generated session token.

The `expires_at` column stores the server-side expiration time for the session.

The browser authentication cookie itself is configured as a browser-session cookie rather than a persistent cookie.

---

# API File Mapping

```text
api/test.js
    -> GET /api/test

api/login.js
    -> POST /api/login

api/session.js
    -> GET /api/session

api/logout.js
    -> POST /api/logout

api/sheets/index.js
    -> GET /api/sheets/

api/sheets/[date].js
    -> GET, PUT, DELETE /api/sheets/:date
```

The `[date]` filename is a dynamic Vercel route parameter.

---

# REST Client Examples

## Test connection

```http
GET http://localhost:3000/api/test
```

## Login

```http
POST http://localhost:3000/api/login
Content-Type: application/json

{
  "username": "admin",
  "password": "your-password"
}
```

## Check session

```http
GET http://localhost:3000/api/session
```

## List sheets

```http
GET http://localhost:3000/api/sheets/
```

## Get sheet

```http
GET http://localhost:3000/api/sheets/2026-09-21
```

## Save sheet

```http
PUT http://localhost:3000/api/sheets/2026-09-21
Content-Type: application/json

{
  "columns": ["Name", "Monday"],
  "rows": [["John", "Present"]]
}
```

## Delete sheet

```http
DELETE http://localhost:3000/api/sheets/2026-09-21
```

## Logout

```http
POST http://localhost:3000/api/logout
```

---

# Frontend Authentication Flow

The application startup follows this sequence:

```text
Page loads
    ↓
Show "Checking session"
    ↓
GET /api/session
    ↓
    ├── 401 / unauthenticated
    │       ↓
    │   Show login section
    │
    └── authenticated
            ↓
        Initialize application
            ↓
        Load saved dates
            ↓
        Load current sheet
            ↓
        Show attendance section
```

After a successful login:

```text
Login form
    ↓
POST /api/login
    ↓
Session cookie created
    ↓
Initialize application
    ↓
Load saved dates
    ↓
Load current sheet
    ↓
Show attendance section
```

The attendance section remains hidden while the login/session state is being determined. This prevents the empty/default attendance table from briefly appearing during a page refresh or login.

---

# Security Notes

Never expose:

```text
ADMIN_PASSWORD
TURSO_AUTH_TOKEN
session tokens
```

Keep credentials and database authentication values on the server.

The session cookie uses:

```text
HttpOnly
SameSite=Lax
Path=/
```

For production, the cookie also uses:

```text
Secure
```

Protected API routes must validate the session rather than trusting frontend state.

The frontend hiding the attendance section is only a UI behavior; authorization is enforced by the backend API.
