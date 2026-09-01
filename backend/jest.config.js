module.exports = {
  testEnvironment: 'node',
  testPathIgnorePatterns: ['/node_modules/'],
  // The full DB integration test (studentRoutes.test.js) downloads a
  // MongoDB binary the first time it runs, so it needs longer than Jest's
  // 5s default hook timeout on a slow connection.
  testTimeout: 15000,
  verbose: true,
};
