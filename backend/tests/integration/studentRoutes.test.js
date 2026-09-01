/**
 * INTEGRATION TESTS
 * ------------------
 * These tests spin up an in-memory MongoDB instance (mongodb-memory-server)
 * and hit the real Express app (app.js) through supertest, going through
 * routes -> controllers -> Mongoose model -> database and back. This is
 * deliberately kept separate from the real Atlas cluster used in
 * development, so tests never touch or pollute production data and can run
 * offline/in CI.
 */

const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../../app');
const Student = require('../../models/Student');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterEach(async () => {
  await Student.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('GET /api/students', () => {
  it('returns an empty paginated list initially', async () => {
    const res = await request(app).get('/api/students');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.total).toBe(0);
  });

  it('returns created students', async () => {
    await Student.create({
      name: 'Priya',
      email: 'priya@test.com',
      course: 'BCA',
      age: 21,
    });

    const res = await request(app).get('/api/students');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('Priya');
  });
});

describe('POST /api/students', () => {
  it('creates a new student with valid data', async () => {
    const res = await request(app).post('/api/students').send({
      name: 'Karan',
      email: 'karan@test.com',
      course: 'BSc',
      age: 22,
    });

    expect(res.status).toBe(201);
    expect(res.body.email).toBe('karan@test.com');

    const inDb = await Student.findOne({ email: 'karan@test.com' });
    expect(inDb).not.toBeNull();
  });

  it('rejects a request missing required fields', async () => {
    const res = await request(app).post('/api/students').send({ name: 'Only Name' });

    expect(res.status).toBe(400);
  });

  it('rejects a duplicate email with 409, not a raw 500', async () => {
    await Student.create({
      name: 'Dev',
      email: 'dev@test.com',
      course: 'BCA',
      age: 20,
    });

    const res = await request(app).post('/api/students').send({
      name: 'Dev Two',
      email: 'dev@test.com',
      course: 'BSc',
      age: 21,
    });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already registered/i);
  });

  it('rejects an invalid email format', async () => {
    const res = await request(app).post('/api/students').send({
      name: 'Bad Email',
      email: 'not-an-email',
      course: 'BCA',
      age: 20,
    });

    expect(res.status).toBe(400);
  });
});

describe('GET /api/students/:id', () => {
  it('returns 400 for a malformed id', async () => {
    const res = await request(app).get('/api/students/12345');
    expect(res.status).toBe(400);
  });

  it('returns 404 for a well-formed but non-existent id', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app).get(`/api/students/${fakeId}`);
    expect(res.status).toBe(404);
  });

  it('returns the student for a valid id', async () => {
    const student = await Student.create({
      name: 'Meera',
      email: 'meera@test.com',
      course: 'BCA',
      age: 19,
    });

    const res = await request(app).get(`/api/students/${student._id}`);

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Meera');
  });
});

describe('PUT /api/students/:id', () => {
  it('updates an existing student', async () => {
    const student = await Student.create({
      name: 'Arjun',
      email: 'arjun@test.com',
      course: 'BCA',
      age: 20,
    });

    const res = await request(app)
      .put(`/api/students/${student._id}`)
      .send({ course: 'BSc' });

    expect(res.status).toBe(200);
    expect(res.body.course).toBe('BSc');
  });

  it('returns 404 when updating a non-existent student', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app).put(`/api/students/${fakeId}`).send({ course: 'BSc' });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/students/:id', () => {
  it('deletes an existing student', async () => {
    const student = await Student.create({
      name: 'Sara',
      email: 'sara@test.com',
      course: 'BCA',
      age: 20,
    });

    const res = await request(app).delete(`/api/students/${student._id}`);

    expect(res.status).toBe(200);
    const inDb = await Student.findById(student._id);
    expect(inDb).toBeNull();
  });

  it('returns 404 when deleting a non-existent student', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app).delete(`/api/students/${fakeId}`);
    expect(res.status).toBe(404);
  });
});

describe('Unknown routes', () => {
  it('returns a clean 404 instead of an Express default HTML page', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/not found/i);
  });
});
