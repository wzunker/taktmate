/**
 * Jest setup file for TaktMate backend tests
 */

// Load environment variables for testing
require('dotenv').config();

// Set test environment variables if not already set
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'test';
}

// Increase timeout for database operations
jest.setTimeout(30000);

// Global test setup
beforeAll(async () => {
  console.log('🧪 Starting TaktMate test suite...');
});

afterAll(async () => {
  console.log('✅ TaktMate test suite completed');
});
