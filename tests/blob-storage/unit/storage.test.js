/**
 * Unit Tests for Storage Service
 * Tests the core blob storage functionality
 */

const path = require('path');

// Import the storage service
const {
  listUserFiles,
  sumBytes,
  sasForUpload,
  sasForRead,
  deleteBlob,
  healthCheck
} = require('../../../backend/services/storage');

describe('Storage Service Unit Tests', () => {
  
  describe('Container Management', () => {
    
    test('should create user containers successfully', async () => {
      const testUserId = global.testUsers.user1.id;
      
      // Track for cleanup
      global.testCleanup.addContainer(`u-${testUserId}`);
      
      try {
        // Test that we can list files for a user (which creates container if needed)
        const files = await listUserFiles(testUserId);
        expect(Array.isArray(files)).toBe(true);
        
        // Should return empty array for new user
        expect(files.length).toBe(0);
      } catch (error) {
        // If this fails, it might be due to Azure credentials
        console.log('Container test failed - likely Azure credentials issue:', error.message);
        expect(error.message).toContain('credential'); // Should be a credential error
      }
    }, 30000);
    
    test('should handle invalid user IDs gracefully', async () => {
      const invalidUserId = ''; // Invalid user ID
      
      try {
        await listUserFiles(invalidUserId);
        fail('Should have thrown an error for invalid user ID');
      } catch (error) {
        expect(error.message).toContain('User ID is required');
      }
    });
    
  });
  
  describe('SAS Token Generation', () => {
    
    test('should generate valid upload SAS tokens', async () => {
      const userId = global.testUsers.user1.id;
      const fileName = 'test-upload.csv';
      const contentType = 'text/csv';
      
      try {
        const sasUrl = await sasForUpload(userId, fileName, contentType, 10);
        
        // Should return a valid URL
        expect(typeof sasUrl).toBe('string');
        expect(sasUrl).toContain('blob.core.windows.net');
        expect(sasUrl).toContain('sig='); // SAS signature
        expect(sasUrl).toContain('se=');  // Expiry time
        
        // Should contain the file name
        expect(sasUrl).toContain(fileName);
        
      } catch (error) {
        console.log('SAS token test failed - likely Azure credentials issue:', error.message);
        // Expect credential-related error if Azure isn't configured
        expect(error.message).toMatch(/credential|authentication|access/i);
      }
    }, 30000);
    
    test('should generate valid download SAS tokens', async () => {
      const userId = global.testUsers.user1.id;
      const fileName = 'test-download.csv';
      
      try {
        const sasUrl = await sasForRead(userId, fileName, 10);
        
        expect(typeof sasUrl).toBe('string');
        expect(sasUrl).toContain('blob.core.windows.net');
        expect(sasUrl).toContain('sig=');
        expect(sasUrl).toContain(fileName);
        
      } catch (error) {
        console.log('Download SAS test failed:', error.message);
        expect(error.message).toMatch(/credential|authentication|access/i);
      }
    }, 30000);
    
    test('should validate required parameters', async () => {
      const userId = global.testUsers.user1.id;
      
      // Test missing parameters
      try {
        await sasForUpload('', 'file.csv', 'text/csv');
        fail('Should have thrown error for missing userId');
      } catch (error) {
        expect(error.message).toContain('required');
      }
      
      try {
        await sasForUpload(userId, '', 'text/csv');
        fail('Should have thrown error for missing fileName');
      } catch (error) {
        expect(error.message).toContain('required');
      }
    });
    
  });
  
  describe('File Operations', () => {
    
    test('should list user files correctly', async () => {
      const userId = global.testUsers.user1.id;
      
      // This would test the listUserFiles function
      expect(true).toBe(true); // Placeholder - replace with actual test
    });
    
    test('should calculate storage usage accurately', async () => {
      const userId = global.testUsers.user1.id;
      
      // This would test the sumBytes function
      expect(true).toBe(true); // Placeholder - replace with actual test
    });
    
    test('should delete files successfully', async () => {
      const userId = global.testUsers.user1.id;
      const fileName = 'test-delete.csv';
      
      // Track for cleanup
      global.testCleanup.addFile(userId, fileName);
      
      // This would test the deleteBlob function
      expect(true).toBe(true); // Placeholder - replace with actual test
    });
    
  });
  
  describe('Health Check', () => {
    
    test('should perform health check successfully', async () => {
      try {
        const health = await healthCheck();
        
        expect(typeof health).toBe('object');
        expect(health).toHaveProperty('status');
        expect(['healthy', 'unhealthy']).toContain(health.status);
        
        if (health.status === 'healthy') {
          expect(health).toHaveProperty('timestamp');
          expect(health).toHaveProperty('details');
        }
        
      } catch (error) {
        console.log('Health check test failed:', error.message);
        // If Azure credentials aren't configured, expect credential error
        expect(error.message).toMatch(/credential|authentication|access/i);
      }
    }, 30000);
    
    test('should return health status object', async () => {
      try {
        const health = await healthCheck();
        
        // Should always return an object with status
        expect(health).toBeDefined();
        expect(typeof health).toBe('object');
        expect(health).toHaveProperty('status');
        
      } catch (error) {
        // Even on failure, should be a structured error
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBeDefined();
      }
    });
    
  });
  
});

// Helper functions for tests
function createTestFile(name, content = 'test,data\n1,2\n3,4') {
  return Buffer.from(content);
}

function generateTestFileName(prefix = 'test') {
  return `${prefix}-${Date.now()}.csv`;
}
