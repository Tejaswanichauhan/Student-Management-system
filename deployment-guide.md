# Deployment Guide — Student Management System

This guide deploys the backend (Node.js/Express/MongoDB) to **Render** and
the frontend (static HTML/CSS/JS) to **Netlify** — both have free tiers
suitable for a student project and don't require a credit card. The same
principles apply to Railway, Fly.io, or Heroku if you prefer those instead.

---

## 1. Pre-deployment checklist (production readiness)

Before deploying, the following were done to make the app deployment-ready
(already applied in this submission's `backend/` folder):

- [x] **No hardcoded secrets.** `MONGO_URI` is read from `process.env`, never
      hardcoded. `.env` is git-ignored; only `.env.example` is committed.
- [x] **Configurable port.** `server.js` uses `process.env.PORT || 5000` —
      required because hosting platforms assign their own port at runtime.
- [x] **Restrictive CORS in production.** `app.js` reads `CORS_ORIGIN` from
      the environment so only your deployed frontend's exact URL can call
      the API, instead of allowing every origin (`*`) as in local
      development.
- [x] **Security headers.** `helmet()` middleware adds standard protective
      HTTP headers (clickjacking, MIME-sniffing protection, etc.).
- [x] **Request logging.** `morgan('combined')` logs every request in
      production, in the standard Apache-style access-log format most
      hosting dashboards can parse.
- [x] **Health check endpoint.** `GET /health` returns `200 OK` without
      touching the database, so the platform can tell the process is alive
      even during a database outage.
- [x] **Loud failure on bad config.** `config/db.js` exits the process if
      `MONGO_URI` is missing or invalid, instead of starting a broken
      server silently (this exact bug caused hours of confusion in local
      development — see `project-reflection.md`).
- [x] **`engines` field pinned** in `package.json` (`node >= 18`) so the
      platform provisions a compatible Node version.

---

## 2. Push the project to GitHub

Both Render and Netlify deploy directly from a Git repository.

```bash
cd student-management-system         # the project root, containing backend/ and frontend files
git init
git add .
git commit -m "Initial commit for deployment"
```

Create a new empty repository on GitHub (no README/license, to avoid merge
conflicts), then:

```bash
git remote add origin https://github.com/<your-username>/<your-repo>.git
git branch -M main
git push -u origin main
```

> `.gitignore` already excludes `node_modules/`, `.env`, and `coverage/`,
> so your MongoDB password is never pushed to GitHub.

---

## 3. Deploy the backend on Render

1. Go to [render.com](https://render.com) and sign up (GitHub login is
   fastest).
2. Click **New +** → **Web Service**.
3. Connect your GitHub account and select the repository.
4. Configure the service:
   | Setting | Value |
   |---|---|
   | **Name** | `student-management-backend` (or any name — this becomes part of your URL) |
   | **Root Directory** | `backend` |
   | **Runtime** | Node |
   | **Build Command** | `npm install` |
   | **Start Command** | `node server.js` |
   | **Instance Type** | Free |
5. Under **Environment Variables**, add:
   | Key | Value |
   |---|---|
   | `MONGO_URI` | your real Atlas connection string |
   | `NODE_ENV` | `production` |
   | `CORS_ORIGIN` | leave blank for now — you'll set this after deploying the frontend in Step 4 |
6. Click **Create Web Service**. Render will build and deploy; watch the
   **Logs** tab. A successful deploy ends with `MongoDB Connected` and
   `Server running on port ...` in the logs (Render sets `PORT`
   automatically).
7. Once live, your API is reachable at
   `https://student-management-backend-xxxx.onrender.com`. Test it:
   ```bash
   curl https://student-management-backend-xxxx.onrender.com/health
   ```
   Expect: `{"status":"ok","uptime":...}`

### Allow Render to reach MongoDB Atlas
Render's servers use dynamic IPs, so add `0.0.0.0/0` under **Atlas →
Network Access → Add IP Address → Allow Access from Anywhere**. (For a
real production system you'd use Atlas's private network peering instead,
but for a student project this is the standard approach.)

---

## 4. Deploy the frontend on Netlify

1. In your frontend files (`index.html`, `dashboard.html`, `students.html`,
   `add-student.html`, `login.html`, `Style.css`, `script.js`), update
   `script.js`'s `API_URL` to point at your live Render backend instead of
   `localhost`:
   ```js
   const API_URL = "https://student-management-backend-xxxx.onrender.com/api/students";
   ```
   Commit and push this change.
2. Go to [netlify.com](https://netlify.com) and sign up.
3. Click **Add new site** → **Import an existing project** → connect
   GitHub → select the repository.
4. Build settings:
   | Setting | Value |
   |---|---|
   | **Base directory** | `frontend` (or wherever the HTML files live) |
   | **Build command** | *(leave blank — this is a static site, no build step)* |
   | **Publish directory** | `frontend` (same as base directory) |
5. Click **Deploy site**. Netlify gives you a URL like
   `https://your-project-name.netlify.app`.

### Lock down CORS now that you have both URLs
Go back to the Render dashboard → your backend service → **Environment**
→ set `CORS_ORIGIN` to your exact Netlify URL (e.g.
`https://your-project-name.netlify.app`, no trailing slash) → save. Render
will redeploy automatically with the restriction applied.

---

## 5. Verify with user acceptance testing (UAT)

Manually walk through the core user flows on the **live URLs** (not
localhost), the same flows the automated tests cover:

| # | Test | Expected result |
|---|---|---|
| 1 | Open the Netlify URL | Student list page loads, no console errors |
| 2 | Add a student with valid data | Success alert; student appears in the list |
| 3 | Add a student with a duplicate email | Alert shows "Email is already registered", not a raw crash |
| 4 | Add a student with a missing field | Alert shows a clear validation message |
| 5 | Update a student's course | List refreshes with the new course |
| 6 | Delete a student | Student disappears from the list |
| 7 | Open browser DevTools → Network tab | Requests go to the Render URL over HTTPS, `200`/`201` statuses, no CORS errors |
| 8 | Visit `/health` on the backend URL directly | Returns `{"status":"ok",...}` |

Record the date, browser used, and pass/fail for each row — this becomes
your UAT evidence for the submission.

---

## 6. Troubleshooting common deployment issues

| Symptom | Likely cause | Fix |
|---|---|---|
| Render build fails with `Cannot find module 'express'` | `Root Directory` not set to `backend`, so `npm install` ran in the wrong folder | Set Root Directory to `backend` in service settings |
| Logs show `MongoDB connection error` | Atlas Network Access doesn't allow Render's IP | Add `0.0.0.0/0` under Atlas → Network Access |
| Logs show `querySrv ECONNREFUSED` | Same SRV DNS issue seen locally in Week 4/5 — rare on cloud platforms, but if it happens, switch to the non-SRV connection string, same as the local fix | See `debugging-report.md` from Week 5 |
| Frontend shows "Server connection failed" | `API_URL` in `script.js` still points at `localhost` | Update `API_URL` to the deployed Render URL and redeploy the frontend |
| Browser console shows a CORS error | `CORS_ORIGIN` on Render doesn't exactly match the Netlify URL (protocol, trailing slash, or subdomain mismatch) | Copy the Netlify URL exactly, no trailing slash, into `CORS_ORIGIN` |
| First request after inactivity takes 30–60 seconds | Render's free tier spins down an idle service and "cold-starts" it on the next request | Expected behavior on the free tier; mention this in UAT notes, or use a free uptime monitor (see `maintenance-plan.md`) to ping it periodically |
| `404` on every API route | Frontend calling `/students` instead of `/api/students` (the exact bug found and fixed in Week 5) | Confirm `API_URL` includes `/api/students` |
| Deploy succeeds but `/health` times out | Wrong **Start Command** (e.g., pointing at `app.js` instead of `server.js`) — `app.js` never calls `.listen()` | Start Command must be `node server.js` |
| Environment variable "not defined" errors in logs | Variable typed into Render's dashboard with a typo, or added after the last deploy | Re-check spelling in **Environment** tab; Render redeploys automatically when you save changes there |

---

## 7. Rollback plan

Render keeps a history of every deploy. If a new deploy breaks the app:
**Render dashboard → your service → Events/Deploys tab → find the last
known-good deploy → Redeploy**. This restores that exact build in under a
minute without needing a new commit.
