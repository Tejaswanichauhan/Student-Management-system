const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    course: {
      type: String,
      required: [true, 'Course is required'],
      trim: true,
    },
    age: {
      type: Number,
      required: [true, 'Age is required'],
      min: [1, 'Age must be a positive number'],
      max: [120, 'Age must be realistic'],
    },
  },
  { timestamps: true }
);

// Optimization: index on course speeds up filtering/reporting by course.
// (email already gets a unique index automatically from `unique: true` above.)
studentSchema.index({ course: 1 });

module.exports = mongoose.model('Student', studentSchema);
