#!/usr/bin/env node

/**
 * User Service Testing Utility for TaktMate
 * 
 * This script tests the user service functionality including profile extraction,
 * enhancement, validation, caching, and business logic operations.
 */

const { UserService, userService } = require('../services/userService');
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
 * Create sample JWT payloads for testing
 */
function createSampleJWTPayloads() {
  const now = Math.floor(Date.now() / 1000);
  
  return {
    basicUser: {
      iss: `https://${config.tenantName}.b2clogin.com/${config.tenantId}/v2.0/`,
      aud: config.clientId,
      sub: 'basic-user-12345',
      iat: now,
      exp: now + 3600,
      nbf: now,
      auth_time: now,
      emails: ['basic@example.com'],
      given_name: 'John',
      family_name: 'Doe',
      name: 'John Doe',
      email: 'basic@example.com',
      email_verified: true,
      idp: 'local',
      tfp: 'B2C_1_signupsignin1'
    },
    
    googleUser: {
      iss: `https://${config.tenantName}.b2clogin.com/${config.tenantId}/v2.0/`,
      aud: config.clientId,
      sub: 'google-user-67890',
      iat: now,
      exp: now + 3600,
      nbf: now,
      auth_time: now,
      emails: ['google.user@gmail.com'],
      given_name: 'Jane',
      family_name: 'Smith',
      name: 'Jane Smith',
      email: 'google.user@gmail.com',
      email_verified: true,
      idp: 'google.com',
      tfp: 'B2C_1_signupsignin1',
      amr: ['mfa']
    },
    
    enterpriseUser: {
      iss: `https://${config.tenantName}.b2clogin.com/${config.tenantId}/v2.0/`,
      aud: config.clientId,
      sub: 'enterprise-user-54321',
      iat: now,
      exp: now + 3600,
      nbf: now,
      auth_time: now,
      emails: ['admin@enterprise.com'],
      given_name: 'Alice',
      family_name: 'Johnson',
      name: 'Alice Johnson',
      email: 'admin@enterprise.com',
      email_verified: true,
      idp: 'microsoft.com',
      tfp: 'B2C_1_signupsignin1',
      extension_Company: 'Enterprise Corp',
      extension_Role: 'Administrator',
      extension_Industry: 'Technology',
      jobTitle: 'System Administrator',
      amr: ['pwd', 'mfa']
    },
    
    customPolicyUser: {
      iss: `https://${config.tenantName}.b2clogin.com/${config.tenantId}/v2.0/`,
      aud: config.clientId,
      sub: 'custom-user-98765',
      iat: now,
      exp: now + 3600,
      nbf: now,
      auth_time: now,
      emails: ['custom@company.com'],
      given_name: 'Bob',
      family_name: 'Wilson',
      name: 'Bob Wilson',
      email: 'custom@company.com',
      email_verified: false,
      idp: 'local',
      tfp: 'B2C_1A_SIGNUP_SIGNIN',
      company: 'Custom Company',
      role: 'Data Analyst',
      industry: 'Finance',
      department: 'Analytics'
    },
    
    incompleteUser: {
      iss: `https://${config.tenantName}.b2clogin.com/${config.tenantId}/v2.0/`,
      aud: config.clientId,
      sub: 'incomplete-user-11111',
      iat: now,
      exp: now + 3600,
      nbf: now,
      emails: ['incomplete@example.com'],
      email: 'incomplete@example.com',
      idp: 'local',
      tfp: 'B2C_1_signupsignin1'
      // Missing many fields intentionally
    },
    
    invalidUser: {
      iss: `https://${config.tenantName}.b2clogin.com/${config.tenantId}/v2.0/`,
      aud: config.clientId,
      sub: 'invalid-user-99999',
      iat: now,
      exp: now + 3600,
      nbf: now,
      emails: ['invalid-email'],
      email: 'invalid-email', // Invalid email format
      given_name: 'A'.repeat(150), // Too long
      idp: 'local',
      tfp: 'B2C_1_signupsignin1'
    }
  };
}

/**
 * Test user service initialization
 */
