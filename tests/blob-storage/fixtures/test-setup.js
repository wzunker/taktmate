/**
 * Test Setup and Configuration
 * Runs before all tests to set up the testing environment
 */

require('dotenv').config({ path: '../../../.env' });

// Test configuration
global.testConfig = {
  storageAccountName: process.env.STORAGE_ACCOUNT_NAME || 'taktmatetestblob',
  testTimeout: 30000,
  maxFileSize: 100 * 1024 * 1024, // 100MB
  maxStoragePerUser: 5 * 1024 * 1024 * 1024, // 5GB
  sasTokenTTL: 10 * 60 * 1000, // 10 minutes
};

// Test user data
global.testUsers = {
  user1: {
    id: 'test-user-1',
    name: 'Test User 1',
    email: 'test1@example.com'
  },
  user2: {
    id: 'test-user-2', 
    name: 'Test User 2',
    email: 'test2@example.com'
  },
  adminUser: {
    id: 'admin-user',
    name: 'Admin User',
    email: 'admin@example.com'
  }
};

// Mock authentication headers
global.mockAuthHeaders = {
  user1: {
    'x-ms-client-principal': Buffer.from(JSON.stringify({
      userId: global.testUsers.user1.id,
      userDetails: global.testUsers.user1.name,
      identityProvider: 'aad',
      userRoles: ['authenticated']
    })).toString('base64')
  },
  user2: {
    'x-ms-client-principal': Buffer.from(JSON.stringify({
      userId: global.testUsers.user2.id,
      userDetails: global.testUsers.user2.name,
      identityProvider: 'aad', 
      userRoles: ['authenticated']
    })).toString('base64')
  }
};

// Test cleanup helpers
global.testCleanup = {
  containersToCleanup: [],
  filesToCleanup: [],
  
  addContainer(containerName) {
    this.containersToCleanup.push(containerName);
  },
  
  addFile(userId, fileName) {
    this.filesToCleanup.push({ userId, fileName });
  },
  
  async cleanup() {
    // This would implement actual cleanup logic
    console.log('Cleaning up test data...');
    this.containersToCleanup = [];
    this.filesToCleanup = [];
  }
};

// Global test hooks
beforeEach(() => {
  // Reset cleanup tracking for each test
  global.testCleanup.containersToCleanup = [];
  global.testCleanup.filesToCleanup = [];
});

afterEach(async () => {
  // Cleanup after each test
  await global.testCleanup.cleanup();
});

// Console logging for test debugging
console.log('Test environment initialized');
console.log('Storage Account:', global.testConfig.storageAccountName);
console.log('Test timeout:', global.testConfig.testTimeout + 'ms');
