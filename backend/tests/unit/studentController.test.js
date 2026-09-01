/**
 * UNIT TESTS
 * -----------
 * These tests exercise each controller function in isolation. The Student
 * model is fully mocked (jest.mock), so no real MongoDB connection is
 * needed and no real data is touched. This lets us verify the controller's
 * own logic (status codes, validation, error mapping) fast and reliably,
 * independent of the database or network.
 */

jest.mock('../../models/Student');

const mongoose = require('mongoose');
const Student = require('../../models/Student');
const controller = require('../../controllers/studentController');

// Helper to build a fake Express res object we can assert against.
function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

const next = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getAll', () => {
  it('returns paginated data with default page/limit', async () => {
    const fakeStudents = [{ name: 'Asha', email: 'asha@test.com' }];
    Student.find.mockReturnValue({
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(fakeStudents),
    });
    Student.countDocuments.mockResolvedValue(1);

    const req = { query: {} };
    const res = mockRes();

    await controller.getAll(req, res, next);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: fakeStudents,
        page: 1,
        limit: 50,
        total: 1,
        totalPages: 1,
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('forwards unexpected errors to next()', async () => {
    Student.find.mockImplementation(() => {
      throw new Error('DB down');
    });

    const req = { query: {} };
    const res = mockRes();

    await controller.getAll(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

describe('getOne', () => {
  it('returns 400 for a malformed id', async () => {
    const req = { params: { id: 'not-a-real-id' } };
    const res = mockRes();

    await controller.getOne(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Invalid student id' });
  });

  it('returns 404 when no student is found', async () => {
    const validId = new mongoose.Types.ObjectId().toString();
    Student.findById.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });

    const req = { params: { id: validId } };
    const res = mockRes();

    await controller.getOne(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns the student when found', async () => {
    const validId = new mongoose.Types.ObjectId().toString();
    const fakeStudent = { _id: validId, name: 'Ravi' };
    Student.findById.mockReturnValue({ lean: jest.fn().mockResolvedValue(fakeStudent) });

    const req = { params: { id: validId } };
    const res = mockRes();

    await controller.getOne(req, res, next);

    expect(res.json).toHaveBeenCalledWith(fakeStudent);
  });
});

describe('create', () => {
  it('returns 400 when required fields are missing', async () => {
    const req = { body: { name: 'Only Name' } };
    const res = mockRes();

    await controller.create(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Student.create).not.toHaveBeenCalled();
  });

  it('creates a student and returns 201 on valid input', async () => {
    const payload = { name: 'Neha', email: 'neha@test.com', course: 'BCA', age: 20 };
    Student.create.mockResolvedValue({ _id: 'abc123', ...payload });

    const req = { body: payload };
    const res = mockRes();

    await controller.create(req, res, next);

    expect(Student.create).toHaveBeenCalledWith(payload);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('returns 409 on duplicate email (E11000)', async () => {
    const dupError = new Error('duplicate key');
    dupError.code = 11000;
    Student.create.mockRejectedValue(dupError);

    const req = {
      body: { name: 'Neha', email: 'dup@test.com', course: 'BCA', age: 20 },
    };
    const res = mockRes();

    await controller.create(req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ message: 'Email is already registered' });
  });

  it('returns 400 on mongoose ValidationError', async () => {
    const valError = new Error('age must be positive');
    valError.name = 'ValidationError';
    Student.create.mockRejectedValue(valError);

    const req = {
      body: { name: 'Neha', email: 'neha@test.com', course: 'BCA', age: -5 },
    };
    const res = mockRes();

    await controller.create(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('update', () => {
  it('returns 400 for a malformed id', async () => {
    const req = { params: { id: 'bad-id' }, body: { course: 'BSc' } };
    const res = mockRes();

    await controller.update(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 404 when the student does not exist', async () => {
    const validId = new mongoose.Types.ObjectId().toString();
    Student.findByIdAndUpdate.mockResolvedValue(null);

    const req = { params: { id: validId }, body: { course: 'BSc' } };
    const res = mockRes();

    await controller.update(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('updates and returns the student on success', async () => {
    const validId = new mongoose.Types.ObjectId().toString();
    const updated = { _id: validId, course: 'BSc' };
    Student.findByIdAndUpdate.mockResolvedValue(updated);

    const req = { params: { id: validId }, body: { course: 'BSc' } };
    const res = mockRes();

    await controller.update(req, res, next);

    expect(res.json).toHaveBeenCalledWith(updated);
  });
});

describe('remove', () => {
  it('returns 400 for a malformed id', async () => {
    const req = { params: { id: 'bad-id' } };
    const res = mockRes();

    await controller.remove(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 404 when nothing was deleted', async () => {
    const validId = new mongoose.Types.ObjectId().toString();
    Student.findByIdAndDelete.mockResolvedValue(null);

    const req = { params: { id: validId } };
    const res = mockRes();

    await controller.remove(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('deletes and confirms on success', async () => {
    const validId = new mongoose.Types.ObjectId().toString();
    Student.findByIdAndDelete.mockResolvedValue({ _id: validId });

    const req = { params: { id: validId } };
    const res = mockRes();

    await controller.remove(req, res, next);

    expect(res.json).toHaveBeenCalledWith({ message: 'Deleted' });
  });
});
