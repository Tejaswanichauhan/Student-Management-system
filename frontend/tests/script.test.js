/**
 * FRONTEND UNIT TESTS (jsdom)
 * ----------------------------
 * script.js talks to the DOM and to fetch(). We give it a real (jsdom)
 * DOM built from tests/fixture.html, and mock global.fetch so no real
 * network call happens and tests run instantly and deterministically.
 *
 * Because script.js runs some setup code (attaching the submit listener,
 * calling getStudents()) as soon as it's loaded, we reset modules and
 * re-require it fresh in each test, after the DOM and fetch mock are
 * already in place.
 */

const fs = require('fs');
const path = require('path');

const fixtureHtml = fs.readFileSync(path.join(__dirname, 'fixture.html'), 'utf8');

function loadScriptFresh() {
  jest.resetModules();
  document.body.innerHTML = fixtureHtml;
  // eslint-disable-next-line global-require
  return require('../script');
}

beforeEach(() => {
  global.fetch = jest.fn();
  global.alert = jest.fn();
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('getStudents', () => {
  it('renders one .student card per item returned in the paginated response', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          { _id: '1', name: 'Asha', email: 'asha@test.com', age: 20, course: 'BCA' },
          { _id: '2', name: 'Ravi', email: 'ravi@test.com', age: 21, course: 'BSc' },
        ],
      }),
    });

    const { getStudents } = loadScriptFresh();
    // flush the automatic getStudents() call that fires on load
    await Promise.resolve();
    await Promise.resolve();

    await getStudents();

    expect(document.querySelectorAll('.student')).toHaveLength(2);
    expect(document.getElementById('studentList').textContent).toContain('Asha');
  });

  it('still works if the backend returns a bare array (backward compatibility)', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ([{ _id: '1', name: 'Legacy', email: 'l@test.com', age: 20, course: 'BCA' }]),
    });

    const { getStudents } = loadScriptFresh();
    await Promise.resolve();
    await Promise.resolve();

    await getStudents();

    expect(document.querySelectorAll('.student')).toHaveLength(1);
  });

  it('calls the API_URL with the correct /api/students path', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ data: [] }) });

    const { API_URL } = loadScriptFresh();
    await Promise.resolve();

    expect(API_URL).toBe('http://localhost:5000/api/students');
    expect(global.fetch).toHaveBeenCalledWith(API_URL);
  });

  it('does not throw when fetch rejects (server down)', async () => {
    global.fetch.mockRejectedValue(new Error('network error'));

    const { getStudents } = loadScriptFresh();
    await Promise.resolve();
    await Promise.resolve();

    await expect(getStudents()).resolves.toEqual([]);
  });
});

describe('add student form submit', () => {
  it('shows a success alert and resets the form on a successful POST', async () => {
    global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) }); // initial load
    loadScriptFresh();
    await Promise.resolve();
    await Promise.resolve();

    document.getElementById('name').value = 'Neha';
    document.getElementById('email').value = 'neha@test.com';
    document.getElementById('age').value = '20';
    document.getElementById('course').value = 'BCA';

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ _id: 'abc', name: 'Neha' }),
    });
    global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) }); // getStudents() refresh

    const form = document.getElementById('studentForm');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(global.alert).toHaveBeenCalledWith('Student added successfully!');
  });

  it('shows the server error message on a duplicate-email (409) response instead of crashing', async () => {
    global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) }); // initial load
    loadScriptFresh();
    await Promise.resolve();
    await Promise.resolve();

    document.getElementById('name').value = 'Neha';
    document.getElementById('email').value = 'dup@test.com';
    document.getElementById('age').value = '20';
    document.getElementById('course').value = 'BCA';

    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: 'Email is already registered' }),
    });

    const form = document.getElementById('studentForm');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(global.alert).toHaveBeenCalledWith('Email is already registered');
  });

  it('alerts "Server connection failed" when fetch itself throws', async () => {
    global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) }); // initial load
    loadScriptFresh();
    await Promise.resolve();
    await Promise.resolve();

    document.getElementById('name').value = 'Neha';
    document.getElementById('email').value = 'neha@test.com';
    document.getElementById('age').value = '20';
    document.getElementById('course').value = 'BCA';

    global.fetch.mockRejectedValueOnce(new Error('backend is down'));

    const form = document.getElementById('studentForm');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(global.alert).toHaveBeenCalledWith('Server connection failed');
  });
});

describe('deleteStudent', () => {
  it('sends a DELETE request to the correct URL', async () => {
    global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) }); // initial load
    const { deleteStudent } = loadScriptFresh();
    await Promise.resolve();
    await Promise.resolve();

    global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ message: 'Deleted' }) });
    global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) }); // refresh

    await deleteStudent('abc123');

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:5000/api/students/abc123',
      { method: 'DELETE' }
    );
  });
});

describe('updateStudent', () => {
  it('sends a PUT request with the new course', async () => {
    global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) }); // initial load
    const { updateStudent } = loadScriptFresh();
    await Promise.resolve();
    await Promise.resolve();

    global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ course: 'BSc' }) });
    global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) }); // refresh

    await updateStudent('abc123', 'BSc');

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:5000/api/students/abc123',
      expect.objectContaining({ method: 'PUT', body: JSON.stringify({ course: 'BSc' }) })
    );
  });

  it('does nothing if no new course is provided', async () => {
    global.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) }); // initial load
    const { updateStudent } = loadScriptFresh();
    await Promise.resolve();
    await Promise.resolve();

    global.fetch.mockClear();
    await updateStudent('abc123', '');

    expect(global.fetch).not.toHaveBeenCalled();
  });
});
