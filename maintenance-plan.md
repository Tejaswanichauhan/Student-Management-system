# Maintenance Plan — Student Management System

This document describes how the application is monitored, logged, and kept
up to date after deployment.

## 1. Logging

- **Request logging:** `morgan('combined')` is enabled in production
  (`app.js`), logging every request (method, path, status code, response
  time, IP) in a standard access-log format. On Render, these logs are
  viewable live under the service's **Logs** tab, and are retained for a
  rolling window on the free tier.
- **Application/error logging:** the centralized error handler
  (`middleware/errorHandler.js`) calls `console.error(err.stack)` for every
  unhandled error, so the full stack trace lands in the same platform log
  stream — no separate log file to manage on a free-tier deployment.
- **Database connection events:** `config/db.js` logs a clear
  `MongoDB Connected` on success or `MongoDB connection error: <message>`
  on failure (and exits the process on failure, so a broken DB config is
  never silently running).

**Review cadence:** logs should be spot-checked weekly, and immediately
after any deploy, for unexpected `5xx` status codes or repeated error
stack traces.

## 2. Error reporting / uptime monitoring

For a project at this scale, a lightweight, free approach is used instead
of a paid APM tool:

- **[UptimeRobot](https://uptimerobot.com)** (free tier) is configured to
  ping `GET /health` every 5 minutes. If the endpoint doesn't return `200`
  for two consecutive checks, it sends an email alert. This also
  incidentally keeps Render's free-tier instance from fully cold-starting
  between real users' requests.
- **Render's built-in health checks** (configured via `healthCheckPath:
  /health` in `render.yaml`, or manually in the dashboard) automatically
  restart the service if it stops responding.
- **Manual log review** (see above) is the fallback for catching errors
  that don't cause downtime — e.g. a spike in `400`/`409` responses might
  indicate a frontend bug sending malformed requests, even though the
  server itself stays up.

**Next step for a larger/real production deployment:** integrate a
dedicated error-tracking service (e.g. Sentry's free tier) to get
stack-trace-level alerts with request context, rather than relying on
manually reading platform logs.

## 3. Update procedure

1. **Dependency updates:** run `npm outdated` monthly in `backend/` and
   `frontend/` to check for new versions. Run `npm audit` at the same time
   to catch known vulnerabilities. Apply patch/minor updates with
   `npm update`; review major version bumps individually since they can
   include breaking changes.
2. **Code changes:** all changes go through the existing test suite first
   — `npm test` in `backend/` and `frontend/` — before being pushed. Since
   Render redeploys automatically on every push to `main`, an untested
   change reaches production almost immediately, so the test suite is the
   main safety net.
3. **Database changes:** any change to `models/Student.js` (e.g. adding a
   new required field) needs a plan for existing documents in Atlas that
   don't have that field — either a default value in the schema or a
   one-off migration script — before deploying, so existing records don't
   suddenly fail validation on the next `update`.
4. **Rollback:** see the Rollback Plan in `deployment-guide.md` — Render
   can redeploy the last known-good build in under a minute.
5. **Backups:** MongoDB Atlas's free (M0) tier does not include automated
   backups. Since this is a student project, a manual export
   (`Atlas → Collections → Export Collection`) is taken before any risky
   schema change. For a real production system, upgrading to a paid Atlas
   tier with continuous backups would be the next step.

## 4. Versioning

- `package.json` `version` field is bumped (semantic versioning:
  major.minor.patch) with each meaningful change — e.g. `1.0.0` → `1.1.0`
  for this week's production-readiness additions (helmet, morgan, health
  check).
- Git commit messages describe *what* changed and *why*, so
  `debugging-report.md`-style history can be reconstructed from `git log`
  if needed later.

## 5. Ownership and escalation

For this project, all roles (developer, tester, deployer, on-call) are
held by the same person (the student). In a team setting, this section
would list: who gets the UptimeRobot alert email, who has access to the
Render and Atlas dashboards, and the expected response time for a
downtime alert.
