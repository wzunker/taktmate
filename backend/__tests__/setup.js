// Jest setup file for TaktMate Backend Unit Tests
// Global test configuration and utilities

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.ENABLE_AUDIT_LOGGING = 'false';
process.env.ENABLE_REAL_TIME_AUDIT = 'false';
process.env.ENABLE_DATA_RETENTION = 'false';
process.env.ENABLE_AUTOMATIC_CLEANUP = 'false';

// Microsoft Entra External ID test configuration
process.env.ENTRA_EXTERNAL_ID_CLIENT_ID = 'test-client-id';
process.env.ENTRA_EXTERNAL_ID_CLIENT_SECRET = 'test-client-secret';
process.env.ENTRA_EXTERNAL_ID_TENANT_NAME = 'test-tenant';
process.env.ENTRA_EXTERNAL_ID_TENANT_ID = 'test-tenant-id';
process.env.ENTRA_EXTERNAL_ID_SIGNUP_SIGNIN_POLICY = 'B2C_1_signupsignin1';
process.env.ENTRA_EXTERNAL_ID_PASSWORD_RESET_POLICY = 'B2C_1_passwordreset1';
process.env.ENTRA_EXTERNAL_ID_PROFILE_EDIT_POLICY = 'B2C_1_profileedit1';

// JWT test configuration
process.env.JWT_SECRET = 'test-jwt-secret-key-for-unit-tests-only';
process.env.JWT_EXPIRATION = '1h';
process.env.JWT_REFRESH_EXPIRATION = '7d';

// Application Insights test configuration
process.env.APPLICATIONINSIGHTS_CONNECTION_STRING = 'test-connection-string';

// File storage test configuration
process.env.UPLOAD_DIR = './test_uploads';
process.env.MAX_FILE_SIZE = '10485760'; // 10MB

// Test database/storage configuration
process.env.TEST_MODE = 'true';

// Global test utilities
global.testUtils = {
  // Generate test JWT token
  generateTestJWT: (payload = {}) => {
    const jwt = require('jsonwebtoken');
    const defaultPayload = {
      sub: 'test-user-id',
      name: 'Test User',
      email: 'test@example.com',
      oid: 'test-object-id',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600 // 1 hour
    };
    return jwt.sign({ ...defaultPayload, ...payload }, process.env.JWT_SECRET);
  },
  
  // Generate test Microsoft Entra External ID token
  generateTestAzureToken: (payload = {}) => {
    const jwt = require('jsonwebtoken');
    const defaultPayload = {
      iss: `https://test-tenant.ciamlogin.com/test-tenant-id/v2.0/`,
      aud: process.env.AZURE_CLIENT_ID,
      sub: 'test-azure-user-id',
      name: 'Test Azure User',
      emails: ['test@example.com'],
      oid: 'test-azure-object-id',
      tfp: process.env.AZURE_POLICY_SIGN_UP_SIGN_IN,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600
    };
    return jwt.sign({ ...defaultPayload, ...payload }, process.env.JWT_SECRET);
  },
  
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
      if (header === 'Authorization') return overrides.authorization || null;
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
