const mongoose = require('mongoose');

// Bug fixed: previously a failed connection was only console.logged, so the
// server kept running (and "Server running on port ..." printed) even
// though every request would then hang or fail against a dead DB. Now the
// failure is loud and the process exits, so a broken DB config is obvious
// immediately instead of surfacing later as a confusing runtime error.
module.exports = async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected');
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  }
};
