// Jest configuration for TaktMate Backend Unit Tests
// Comprehensive testing setup for Azure AD B2C integration and token validation

module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // Test file patterns
  testMatch: [
    '**/__tests__/**/*.test.js',
    '**/?(*.)+(spec|test).js'
  ],
  
  // Coverage configuration
  collectCoverage: false,
  collectCoverageFrom: [
    'services/**/*.js',
    'middleware/**/*.js',
    'config/**/*.js',
    'utils/**/*.js',
    '!**/node_modules/**',
    '!**/coverage/**',
    '!**/scripts/**',
    '!**/audit_logs/**',
    '!index.js' // Exclude main entry point
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  
  // Setup and teardown
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.js'],
  
  // Module resolution
  moduleDirectories: ['node_modules', '<rootDir>'],
  
  // Test timeout
  testTimeout: 30000,
  
  // Verbose output
  verbose: true,
  
  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true,
  
  // Transform configuration
  transform: {},
  
  // Global test variables
  globals: {
    'process.env.NODE_ENV': 'test'
  }
};
