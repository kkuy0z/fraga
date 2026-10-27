export default {
  testEnvironment: 'node',
  transform: {},
  moduleFileExtensions: ['js', 'mjs'],
  testMatch: ['**/__tests__/**/*.test.js', '**/?(*.)+(spec|test).js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js',
    '!src/database/init.js',
    '!src/database/migrate.js'
  ],
  coverageDirectory: 'coverage',
  verbose: true,
  testTimeout: 30000,
  globalSetup: './jest.global-setup.js',
  globalTeardown: './jest.global-teardown.js',
  setupFilesAfterEnv: ['./jest.setup.js'],
  // Run tests sequentially to avoid database locking
  maxWorkers: 1
};