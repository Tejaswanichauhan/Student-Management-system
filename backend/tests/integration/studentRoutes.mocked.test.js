/**
 * LIGHTWEIGHT INTEGRATION TEST (no live database required)
 * ----------------------------------------------------------
 * studentRoutes.test.js (the sibling file) is the full integration test:
 * real Express app + real MongoDB via mongodb-memory-server. That test
 * needs to download a MongoDB binary the first time it runs, which requires
 * outbound internet access.
 *
 * This file complements it by verifying that routing, JSON body parsing,
 * the 404 handler, and the centralized error handler are all wired
 * together correctly in app.js -- with the Student model mocked out, so it
 * has zero external dependencies and always runs, even offline/in a
 * locked-down CI sandbox.
 */

jest.mock('../../models/Student');

const request = require('supertest');
const app = require('../../app');
const Student = require('../../models/Student');

beforeEach(() => {
  jest.clearAllMocks();
});

it('GET / responds with a health message', async () => {
  const res = await request(app).get('/');
  expect(res.status).toBe(200);
  expect(res.text).toMatch(/Student Management API Running/);
});

it('GET /api/students returns JSON shaped as { data, page, total }', async () => {
  Student.find.mockReturnValue({
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue([{ name: 'Test' }]),
  });
  Student.countDocuments.mockResolvedValue(1);

  const res = await request(app).get('/api/students');

  expect(res.status).toBe(200);
  expect(res.body).toHaveProperty('data');
  expect(res.body).toHaveProperty('total', 1);
});

it('POST /api/students with a bad JSON body is rejected cleanly, not with a crash', async () => {
  const res = await request(app)
    .post('/api/students')
    .set('Content-Type', 'application/json')
    .send('{ this is not valid json');

  // express.json() should hand this to the error handler, which must
  // respond with a JSON error instead of letting the process crash.
  expect(res.status).toBeGreaterThanOrEqual(400);
  expect(res.status).toBeLessThan(500);
});

it('an unmatched route returns the JSON 404 handler, not the Express default HTML page', async () => {
  const res = await request(app).get('/totally/not/a/real/route');
  expect(res.status).toBe(404);
  expect(res.body.message).toMatch(/not found/i);
});

it('a thrown error from the model reaches the centralized error handler as JSON', async () => {
  Student.find.mockImplementation(() => {
    throw new Error('simulated DB outage');
  });

  const res = await request(app).get('/api/students');

  expect(res.status).toBe(500);
  expect(res.body).toHaveProperty('message');
});
