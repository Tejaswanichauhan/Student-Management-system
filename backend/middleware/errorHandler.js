// Centralized error handler. Any error passed to next(err) from a controller
// lands here instead of crashing the process or leaking a raw stack trace
// to the client.
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  console.error(err.stack || err.message);

  if (err.name === 'CastError') {
    return res.status(400).json({ message: 'Invalid id format' });
  }

  res.status(err.status || 500).json({
    message: err.message || 'Something went wrong on the server',
  });
}

function notFound(req, res) {
  res.status(404).json({ message: `Route ${req.originalUrl} not found` });
}

module.exports = { errorHandler, notFound };
