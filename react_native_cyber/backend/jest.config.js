export default {
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.js'],
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.spec.js'
  ],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/config/db.js',
    '!**/node_modules/**',
    '!**/tests/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: { branches: 70, functions: 70, lines: 70, statements: 70 }
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testTimeout: 10000,
  verbose: true,
  clearMocks: true,
  restoreMocks: true,
  resetMocks: true
};

