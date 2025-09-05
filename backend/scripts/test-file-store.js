#!/usr/bin/env node

/**
 * File Store Testing Utility for TaktMate
 * 
 * This script tests the enhanced file storage functionality including user association,
 * access control, file management, metadata handling, and performance characteristics.
 */

const fileStore = require('../fileStore');
const { config } = require('../config/azureAdB2C');

/**
 * Colors for console output
 */
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

/**
 * Log with colors and timestamps
 */
function log(message, color = colors.reset) {
  const timestamp = new Date().toISOString();
  console.log(`${colors.blue}[${timestamp}]${colors.reset} ${color}${message}${colors.reset}`);
}

/**
 * Test results tracking
 */
let testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  errors: [],
  performance: {}
};

/**
 * Add test result
 */
function addTestResult(testName, passed, error = null, duration = null) {
  testResults.total++;
  if (passed) {
    testResults.passed++;
    log(`✅ ${testName}${duration ? ` (${duration}ms)` : ''}`, colors.green);
  } else {
    testResults.failed++;
    testResults.errors.push({ test: testName, error: error?.message || error });
    log(`❌ ${testName}: ${error?.message || error}`, colors.red);
  }
  
  if (duration) {
    testResults.performance[testName] = duration;
  }
}

/**
 * Create sample CSV data for testing
 */
function createSampleCSVData() {
  return {
    small: [
      { name: 'John', age: 30, city: 'New York' },
      { name: 'Jane', age: 25, city: 'Los Angeles' },
      { name: 'Bob', age: 35, city: 'Chicago' }
    ],
    
    medium: Array.from({ length: 100 }, (_, i) => ({
      id: i + 1,
      name: `User${i + 1}`,
      email: `user${i + 1}@example.com`,
      score: Math.floor(Math.random() * 100),
      department: ['Sales', 'Marketing', 'Engineering', 'HR'][i % 4]
    })),
    
    large: Array.from({ length: 1000 }, (_, i) => ({
      id: i + 1,
      timestamp: new Date(Date.now() - i * 60000).toISOString(),
      value: Math.random() * 1000,
      category: `Category${i % 10}`,
      description: `Sample data point ${i + 1} with some description text`
    }))
  };
}

/**
 * Create sample user profiles for testing
 */
function createSampleUserProfiles() {
  return {
    admin: {
      id: 'admin-user-123',
      email: 'admin@example.com',
      displayName: 'Admin User',
      company: 'Test Corp',
      role: 'Administrator',
      permissions: ['admin:all', 'upload:csv', 'manage:users']
    },
    
    user1: {
      id: 'user-456',
      email: 'user1@example.com',
      displayName: 'John Doe',
      company: 'Example Inc',
      role: 'Analyst',
      permissions: ['upload:csv', 'read:profile']
    },
    
    user2: {
      id: 'user-789',
      email: 'user2@example.com',
      displayName: 'Jane Smith',
      company: 'Test Corp',
      role: 'Manager',
      permissions: ['upload:csv', 'manage:team']
    },
    
    limitedUser: {
      id: 'limited-user-999',
      email: 'limited@example.com',
      displayName: 'Limited User',
      company: 'External Corp',
      role: 'Guest',
      permissions: ['read:profile'] // No upload permission
    }
  };
}

/**
 * Test file store initialization
 */