function testUserServiceInitialization() {
  log('\n🏗️  Testing User Service Initialization', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  try {
    // Test singleton instance
    addTestResult('Singleton UserService Instance', userService instanceof UserService);
    
    // Test cache initialization
    const cacheStats = userService.getCacheStats();
    addTestResult('Cache Initialization', cacheStats && typeof cacheStats.totalEntries === 'number');
    
    // Test new instance creation
    const newService = new UserService();
    addTestResult('New UserService Instance Creation', newService instanceof UserService);
    
    if (config.debugAuth) {
      log(`  📊 Cache timeout: ${userService.cacheTimeout}ms`, colors.blue);
      log(`  📊 Max cache size: ${userService.maxCacheSize}`, colors.blue);
    }
    
  } catch (error) {
    addTestResult('User Service Initialization', false, error);
  }
}

/**
 * Test user profile processing
 */
async function testUserProfileProcessing() {
  log('\n👤 Testing User Profile Processing', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  const samplePayloads = createSampleJWTPayloads();

  // Test basic user processing
  try {
    const startTime = Date.now();
    const result = await userService.processUserFromJWT(samplePayloads.basicUser);
    const duration = Date.now() - startTime;
    
    const testPassed = result.success === true &&
                      result.user &&
                      result.user.id === 'basic-user-12345' &&
                      result.user.email === 'basic@example.com' &&
                      result.user.displayName === 'John Doe';
    
    addTestResult('Basic User Processing', testPassed, null, duration);
    
    if (testPassed && config.debugAuth) {
      log(`  👤 User: ${result.user.displayName} (${result.user.email})`, colors.blue);
      log(`  👤 Type: ${result.user.userType}`, colors.blue);
      log(`  👤 Permissions: ${result.user.permissions.length}`, colors.blue);
    }
    
  } catch (error) {
    addTestResult('Basic User Processing', false, error);
  }

  // Test Google user processing
  try {
    const startTime = Date.now();
    const result = await userService.processUserFromJWT(samplePayloads.googleUser);
    const duration = Date.now() - startTime;
    
    const testPassed = result.success === true &&
                      result.user &&
                      result.user.identityProvider === 'google.com' &&
                      result.user.emailVerified === true &&
                      result.user.mfaEnabled === true;
    
    addTestResult('Google User Processing', testPassed, null, duration);
    
  } catch (error) {
    addTestResult('Google User Processing', false, error);
  }

  // Test enterprise user processing
  try {
    const startTime = Date.now();
    const result = await userService.processUserFromJWT(samplePayloads.enterpriseUser);
    const duration = Date.now() - startTime;
    
    const testPassed = result.success === true &&
                      result.user &&
                      result.user.company === 'Enterprise Corp' &&
                      result.user.role === 'Administrator' &&
                      result.user.userType === 'admin';
    
    addTestResult('Enterprise User Processing', testPassed, null, duration);
    
  } catch (error) {
    addTestResult('Enterprise User Processing', false, error);
  }

  // Test custom policy user processing
  try {
    const startTime = Date.now();
    const result = await userService.processUserFromJWT(samplePayloads.customPolicyUser);
    const duration = Date.now() - startTime;
    
    const testPassed = result.success === true &&
                      result.user &&
                      result.user.company === 'Custom Company' &&
                      result.user.role === 'Data Analyst' &&
                      result.user.department === 'Analytics';
    
    addTestResult('Custom Policy User Processing', testPassed, null, duration);
    
  } catch (error) {
    addTestResult('Custom Policy User Processing', false, error);
  }

  // Test incomplete user processing
  try {
    const startTime = Date.now();
    const result = await userService.processUserFromJWT(samplePayloads.incompleteUser);
    const duration = Date.now() - startTime;
    
    const testPassed = result.success === true &&
                      result.user &&
                      result.user.id === 'incomplete-user-11111' &&
                      result.user.displayName !== undefined; // Should have fallback
    
    addTestResult('Incomplete User Processing', testPassed, null, duration);
    
  } catch (error) {
    addTestResult('Incomplete User Processing', false, error);
  }

  // Test invalid user processing
  try {
    const startTime = Date.now();
    const result = await userService.processUserFromJWT(samplePayloads.invalidUser);
    const duration = Date.now() - startTime;
    
    const testPassed = result.success === false; // Should fail validation
    
    addTestResult('Invalid User Processing', testPassed, null, duration);
    
  } catch (error) {
    addTestResult('Invalid User Processing', false, error);
  }

  // Test null payload handling
  try {
    const result = await userService.processUserFromJWT(null);
    const testPassed = result.success === false;
    
    addTestResult('Null Payload Handling', testPassed);
    
  } catch (error) {
    addTestResult('Null Payload Handling', false, error);
  }
}

/**
 * Test user profile enhancement
 */
async function testUserProfileEnhancement() {
  log('\n🔧 Testing User Profile Enhancement', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  const samplePayloads = createSampleJWTPayloads();
  const baseProfile = {
    id: 'test-user',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User'
  };

  try {
    const enhanced = await userService.enhanceUserProfile(baseProfile, samplePayloads.basicUser);
    
    const testPassed = enhanced &&
                      enhanced.displayName &&
                      enhanced.initials &&
                      enhanced.profileCreatedAt &&
                      enhanced.permissions &&
                      enhanced.metadata;
    
    addTestResult('Profile Enhancement', testPassed);
    
    if (testPassed && config.debugAuth) {
      log(`  🔧 Display Name: ${enhanced.displayName}`, colors.blue);
      log(`  🔧 Initials: ${enhanced.initials}`, colors.blue);
      log(`  🔧 User Type: ${enhanced.userType}`, colors.blue);
      log(`  🔧 Permissions: ${enhanced.permissions.join(', ')}`, colors.blue);
    }
    
  } catch (error) {
    addTestResult('Profile Enhancement', false, error);
  }

  // Test display name processing
  try {
    const testCases = [
      { input: { displayName: 'John Doe' }, expected: 'John Doe' },
      { input: { firstName: 'Jane', lastName: 'Smith' }, expected: 'Jane Smith' },
      { input: { email: 'test.user@example.com' }, expected: 'Test User' },
      { input: { email: 'single@example.com' }, expected: 'Single' }
    ];

    let allPassed = true;
    for (const testCase of testCases) {
      const result = userService.processDisplayName(testCase.input);
      if (result !== testCase.expected) {
        allPassed = false;
        break;
      }
    }
    
    addTestResult('Display Name Processing', allPassed);
    
  } catch (error) {
    addTestResult('Display Name Processing', false, error);
  }

  // Test initials generation
  try {
    const testCases = [
      { input: { displayName: 'John Doe' }, expected: 'JD' },
      { input: { displayName: 'Jane' }, expected: 'JA' },
      { input: { email: 'test@example.com' }, expected: 'TE' }
    ];

    let allPassed = true;
    for (const testCase of testCases) {
      const result = userService.generateInitials(testCase.input);
      if (result !== testCase.expected) {
        allPassed = false;
        break;
      }
    }
    
    addTestResult('Initials Generation', allPassed);
    
  } catch (error) {
    addTestResult('Initials Generation', false, error);
  }
}

/**
 * Test user profile validation
 */
function testUserProfileValidation() {
  log('\n✅ Testing User Profile Validation', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  // Test valid profile
  try {
    const validProfile = {
      id: 'valid-user-123',
      email: 'valid@example.com',
      displayName: 'Valid User',
      company: 'Valid Company',
      role: 'User'
    };
    
    const result = userService.validateUserProfile(validProfile);
    
    addTestResult('Valid Profile Validation', result.valid === true);
    
  } catch (error) {
    addTestResult('Valid Profile Validation', false, error);
  }

  // Test invalid profiles
  const invalidProfiles = [
    { profile: {}, expectedError: 'User ID is required' },
    { profile: { id: 'test' }, expectedError: 'Email is required' },
    { profile: { id: 'test', email: 'invalid-email' }, expectedError: 'Invalid email format' },
    { profile: { id: 'test', email: 'valid@example.com', company: 'A'.repeat(101) }, expectedError: 'Company name too long' },
    { profile: { id: 'test', email: 'valid@example.com', role: 'A'.repeat(51) }, expectedError: 'Role too long' }
  ];

  invalidProfiles.forEach((testCase, index) => {
    try {
      const result = userService.validateUserProfile(testCase.profile);
      const testPassed = result.valid === false && 
                        result.errors.some(error => error.includes(testCase.expectedError.split(' ')[0]));
      
      addTestResult(`Invalid Profile ${index + 1}`, testPassed);
      
    } catch (error) {
      addTestResult(`Invalid Profile ${index + 1}`, false, error);
    }
  });
}

/**
 * Test user caching functionality
 */
async function testUserCaching() {
  log('\n💾 Testing User Caching', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  const samplePayloads = createSampleJWTPayloads();

  // Test cache storage and retrieval
  try {
    // Process user with caching enabled
    const result = await userService.processUserFromJWT(samplePayloads.basicUser, { cache: true });
    
    if (result.success) {
      // Try to retrieve from cache
      const cachedProfile = userService.getCachedUserProfile(result.user.id);
      
      const testPassed = cachedProfile !== null &&
                        cachedProfile.id === result.user.id &&
                        cachedProfile.email === result.user.email;
      
      addTestResult('Cache Storage and Retrieval', testPassed);
      
      if (testPassed && config.debugAuth) {
        log(`  💾 Cached user: ${cachedProfile.email}`, colors.blue);
      }
    } else {
      addTestResult('Cache Storage and Retrieval', false, new Error('User processing failed'));
    }
    
  } catch (error) {
    addTestResult('Cache Storage and Retrieval', false, error);
  }

  // Test cache statistics
  try {
    const stats = userService.getCacheStats();
    
    const testPassed = stats &&
                      typeof stats.totalEntries === 'number' &&
                      typeof stats.activeEntries === 'number' &&
                      typeof stats.maxSize === 'number';
    
    addTestResult('Cache Statistics', testPassed);
    
    if (testPassed && config.debugAuth) {
      log(`  📊 Total entries: ${stats.totalEntries}`, colors.blue);
      log(`  📊 Active entries: ${stats.activeEntries}`, colors.blue);
      log(`  📊 Max size: ${stats.maxSize}`, colors.blue);
    }
    
  } catch (error) {
    addTestResult('Cache Statistics', false, error);
  }

  // Test cache update
  try {
    const userId = 'basic-user-12345';
    const updates = { lastLoginAt: new Date().toISOString(), role: 'Updated Role' };
    
    const updatedProfile = userService.updateCachedUserProfile(userId, updates);
    
    const testPassed = updatedProfile !== null &&
                      updatedProfile.role === 'Updated Role' &&
                      updatedProfile.lastUpdated;
    
    addTestResult('Cache Update', testPassed);
    
  } catch (error) {
    addTestResult('Cache Update', false, error);
  }

  // Test cache clearing
  try {
    const userId = 'basic-user-12345';
    const cleared = userService.clearUserCache(userId);
    
    // Verify user is no longer in cache
    const cachedProfile = userService.getCachedUserProfile(userId);
    
    const testPassed = cleared === true && cachedProfile === null;
    
    addTestResult('Cache Clearing', testPassed);
    
  } catch (error) {
    addTestResult('Cache Clearing', false, error);
  }

  // Test expired cache cleanup
  try {
    // Add multiple users to cache
    for (let i = 0; i < 3; i++) {
      const payload = { ...samplePayloads.basicUser, sub: `test-user-${i}` };
      await userService.processUserFromJWT(payload, { cache: true });
    }
    
    const clearedCount = userService.clearExpiredCache();
    
    const testPassed = typeof clearedCount === 'number' && clearedCount >= 0;
    
    addTestResult('Expired Cache Cleanup', testPassed);
    
  } catch (error) {
    addTestResult('Expired Cache Cleanup', false, error);
  }
}

/**
 * Test custom attribute processing
 */
function testCustomAttributeProcessing() {
  log('\n🏷️  Testing Custom Attribute Processing', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  const testPayload = {
    extension_Company: 'Extension Company',
    extension_Role: 'Extension Role',
    company: 'Direct Company',
    role: 'Direct Role',
    organization: 'Organization Name',
    jobTitle: 'Job Title'
  };

  // Test extension_ prefixed claims (highest priority)
  try {
    const company = userService.processCustomAttribute(testPayload, 'Company');
    const role = userService.processCustomAttribute(testPayload, 'Role');
    
    const testPassed = company === 'Extension Company' && role === 'Extension Role';
    
    addTestResult('Extension Claims Processing', testPassed);
    
  } catch (error) {
    addTestResult('Extension Claims Processing', false, error);
  }

  // Test fallback to direct claims
  try {
    const testPayloadNoDirect = {
      company: 'Direct Company',
      role: 'Direct Role'
    };
    
    const company = userService.processCustomAttribute(testPayloadNoDirect, 'Company');
    const role = userService.processCustomAttribute(testPayloadNoDirect, 'Role');
    
    const testPassed = company === 'Direct Company' && role === 'Direct Role';
    
    addTestResult('Direct Claims Processing', testPassed);
    
  } catch (error) {
    addTestResult('Direct Claims Processing', false, error);
  }

  // Test standard claim fallbacks
  try {
    const testPayloadStandard = {
      organization: 'Organization Name',
      jobTitle: 'Job Title'
    };
    
    const company = userService.processCustomAttribute(testPayloadStandard, 'Company');
    const role = userService.processCustomAttribute(testPayloadStandard, 'Role');
    
    const testPassed = company === 'Organization Name' && role === 'Job Title';
    
    addTestResult('Standard Claims Fallback', testPassed);
    
  } catch (error) {
    addTestResult('Standard Claims Fallback', false, error);
  }

  // Test fallback value
  try {
    const emptyPayload = {};
    
    const company = userService.processCustomAttribute(emptyPayload, 'Company', 'Default Company');
    const role = userService.processCustomAttribute(emptyPayload, 'Role');
    
    const testPassed = company === 'Default Company' && role === null;
    
    addTestResult('Fallback Value Processing', testPassed);
    
  } catch (error) {
    addTestResult('Fallback Value Processing', false, error);
  }
}

/**
 * Test permission generation
 */
async function testPermissionGeneration() {
  log('\n🔐 Testing Permission Generation', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  // Test admin permissions
  try {
    const adminProfile = {
      id: 'admin-user',
      email: 'admin@example.com',
      role: 'Administrator',
      company: 'Test Company',
      emailVerified: true
    };
    
    const permissions = await userService.generateUserPermissions(adminProfile);
    
    const testPassed = permissions.includes('admin:all') &&
                      permissions.includes('manage:users') &&
                      permissions.includes('verified:email') &&
                      permissions.includes('company:test_company');
    
    addTestResult('Admin Permission Generation', testPassed);
    
    if (testPassed && config.debugAuth) {
      log(`  🔐 Admin permissions: ${permissions.length}`, colors.blue);
    }
    
  } catch (error) {
    addTestResult('Admin Permission Generation', false, error);
  }

  // Test manager permissions
  try {
    const managerProfile = {
      id: 'manager-user',
      email: 'manager@example.com',
      role: 'Manager',
      emailVerified: true
    };
    
    const permissions = await userService.generateUserPermissions(managerProfile);
    
    const testPassed = permissions.includes('manage:team') &&
                      permissions.includes('view:reports') &&
                      !permissions.includes('admin:all');
    
    addTestResult('Manager Permission Generation', testPassed);
    
  } catch (error) {
    addTestResult('Manager Permission Generation', false, error);
  }

  // Test basic user permissions
  try {
    const basicProfile = {
      id: 'basic-user',
      email: 'basic@example.com',
      role: 'User',
      emailVerified: false
    };
    
    const permissions = await userService.generateUserPermissions(basicProfile);
    
    const testPassed = permissions.includes('read:profile') &&
                      permissions.includes('upload:csv') &&
                      !permissions.includes('verified:email') &&
                      !permissions.includes('admin:all');
    
    addTestResult('Basic User Permission Generation', testPassed);
    
  } catch (error) {
    addTestResult('Basic User Permission Generation', false, error);
  }
}

/**
 * Test user type determination
 */
function testUserTypeDetermination() {
  log('\n👥 Testing User Type Determination', colors.cyan);
  log('=' .repeat(60), colors.cyan);

  const testCases = [
    { profile: { role: 'Administrator' }, expected: 'admin' },
    { profile: { role: 'Manager' }, expected: 'manager' },
    { profile: { role: 'Data Analyst' }, expected: 'analyst' },
    { profile: { identityProvider: 'google.com' }, expected: 'google_user' },
    { profile: { identityProvider: 'microsoft.com' }, expected: 'microsoft_user' },
    { profile: { role: 'User' }, expected: 'standard_user' }
  ];

  testCases.forEach((testCase, index) => {
    try {
      const result = userService.determineUserType(testCase.profile);
      const testPassed = result === testCase.expected;
      
      addTestResult(`User Type ${index + 1} (${testCase.expected})`, testPassed);
      
    } catch (error) {
      addTestResult(`User Type ${index + 1}`, false, error);
    }
  });
}

/**
 * Generate testing report
 */
function generateTestReport() {
  log('\n📋 User Service Testing Report', colors.cyan);
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
    log(`\n✅ Overall Status: EXCELLENT - User service is production-ready`, colors.green);
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

  log('🧪 TaktMate User Service Testing', colors.bright);
  log(`Environment: ${process.env.NODE_ENV || 'development'}`, colors.blue);

  try {
    switch (command) {
      case 'init':
        testUserServiceInitialization();
        break;
      case 'processing':
        await testUserProfileProcessing();
        break;
      case 'enhancement':
        await testUserProfileEnhancement();
        break;
      case 'validation':
        testUserProfileValidation();
        break;
      case 'caching':
        await testUserCaching();
        break;
      case 'attributes':
        testCustomAttributeProcessing();
        break;
      case 'permissions':
        await testPermissionGeneration();
        break;
      case 'types':
        testUserTypeDetermination();
        break;
      case 'help':
        log('\nUsage: node test-user-service.js [command]', colors.yellow);
        log('\nCommands:', colors.yellow);
        log('  init        - Test service initialization', colors.blue);
        log('  processing  - Test user profile processing', colors.blue);
        log('  enhancement - Test profile enhancement', colors.blue);
        log('  validation  - Test profile validation', colors.blue);
        log('  caching     - Test user caching', colors.blue);
        log('  attributes  - Test custom attribute processing', colors.blue);
        log('  permissions - Test permission generation', colors.blue);
        log('  types       - Test user type determination', colors.blue);
        log('  all         - Run all tests (default)', colors.blue);
        log('  help        - Display this help', colors.blue);
        break;
      case 'all':
      default:
        testUserServiceInitialization();
        await testUserProfileProcessing();
        await testUserProfileEnhancement();
        testUserProfileValidation();
        await testUserCaching();
        testCustomAttributeProcessing();
        await testPermissionGeneration();
        testUserTypeDetermination();
        
        const report = generateTestReport();
        
        log('\n📖 Next Steps:', colors.cyan);
        if (report.success) {
          log('1. User service is ready for integration', colors.blue);
          log('2. Test with real Microsoft Entra External ID tokens', colors.blue);
          log('3. Integrate with authentication routes', colors.blue);
        } else {
          log('1. Fix the issues identified in the test report', colors.red);
          log('2. Re-run tests to verify fixes', colors.blue);
          log('3. Check Microsoft Entra External ID configuration', colors.blue);
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
  testUserServiceInitialization,
  testUserProfileProcessing,
  testUserProfileEnhancement,
  testUserProfileValidation,
  testUserCaching,
  testCustomAttributeProcessing,
  testPermissionGeneration,
  testUserTypeDetermination,
  generateTestReport,
  createSampleJWTPayloads
};
