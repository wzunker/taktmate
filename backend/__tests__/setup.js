// Jest setup file for TaktMate Backend Unit Tests
// Global test configuration and utilities

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.ENABLE_AUDIT_LOGGING = 'false';
process.env.ENABLE_REAL_TIME_AUDIT = 'false';
process.env.ENABLE_DATA_RETENTION = 'false';
process.env.ENABLE_AUTOMATIC_CLEANUP = 'false';

// Application Insights test configuration
process.env.APPLICATIONINSIGHTS_CONNECTION_STRING = 'test-connection-string';

// File storage test configuration
process.env.UPLOAD_DIR = './test_uploads';
process.env.MAX_FILE_SIZE = '10485760'; // 10MB

// Test database/storage configuration
process.env.TEST_MODE = 'true';

// OpenAI test configuration
process.env.OPENAI_API_KEY = 'test-openai-key';

// Global test utilities
global.testUtils = {
  // Create mock request object
  createMockRequest: (overrides = {}) => ({
    headers: {},
    body: {},
    query: {},
    params: {},
    user: null,
    session: {},
    ip: '127.0.0.1',
    get: jest.fn((header) => {
      if (header === 'User-Agent') return 'Jest Test Agent';
      return null;
    }),
    ...overrides
  }),
  
  // Create mock response object
  createMockResponse: () => {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      cookie: jest.fn().mockReturnThis(),
      clearCookie: jest.fn().mockReturnThis(),
      redirect: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis()
    };
    return res;
  },
  
  // Create mock next function
  createMockNext: () => jest.fn(),
  
  // Wait for async operations
  waitFor: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Clean up test data
  cleanup: async () => {
    // Clean up any test files or data
    const fs = require('fs');
    const path = require('path');
    
    try {
      const testUploadDir = path.join(__dirname, '..', 'test_uploads');
      if (fs.existsSync(testUploadDir)) {
        fs.rmSync(testUploadDir, { recursive: true, force: true });
      }
    } catch (error) {
      console.warn('Failed to cleanup test files:', error.message);
    }
  }
};

// Global test hooks
beforeAll(async () => {
  // Global setup
  console.log('🧪 Starting TaktMate Backend Unit Tests');
});

afterAll(async () => {
  // Global cleanup
  await global.testUtils.cleanup();
  console.log('✅ TaktMate Backend Unit Tests completed');
});

beforeEach(() => {
  // Reset mocks before each test
  jest.clearAllMocks();
});

afterEach(async () => {
  // Cleanup after each test
  jest.restoreAllMocks();
});