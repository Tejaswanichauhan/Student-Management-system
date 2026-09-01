const mongoose = require('mongoose');
const Student = require('../models/Student');

// GET /api/students?page=1&limit=20&course=BCA
// Optimization: .lean() skips Mongoose document hydration (faster, less memory)
// for read-only responses. Optional pagination avoids sending the whole
// collection over the wire as the dataset grows.
exports.getAll = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const filter = {};
    if (req.query.course) filter.course = req.query.course;

    const [students, total] = await Promise.all([
      Student.find(filter)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Student.countDocuments(filter),
    ]);

    res.json({
      data: students,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (err) {
    next(err);
  }
};

exports.getOne = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid student id' });
    }

    const student = await Student.findById(req.params.id).lean();
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    res.json(student);
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const { name, email, course, age } = req.body;

    if (!name || !email || !course || age === undefined) {
      return res
        .status(400)
        .json({ message: 'name, email, course and age are all required' });
    }

    const student = await Student.create({ name, email, course, age });
    res.status(201).json(student);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'Email is already registered' });
    }
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: err.message });
    }
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid student id' });
    }

    const student = await Student.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    res.json(student);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'Email is already registered' });
    }
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: err.message });
    }
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid student id' });
    }

    const student = await Student.findByIdAndDelete(req.params.id);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    res.json({ message: 'Deleted' });
  } catch (err) {
    next(err);
  }
};
