module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/jest.setup.ts'],
  globalSetup: '<rootDir>/jest.global-setup.js',
  // Screen suites load React Native and a database; a cold cache on Windows needs more than 5 s.
  testTimeout: 15000,
};
