# Debugging Report

This is a real log of the bugs hit while getting this Student Management
System working end-to-end, in the order they were found — not a
hypothetical list. Each one blocked actual progress and had to be
diagnosed from the error message before it could be fixed.

---

### Bug 1 — `Error: Cannot find module '...\server.js'`

**Symptom:** Running `node server.js` from the project root immediately
threw `MODULE_NOT_FOUND`.

**Diagnosis:** `dir` on the project root showed no `server.js` at that
level — the file actually lived one level down, inside a `backend/`
folder.

**Fix:** `cd backend` before running `node server.js`. Lesson: always
confirm the working directory matches where the entry file actually is,
especially in a project with both a frontend and a backend folder side by
side.

---

### Bug 2 — MongoDB Atlas: `querySrv ECONNREFUSED _mongodb._tcp.cluster0...`

**Symptom:**
```
MongoDB connection error: Error: querySrv ECONNREFUSED _mongodb._tcp.cluster0.ykxulii.mongodb.net
```

**Diagnosis:** `mongodb+srv://` connection strings require a DNS **SRV**
record lookup, which is a different query type than a normal A-record
lookup. Running `nslookup cluster0.ykxulii.mongodb.net` succeeded (normal
DNS was fine), which isolated the problem to SRV lookups specifically
being blocked by the local network/router — a common issue on some
ISPs/routers in India.

**Fix:** Switched from the `mongodb+srv://` connection string to the
non-SRV "standard connection string" format from Atlas (`mongodb://` with
each shard host and port listed explicitly, comma-separated). This
bypasses the SRV DNS lookup entirely.

**Lesson:** When a connection error mentions DNS (`ECONNREFUSED`,
`ENOTFOUND`, `querySrv`), test plain DNS resolution (`nslookup`) first to
tell apart "my network is broken" from "my connection string/credentials
are wrong" — they need completely different fixes.

---

### Bug 3 — `.env` silently stopped loading (`injected env (0) from .env`)

**Symptom:** After manually editing `.env`, mongoose failed with:
```
MongooseError: The `uri` parameter to `openUri()` must be a string, got "undefined".
```
and the startup log showed `injected env (0) from .env` — zero variables
loaded, down from 2 before the edit.

**Diagnosis:** The `.env` file had been overwritten with just the raw
connection string and no `KEY=VALUE` format, so `process.env.MONGO_URI`
was genuinely `undefined`. A second issue found in the same file: the
password was still the literal placeholder `<db_password>` copied from
the Atlas UI instead of the real password.

**Fix:** Rewrote `.env` as `MONGO_URI=mongodb://user:REAL_PASSWORD@...`
on a single line, no spaces around `=`, with the real database password
substituted in.

**Lesson:** `.env` files fail silently — a malformed line doesn't throw a
parsing error, it just results in the variable being `undefined` later,
often several layers away from the actual mistake. `.env.example` (added
in this submission) documents the expected format so this doesn't happen
again.

---

### Bug 4 — `ReferenceError: PORT is not defined`

**Symptom:**
```
MongoDB Connected
MongoDB connection error: ReferenceError: PORT is not defined
```

**Diagnosis:** `server.js` referenced a `PORT` variable in
`app.listen(PORT, ...)` that was never declared — it needed to come from
`process.env.PORT` with a fallback.

**Fix:** Added `PORT=5000` to `.env` and used
`const PORT = process.env.PORT || 5000;` in `server.js`.

---

### Bug 5 — `E11000 duplicate key error ... index: email_1`

**Symptom:** Submitting the add-student form a second time with the same
email threw a raw MongoDB duplicate-key error, surfaced to the user as an
ugly/unclear alert.

**Diagnosis:** The `email` field has `unique: true` in the schema (by
design — two students shouldn't share an email), but the controller had
no `try/catch`, so the raw MongoDB error object leaked straight to the
client as a `500` with no useful `message`.

**Fix (this submission):** `controllers/studentController.js` now catches
`err.code === 11000` specifically and responds `409 { message: "Email is
already registered" }`. Covered by both a unit test (mocked) and an
integration test (real duplicate insert against the in-memory DB).

---

### Bug 6 — Frontend/backend URL mismatch (`API_URL` pointed at the wrong port and path)

**Symptom:** The browser alert said "Server connection failed" even
though the backend terminal showed `Server running on port 3000` /
`5000` with no errors.

**Diagnosis:** `script.js` had `API_URL = "http://localhost:5000/students"`,
but the backend mounts the router at `/api/students`
(`app.use('/api/students', studentRoutes)`), and at one point the ports
didn't match either. Every request from the frontend was hitting a route
that didn't exist, which `fetch` reports to the browser as a generic
network/connection failure, not a helpful 404.

**Fix:** Corrected `API_URL` to
`http://localhost:5000/api/students`. Confirmed with an integration test
that asserts the frontend's exact URL against the backend's real mounted
route, so this specific mismatch can't silently regress again.

---

### Bug 7 (found during this week's code review, not previously reported) — No error handling in controllers at all

**Symptom:** None yet observed by the user, but confirmed by reading the
code: every controller function (`getAll`, `getOne`, `create`, `update`,
`remove`) had zero `try/catch`. An invalid MongoDB ObjectId in the URL
(e.g. `GET /api/students/12345`) would throw a `CastError` with no
handler, an unhandled duplicate email would return an unformatted `500`,
and a database outage would crash the request instead of returning a
clean error.

**Fix:** Rewrote every controller function with `try/catch`, explicit
`ObjectId` validation, and specific status codes (`400` invalid input,
`404` not found, `409` duplicate, `500` unexpected). Added a centralized
`errorHandler` + `notFound` middleware in `app.js` as a safety net for
anything a controller doesn't handle itself. This is the change most
directly validated by the test suite — nearly every integration test
exists specifically to prove one of these error paths responds correctly
instead of crashing.

---

### Bug 8 (found while writing tests) — `package.json` had no dependencies listed

**Symptom:** `backend/package.json` contained only `name`, `version`, and
`main` — no `dependencies` at all, despite `express`, `mongoose`, `cors`,
and `dotenv` being required in the code. The project only worked locally
because `node_modules` already existed from earlier manual
`npm install` commands.

**Fix:** Added a proper `dependencies`/`devDependencies` block to
`package.json` so `npm install` on a fresh clone actually reproduces a
working environment — this is also what made it possible to install and
run the test suite in a clean environment for this submission.

---

## Summary table

| # | Bug | Symptom | Root cause | Fix |
|---|---|---|---|---|
| 1 | Wrong working directory | `MODULE_NOT_FOUND` | `server.js` inside `backend/`, ran from root | `cd backend` |
| 2 | SRV DNS blocked | `querySrv ECONNREFUSED` | Network blocks SRV lookups | Non-SRV connection string |
| 3 | Malformed `.env` | `uri ... got "undefined"` | Missing `KEY=`, placeholder password | Rewrote `.env` correctly |
| 4 | Undefined `PORT` | `ReferenceError: PORT is not defined` | Variable never declared | `process.env.PORT \|\| 5000` |
| 5 | Duplicate email crash | Raw `E11000` error to user | No error handling on `create` | Catch `code 11000` → `409` |
| 6 | Wrong frontend URL | "Server connection failed" | Port + path mismatch | Fixed `API_URL` |
| 7 | No error handling anywhere | (latent bug) | Missing `try/catch` in all controllers | Full rewrite + centralized handler |
| 8 | Missing `package.json` deps | Works locally, breaks on fresh install | Deps never added to `package.json` | Added `dependencies` block |
