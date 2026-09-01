# Student Management System — Testing, Debugging, Optimization & Deployment

> Week 5 added the test suite and bug fixes described below. Week 6 built
> on top of this with production-readiness changes (security headers,
> restricted CORS, logging, a `/health` endpoint) and added
> `deployment-guide.md`, `maintenance-plan.md`, and `project-reflection.md`
> at the project root — see those files for the deployment and
> maintenance documentation.

This submission builds on the existing Student Management System (Node.js +
Express + MongoDB Atlas backend, vanilla JS frontend) and adds a full test
suite, fixes several real bugs found during testing/debugging, and applies a
handful of concrete performance/reliability optimizations.

See `debugging-report.md` for the detailed log of every bug found and how
it was diagnosed and fixed.

---

## 1. Project structure

```
backend/
  app.js                 Express app (routes + middleware), no listen/DB — testable in isolation
  server.js              Connects to MongoDB, then starts the HTTP listener
  config/db.js           Mongo connection logic
  models/Student.js      Mongoose schema with validation
  controllers/studentController.js   Route handlers, now with error handling
  routes/studentRoutes.js
  middleware/errorHandler.js         Centralized error + 404 handling
  tests/unit/studentController.test.js         Unit tests (model mocked)
  tests/integration/studentRoutes.mocked.test.js  Integration test, no DB needed
  tests/integration/studentRoutes.test.js         Full integration test (real in-memory Mongo)
  jest.config.js
  .env.example
frontend/
  script.js               Frontend logic (API calls + DOM rendering)
  tests/script.test.js     Jest + jsdom tests, fetch mocked
  tests/fixture.html       Minimal DOM used by the tests
README.md                 This file
debugging-report.md       Bugs found, root cause, fix, and lessons learned
```

## 2. Testing strategy

Three layers of automated tests were used, each with a different purpose:

| Layer | Location | What it tests | Dependencies |
|---|---|---|---|
| **Unit tests** | `backend/tests/unit/studentController.test.js` | Each controller function in isolation — status codes, validation, error mapping — with the `Student` Mongoose model fully mocked (`jest.mock`) | None (no DB, no network) |
| **Integration tests (mocked DB)** | `backend/tests/integration/studentRoutes.mocked.test.js` | The real Express app end-to-end (routing → middleware → controller), model mocked | None — always runs, even offline |
| **Integration tests (real DB)** | `backend/tests/integration/studentRoutes.test.js` | The same, but against a real MongoDB instance spun up in-memory by `mongodb-memory-server`, so routes, validation, and Mongoose all work together for real | Downloads a MongoDB binary the first time (needs internet) |
| **Frontend unit tests** | `frontend/tests/script.test.js` | `getStudents`, `deleteStudent`, `updateStudent`, and the add-student form submit handler, using jsdom for the DOM and a mocked `fetch` | None |

**Why mock the database in most tests instead of always using a real one?**
Unit tests should be fast and deterministic and shouldn't depend on network
or infrastructure — that's what makes them useful to run on every save.
Real-DB integration tests are still included (`studentRoutes.test.js`) to
catch things mocks can hide, like a Mongoose validator or a unique-index
constraint not behaving the way the controller assumes. Neither test file
ever touches the real Atlas cluster — they use `mongodb-memory-server`,
which creates a throwaway local MongoDB instance per test run, so
development data is never at risk.

**Current coverage** (statements): backend ≈ 88%, frontend ≈ 92%. Full
reports can be regenerated with `npm run test:coverage` in each folder.

### Running the tests

```bash
# Backend
cd backend
npm install
npm test                 # unit + both integration suites
npm run test:coverage    # same, with a coverage report

# Frontend
cd frontend
npm install
npm test
```

> Note: `studentRoutes.test.js` (the real-DB integration test) downloads a
> MongoDB binary via `mongodb-memory-server` the first time it runs. This
> requires normal outbound internet access (the same access your machine
> already used to reach MongoDB Atlas). If you're on a restricted network,
> `studentRoutes.mocked.test.js` covers the same routes without needing
> that download.

## 3. Debugging technique used

Beyond the automated tests, the following manual debugging techniques were
used while building this system (details and real logs in
`debugging-report.md`):
- Reading Node.js stack traces top-down to find the actual failing line
  rather than the symptom (e.g. tracing "server connection failed" in the
  browser back to a wrong port in `server.js`, not a MongoDB problem).
- `nslookup` to isolate a DNS/network issue from an application bug.
- Adding `console.error` at the connection layer (`config/db.js`) so
  failures are visible instead of silent.
- Deliberately triggering each error path (invalid id, missing fields,
  duplicate email, malformed JSON, unknown route) via the test suite to
  confirm the server responds with a clean, correct status code instead of
  crashing or leaking a raw stack trace.

## 4. Optimizations implemented

1. **Centralized error handling** (`middleware/errorHandler.js`) — every
   controller now forwards unexpected errors to `next(err)` instead of
   letting an unhandled rejection crash the process or return an unstyled
   Express HTML error page.
2. **Input validation** — `create`/`update` now reject missing fields and
   invalid emails with a `400` instead of hitting the database and getting
   an opaque Mongoose error. Mongoose schema-level validation
   (`required`, `match`, `min`/`max`) was also added to `models/Student.js`
   as a second line of defense.
3. **Friendly duplicate-key handling** — a duplicate email now returns
   `409 { message: "Email is already registered" }` instead of the raw
   `E11000 duplicate key error` MongoDB stack trace that used to be shown
   to the user.
4. **`.lean()` on read queries** — `getAll`/`getOne` use `.lean()`, which
   skips Mongoose document hydration and returns plain JS objects. This is
   a straightforward win for read-heavy endpoints since the extra
   Mongoose document wrapper isn't needed just to send JSON back.
5. **Pagination on `GET /api/students`** — added `page`/`limit` query
   params (default 50, capped at 100) plus an optional `course` filter, so
   the endpoint doesn't have to load and serialize the entire collection
   as it grows.
6. **Index on `course`** — added `studentSchema.index({ course: 1 })`
   since filtering/reporting by course is a common access pattern; `email`
   already had a unique index from `unique: true`.
7. **Loud failure on DB connection error** — `config/db.js` used to only
   `console.log` a failed connection and let the server keep running
   anyway, which produced confusing downstream errors. It now logs clearly
   and exits the process, so a bad `.env` is obvious immediately.
8. **Split `app.js` from `server.js`** — the Express app (routes,
   middleware) is now separate from the DB-connect-and-listen step. This
   isn't a runtime performance change, but it's what makes the app
   testable with supertest without opening a real network port or
   depending on a live database for every test.

## 5. Known limitations / possible next steps

- Rate limiting and request logging (e.g. `express-rate-limit`, `morgan`)
  were not added — reasonable next step for a production deployment.
- Frontend tests cover the JS logic but not visual/CSS regressions; a
  tool like Cypress/Playwright would be the next step for true end-to-end
  browser testing.
- Authentication (`login.html`) exists in the project but has no backend
  route yet, so it wasn't in scope for this week's testing task.