function testFileStoreInitialization() {
  log('\n🏗️  Testing File Store Initialization', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  try {
    // Test that file store is initialized
    addTestResult('File Store Instance', fileStore !== null && typeof fileStore === 'object');
    
    // Test initial statistics
    const stats = fileStore.getStats();
    addTestResult('Initial Statistics', stats && stats.totalFiles === 0 && stats.totalUsers === 0);
    
    // Test configuration
    const hasConfig = fileStore.maxFilesPerUser > 0 && fileStore.maxTotalFiles > 0;
    addTestResult('Configuration Loaded', hasConfig);
    
    if (config.debugAuth) {
      log(`  📊 Max files per user: ${fileStore.maxFilesPerUser}`, colors.blue);
      log(`  📊 Max total files: ${fileStore.maxTotalFiles}`, colors.blue);
      log(`  📊 Max file age: ${fileStore.maxFileAge}ms`, colors.blue);
    }
    
  } catch (error) {
    addTestResult('File Store Initialization', false, error);
  }
}

/**
 * Test file storage with user association
 */
function testFileStorage() {
  log('\n📁 Testing File Storage with User Association', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  const csvData = createSampleCSVData();
  const userProfiles = createSampleUserProfiles();

  // Test basic file storage
  try {
    const startTime = Date.now();
    const result = fileStore.store(
      'test-file-1',
      'test-data.csv',
      csvData.small,
      userProfiles.user1.id,
      userProfiles.user1,
      {
        description: 'Test CSV file',
        tags: ['test', 'sample'],
        userAgent: 'TaktMate-Test/1.0',
        ip: '127.0.0.1'
      }
    );
    const duration = Date.now() - startTime;
    
    const testPassed = result.success === true &&
                      result.fileId === 'test-file-1' &&
                      result.filename === 'test-data.csv' &&
                      result.rowCount === csvData.small.length;
    
    addTestResult('Basic File Storage', testPassed, null, duration);
    
    if (testPassed && config.debugAuth) {
      log(`  📁 File: ${result.filename} (${result.size} bytes)`, colors.blue);
      log(`  📁 Rows: ${result.rowCount}`, colors.blue);
    }
    
  } catch (error) {
    addTestResult('Basic File Storage', false, error);
  }

  // Test file storage with different user
  try {
    const result = fileStore.store(
      'test-file-2',
      'user2-data.csv',
      csvData.medium,
      userProfiles.user2.id,
      userProfiles.user2,
      {
        isPublic: true,
        allowSharing: true,
        retentionDays: 14
      }
    );
    
    const testPassed = result.success === true && result.fileId === 'test-file-2';
    
    addTestResult('Multi-User File Storage', testPassed);
    
  } catch (error) {
    addTestResult('Multi-User File Storage', false, error);
  }

  // Test storage limits
  try {
    const result = fileStore.store(
      'test-file-3',
      'limited-user-data.csv',
      csvData.small,
      userProfiles.limitedUser.id,
      userProfiles.limitedUser
    );
    
    // Should fail due to lack of upload permission
    const testPassed = result.success === false && result.error.includes('lacks upload permissions');
    
    addTestResult('Permission-Based Storage Limit', testPassed);
    
  } catch (error) {
    addTestResult('Permission-Based Storage Limit', false, error);
  }

  // Test missing parameters
  try {
    const result = fileStore.store('test-file-4', 'test.csv', csvData.small, null);
    const testPassed = result.success === false;
    
    addTestResult('Missing Parameters Handling', testPassed);
    
  } catch (error) {
    addTestResult('Missing Parameters Handling', false, error);
  }
}

/**
 * Test file retrieval and access control
 */
function testFileRetrieval() {
  log('\n📖 Testing File Retrieval and Access Control', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  const userProfiles = createSampleUserProfiles();

  // Test file retrieval by owner
  try {
    const startTime = Date.now();
    const fileData = fileStore.get('test-file-1', userProfiles.user1.id);
    const duration = Date.now() - startTime;
    
    const testPassed = fileData !== null &&
                      fileData.fileId === 'test-file-1' &&
                      fileData.filename === 'test-data.csv' &&
                      fileData.userId === userProfiles.user1.id;
    
    addTestResult('File Retrieval by Owner', testPassed, null, duration);
    
    if (testPassed && config.debugAuth) {
      log(`  📖 Access count: ${fileData.accessCount}`, colors.blue);
      log(`  📖 Last accessed: ${fileData.lastAccessedAt}`, colors.blue);
    }
    
  } catch (error) {
    addTestResult('File Retrieval by Owner', false, error);
  }

  // Test access denied for non-owner
  try {
    const fileData = fileStore.get('test-file-1', userProfiles.user2.id);
    const testPassed = false; // Should throw error
    
    addTestResult('Access Denied for Non-Owner', testPassed);
    
  } catch (error) {
    // Should get access denied error
    const testPassed = error.message.includes('Access denied');
    addTestResult('Access Denied for Non-Owner', testPassed);
  }

  // Test public file access
  try {
    const fileData = fileStore.get('test-file-2', userProfiles.user1.id);
    const testPassed = fileData !== null && fileData.fileId === 'test-file-2';
    
    addTestResult('Public File Access', testPassed);
    
  } catch (error) {
    addTestResult('Public File Access', false, error);
  }

  // Test file metadata retrieval
  try {
    const metadata = fileStore.getMetadata('test-file-1', userProfiles.user1.id);
    
    const testPassed = metadata !== null &&
                      metadata.fileId === 'test-file-1' &&
                      metadata.headers &&
                      metadata.checksum;
    
    addTestResult('File Metadata Retrieval', testPassed);
    
    if (testPassed && config.debugAuth) {
      log(`  📋 Headers: ${metadata.headers.join(', ')}`, colors.blue);
      log(`  📋 Checksum: ${metadata.checksum}`, colors.blue);
    }
    
  } catch (error) {
    addTestResult('File Metadata Retrieval', false, error);
  }
}

/**
 * Test user file management
 */
function testUserFileManagement() {
  log('\n👤 Testing User File Management', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  const userProfiles = createSampleUserProfiles();

  // Test getting user files
  try {
    const startTime = Date.now();
    const userFiles = fileStore.getUserFiles(userProfiles.user1.id);
    const duration = Date.now() - startTime;
    
    const testPassed = Array.isArray(userFiles) &&
                      userFiles.length > 0 &&
                      userFiles[0].fileId === 'test-file-1';
    
    addTestResult('Get User Files', testPassed, null, duration);
    
    if (testPassed && config.debugAuth) {
      log(`  👤 User files count: ${userFiles.length}`, colors.blue);
      log(`  👤 First file: ${userFiles[0].filename}`, colors.blue);
    }
    
  } catch (error) {
    addTestResult('Get User Files', false, error);
  }

  // Test user files with sorting and pagination
  try {
    const sortedFiles = fileStore.getUserFiles(userProfiles.user1.id, {
      sortBy: 'uploadedAt',
      sortOrder: 'desc',
      limit: 10,
      offset: 0
    });
    
    const testPassed = Array.isArray(sortedFiles);
    
    addTestResult('User Files with Sorting/Pagination', testPassed);
    
  } catch (error) {
    addTestResult('User Files with Sorting/Pagination', false, error);
  }

  // Test empty user files
  try {
    const emptyFiles = fileStore.getUserFiles('non-existent-user');
    const testPassed = Array.isArray(emptyFiles) && emptyFiles.length === 0;
    
    addTestResult('Empty User Files', testPassed);
    
  } catch (error) {
    addTestResult('Empty User Files', false, error);
  }

  // Test file existence check
  try {
    const exists1 = fileStore.exists('test-file-1', userProfiles.user1.id);
    const exists2 = fileStore.exists('non-existent-file', userProfiles.user1.id);
    
    const testPassed = exists1 === true && exists2 === false;
    
    addTestResult('File Existence Check', testPassed);
    
  } catch (error) {
    addTestResult('File Existence Check', false, error);
  }
}

/**
 * Test file deletion and cleanup
 */
function testFileDeletion() {
  log('\n🗑️  Testing File Deletion and Cleanup', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  const userProfiles = createSampleUserProfiles();

  // Test file deletion by owner
  try {
    const startTime = Date.now();
    const deleted = fileStore.delete('test-file-1', userProfiles.user1.id, {
      reason: 'test_cleanup'
    });
    const duration = Date.now() - startTime;
    
    const testPassed = deleted === true;
    
    addTestResult('File Deletion by Owner', testPassed, null, duration);
    
    // Verify file is gone
    const exists = fileStore.exists('test-file-1');
    const verificationPassed = exists === false;
    
    addTestResult('File Deletion Verification', verificationPassed);
    
  } catch (error) {
    addTestResult('File Deletion by Owner', false, error);
  }

  // Test deletion of non-existent file
  try {
    const deleted = fileStore.delete('non-existent-file', userProfiles.user1.id);
    const testPassed = deleted === false; // Should return false for non-existent file
    
    addTestResult('Non-Existent File Deletion', testPassed);
    
  } catch (error) {
    addTestResult('Non-Existent File Deletion', false, error);
  }

  // Test unauthorized deletion
  try {
    const deleted = fileStore.delete('test-file-2', userProfiles.user1.id);
    const testPassed = false; // Should throw error
    
    addTestResult('Unauthorized Deletion', testPassed);
    
  } catch (error) {
    // Should get access denied error
    const testPassed = error.message.includes('Access denied');
    addTestResult('Unauthorized Deletion', testPassed);
  }
}

/**
 * Test storage statistics and management
 */
function testStorageStatistics() {
  log('\n📊 Testing Storage Statistics and Management', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  // Test storage statistics
  try {
    const stats = fileStore.getStats();
    
    const testPassed = stats &&
                      typeof stats.totalFiles === 'number' &&
                      typeof stats.totalUsers === 'number' &&
                      typeof stats.storageUsed === 'number' &&
                      typeof stats.averageFileSize === 'number' &&
                      typeof stats.utilizationPercent === 'number';
    
    addTestResult('Storage Statistics', testPassed);
    
    if (testPassed && config.debugAuth) {
      log(`  📊 Total files: ${stats.totalFiles}`, colors.blue);
      log(`  📊 Total users: ${stats.totalUsers}`, colors.blue);
      log(`  📊 Storage used: ${stats.storageUsedMB} MB`, colors.blue);
      log(`  📊 Utilization: ${stats.utilizationPercent}%`, colors.blue);
    }
    
  } catch (error) {
    addTestResult('Storage Statistics', false, error);
  }

  // Test getAllIds functionality
  try {
    const allIds = fileStore.getAllIds();
    const userIds = fileStore.getAllIds('user-789'); // user2
    
    const testPassed = Array.isArray(allIds) && Array.isArray(userIds);
    
    addTestResult('Get All File IDs', testPassed);
    
    if (testPassed && config.debugAuth) {
      log(`  📋 All files: ${allIds.length}`, colors.blue);
      log(`  📋 User files: ${userIds.length}`, colors.blue);
    }
    
  } catch (error) {
    addTestResult('Get All File IDs', false, error);
  }

  // Test user upload capability check
  try {
    const userProfiles = createSampleUserProfiles();
    
    const canUpload1 = fileStore.canUserUpload(userProfiles.user1.id, userProfiles.user1);
    const canUpload2 = fileStore.canUserUpload(userProfiles.limitedUser.id, userProfiles.limitedUser);
    
    const testPassed = canUpload1 === true && canUpload2 === false;
    
    addTestResult('User Upload Capability Check', testPassed);
    
  } catch (error) {
    addTestResult('User Upload Capability Check', false, error);
  }
}

/**
 * Test file size estimation and checksums
 */
function testFileProcessing() {
  log('\n🔧 Testing File Processing Functions', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  const csvData = createSampleCSVData();

  // Test file size estimation
  try {
    const smallSize = fileStore.estimateFileSize(csvData.small, 'small.csv');
    const mediumSize = fileStore.estimateFileSize(csvData.medium, 'medium.csv');
    const largeSize = fileStore.estimateFileSize(csvData.large, 'large.csv');
    
    const testPassed = smallSize > 0 &&
                      mediumSize > smallSize &&
                      largeSize > mediumSize;
    
    addTestResult('File Size Estimation', testPassed);
    
    if (testPassed && config.debugAuth) {
      log(`  📏 Small: ${smallSize} bytes`, colors.blue);
      log(`  📏 Medium: ${mediumSize} bytes`, colors.blue);
      log(`  📏 Large: ${largeSize} bytes`, colors.blue);
    }
    
  } catch (error) {
    addTestResult('File Size Estimation', false, error);
  }

  // Test checksum calculation
  try {
    const checksum1 = fileStore.calculateChecksum(csvData.small);
    const checksum2 = fileStore.calculateChecksum(csvData.small); // Same data
    const checksum3 = fileStore.calculateChecksum(csvData.medium); // Different data
    
    const testPassed = checksum1 === checksum2 && checksum1 !== checksum3;
    
    addTestResult('Checksum Calculation', testPassed);
    
    if (testPassed && config.debugAuth) {
      log(`  🔐 Checksum 1: ${checksum1}`, colors.blue);
      log(`  🔐 Checksum 2: ${checksum2}`, colors.blue);
      log(`  🔐 Checksum 3: ${checksum3}`, colors.blue);
    }
    
  } catch (error) {
    addTestResult('Checksum Calculation', false, error);
  }

  // Test empty data handling
  try {
    const emptySize = fileStore.estimateFileSize([], 'empty.csv');
    const emptyChecksum = fileStore.calculateChecksum([]);
    
    const testPassed = emptySize > 0 && emptyChecksum === '0';
    
    addTestResult('Empty Data Handling', testPassed);
    
  } catch (error) {
    addTestResult('Empty Data Handling', false, error);
  }
}

/**
 * Test access control and permissions
 */
function testAccessControl() {
  log('\n🔐 Testing Access Control and Permissions', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  const userProfiles = createSampleUserProfiles();

  // Test file access permission check
  try {
    const hasRead = fileStore.hasFileAccess('test-file-2', userProfiles.user2.id, 'read');
    const hasWrite = fileStore.hasFileAccess('test-file-2', userProfiles.user2.id, 'write');
    const hasDelete = fileStore.hasFileAccess('test-file-2', userProfiles.user2.id, 'delete');
    
    // user2 is owner of test-file-2, so should have all permissions
    const testPassed = hasRead === true && hasWrite === true && hasDelete === true;
    
    addTestResult('Owner Permissions Check', testPassed);
    
  } catch (error) {
    addTestResult('Owner Permissions Check', false, error);
  }

  // Test public file access
  try {
    // test-file-2 is public, so user1 should have read access
    const hasRead = fileStore.hasFileAccess('test-file-2', userProfiles.user1.id, 'read');
    const hasWrite = fileStore.hasFileAccess('test-file-2', userProfiles.user1.id, 'write');
    
    const testPassed = hasRead === true && hasWrite === false;
    
    addTestResult('Public File Access Check', testPassed);
    
  } catch (error) {
    addTestResult('Public File Access Check', false, error);
  }

  // Test non-existent file access
  try {
    const hasAccess = fileStore.hasFileAccess('non-existent-file', userProfiles.user1.id, 'read');
    const testPassed = hasAccess === false;
    
    addTestResult('Non-Existent File Access', testPassed);
    
  } catch (error) {
    addTestResult('Non-Existent File Access', false, error);
  }
}

/**
 * Test performance characteristics
 */
async function testPerformance() {
  log('\n⚡ Testing Performance Characteristics', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  const csvData = createSampleCSVData();
  const userProfiles = createSampleUserProfiles();

  // Test bulk file storage
  try {
    const startTime = Date.now();
    const results = [];
    
    for (let i = 0; i < 10; i++) {
      const result = fileStore.store(
        `perf-test-${i}`,
        `performance-test-${i}.csv`,
        csvData.medium,
        userProfiles.admin.id,
        userProfiles.admin
      );
      results.push(result);
    }
    
    const duration = Date.now() - startTime;
    const avgDuration = duration / 10;
    const allSuccessful = results.every(r => r.success);
    
    addTestResult('Bulk File Storage (10 files)', allSuccessful, null, duration);
    
    if (allSuccessful && config.debugAuth) {
      log(`  ⚡ Average per file: ${avgDuration.toFixed(2)}ms`, colors.blue);
      log(`  ⚡ Total duration: ${duration}ms`, colors.blue);
    }
    
  } catch (error) {
    addTestResult('Bulk File Storage', false, error);
  }

  // Test bulk file retrieval
  try {
    const startTime = Date.now();
    
    for (let i = 0; i < 10; i++) {
      const fileData = fileStore.get(`perf-test-${i}`, userProfiles.admin.id);
      if (!fileData) {
        throw new Error(`Failed to retrieve perf-test-${i}`);
      }
    }
    
    const duration = Date.now() - startTime;
    const avgDuration = duration / 10;
    
    addTestResult('Bulk File Retrieval (10 files)', true, null, duration);
    
    if (config.debugAuth) {
      log(`  ⚡ Average per file: ${avgDuration.toFixed(2)}ms`, colors.blue);
    }
    
  } catch (error) {
    addTestResult('Bulk File Retrieval', false, error);
  }

  // Clean up performance test files
  try {
    let cleanupCount = 0;
    for (let i = 0; i < 10; i++) {
      const deleted = fileStore.delete(`perf-test-${i}`, userProfiles.admin.id);
      if (deleted) cleanupCount++;
    }
    
    addTestResult('Performance Test Cleanup', cleanupCount === 10);
    
  } catch (error) {
    addTestResult('Performance Test Cleanup', false, error);
  }
}

/**
 * Generate testing report
 */
function generateTestReport() {
  log('\n📋 File Store Testing Report', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  const successRate = testResults.total > 0 ? 
    Math.round((testResults.passed / testResults.total) * 100) : 0;

  log(`\n📊 Test Summary:`, colors.yellow);
  log(`  Total Tests: ${testResults.total}`, colors.blue);
  log(`  Passed: ${testResults.passed}`, colors.green);
  log(`  Failed: ${testResults.failed}`, colors.red);
  log(`  Success Rate: ${successRate}%`, successRate >= 80 ? colors.green : colors.red);

  if (testResults.failed > 0) {
    log(`\n❌ Failed Tests:`, colors.red);
    testResults.errors.forEach((error, index) => {
      log(`  ${index + 1}. ${error.test}: ${error.error}`, colors.red);
    });
  }

  if (Object.keys(testResults.performance).length > 0) {
    log(`\n⚡ Performance Results:`, colors.yellow);
    Object.entries(testResults.performance).forEach(([test, duration]) => {
      const color = duration < 50 ? colors.green : duration < 200 ? colors.yellow : colors.red;
      log(`  ${test}: ${duration}ms`, color);
    });
  }

  // Overall status
  if (successRate >= 90) {
    log(`\n✅ Overall Status: EXCELLENT - File store is production-ready`, colors.green);
  } else if (successRate >= 80) {
    log(`\n⚠️  Overall Status: GOOD - Minor issues need attention`, colors.yellow);
  } else if (successRate >= 60) {
    log(`\n🔶 Overall Status: NEEDS WORK - Several issues require fixing`, colors.yellow);
  } else {
    log(`\n❌ Overall Status: CRITICAL - Major issues prevent production use`, colors.red);
  }

  return {
    success: successRate >= 80,
    summary: testResults
  };
}

/**
 * Main function
 */
async function main() {
  const command = process.argv[2] || 'all';

  log('🧪 TaktMate File Store Testing', colors.bright);
  log(`Environment: ${process.env.NODE_ENV || 'development'}`, colors.blue);

  try {
    // Clear file store before testing
    fileStore.clear();
    
    switch (command) {
      case 'init':
        testFileStoreInitialization();
        break;
      case 'storage':
        testFileStorage();
        break;
      case 'retrieval':
        testFileRetrieval();
        break;
      case 'management':
        testUserFileManagement();
        break;
      case 'deletion':
        testFileDeletion();
        break;
      case 'statistics':
        testStorageStatistics();
        break;
      case 'processing':
        testFileProcessing();
        break;
      case 'access':
        testAccessControl();
        break;
      case 'performance':
        await testPerformance();
        break;
      case 'help':
        log('\nUsage: node test-file-store.js [command]', colors.yellow);
        log('\nCommands:', colors.yellow);
        log('  init        - Test file store initialization', colors.blue);
        log('  storage     - Test file storage operations', colors.blue);
        log('  retrieval   - Test file retrieval and access', colors.blue);
        log('  management  - Test user file management', colors.blue);
        log('  deletion    - Test file deletion operations', colors.blue);
        log('  statistics  - Test storage statistics', colors.blue);
        log('  processing  - Test file processing functions', colors.blue);
        log('  access      - Test access control', colors.blue);
        log('  performance - Test performance characteristics', colors.blue);
        log('  all         - Run all tests (default)', colors.blue);
        log('  help        - Display this help', colors.blue);
        break;
      case 'all':
      default:
        testFileStoreInitialization();
        testFileStorage();
        testFileRetrieval();
        testUserFileManagement();
        testFileDeletion();
        testStorageStatistics();
        testFileProcessing();
        testAccessControl();
        await testPerformance();
        
        const report = generateTestReport();
        
        log('\n📖 Next Steps:', colors.cyan);
        if (report.success) {
          log('1. File store is ready for production use', colors.blue);
          log('2. Integrate with CSV upload endpoints', colors.blue);
          log('3. Add file management UI components', colors.blue);
        } else {
          log('1. Fix the issues identified in the test report', colors.red);
          log('2. Re-run tests to verify fixes', colors.blue);
          log('3. Check configuration and dependencies', colors.blue);
        }
        break;
    }
    
  } catch (error) {
    log(`\n❌ Testing Error: ${error.message}`, colors.red);
    console.error(error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    log(`\n❌ Script Error: ${error.message}`, colors.red);
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  testFileStoreInitialization,
  testFileStorage,
  testFileRetrieval,
  testUserFileManagement,
  testFileDeletion,
  testStorageStatistics,
  testFileProcessing,
  testAccessControl,
  testPerformance,
  generateTestReport,
  createSampleCSVData,
  createSampleUserProfiles
};
