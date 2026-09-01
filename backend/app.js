const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const studentRoutes = require('./routes/studentRoutes');
const { errorHandler, notFound } = require('./middleware/errorHandler');

const app = express();

// Deployment platforms (Render, Heroku, etc.) sit behind a reverse proxy;
// this makes req.ip / secure-cookie checks work correctly behind it.
app.set('trust proxy', 1);

// Security headers (sets sensible defaults: X-Content-Type-Options,
// X-Frame-Options, etc.) — a "best practice to secure your application".
app.use(helmet());

// CORS is restricted to a configured origin in production instead of
// allowing every origin ("*"), which is fine for local development but
// not appropriate once the API is public. Falls back to "*" only when
// CORS_ORIGIN isn't set, so local/dev usage is unaffected.
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || '*',
  })
);

app.use(express.json());

// Request logging: 'combined' in production for standard access-log
// format (useful for the hosting platform's log viewer), 'dev' locally
// for concise colored output. See maintenance-plan.md for how these logs
// are used for monitoring after deployment.
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Health check endpoint — used by the hosting platform (and uptime
// monitors like UptimeRobot) to verify the service is alive. Deliberately
// does not touch the database, so it stays fast and reports app-level
// liveness separately from DB connectivity.
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

app.get('/', (req, res) => res.send('Student Management API Running'));
app.use('/api/students', studentRoutes);

// 404 handler for unmatched routes, then centralized error handler.
app.use(notFound);
app.use(errorHandler);

module.exports = app;
