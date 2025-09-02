const User = require('../models/User');
const { initializeDatabase, closeDatabase } = require('../config/database');
const DatabaseMigration = require('../database/migrations');

describe('User Model Tests', () => {
  let testUserId;

  beforeAll(async () => {
    // Initialize database connection
    await initializeDatabase();
    
    // Ensure database schema exists
    const migration = new DatabaseMigration();
    try {
      await migration.runInitialSetup();
    } catch (error) {
      // Schema might already exist, continue
      console.log('Database setup note:', error.message);
    }
  });

  afterAll(async () => {
    // Clean up test data
    if (testUserId) {
      try {
        const testUser = await User.findById(testUserId);
        if (testUser) {
          await testUser.deactivate();
        }
      } catch (error) {
        console.log('Cleanup error:', error.message);
      }
    }
    
    await closeDatabase();
  });

  describe('User Validation', () => {
    test('should validate correct user data', () => {
      const userData = {
        name: 'John Doe',
        company: 'Test Company',
        role: 'Developer',
        email: 'john.doe@test.com',
        password: 'TestPassword123!'
      };

      const validation = User.validate(userData);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should reject invalid email', () => {
      const userData = {
        name: 'John Doe',
        email: 'invalid-email',
        password: 'TestPassword123!'
      };

      const validation = User.validate(userData);
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Please provide a valid email address');
    });

    test('should reject weak password', () => {
      const userData = {
        name: 'John Doe',
        email: 'john@test.com',
        password: 'weak'
      };

      const validation = User.validate(userData);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(error => error.includes('Password must be at least'))).toBe(true);
    });

    test('should reject invalid name characters', () => {
      const userData = {
        name: 'John123',
        email: 'john@test.com',
        password: 'TestPassword123!'
      };

      const validation = User.validate(userData);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(error => error.includes('Name contains invalid characters'))).toBe(true);
    });

    test('should accept optional fields as null', () => {
      const userData = {
        name: 'John Doe',
        company: null,
        role: null,
        email: 'john@test.com',
        password: 'TestPassword123!'
      };

      const validation = User.validate(userData);
      expect(validation.isValid).toBe(true);
    });
  });

  describe('Password Operations', () => {
    test('should hash password correctly', async () => {
      const password = 'TestPassword123!';
      const hash = await User.hashPassword(password);
      
      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(50); // bcrypt hashes are long
    });

    test('should compare password with hash correctly', async () => {
      const password = 'TestPassword123!';
      const hash = await User.hashPassword(password);
      
      const isValid = await User.comparePassword(password, hash);
      expect(isValid).toBe(true);
      
      const isInvalid = await User.comparePassword('wrongpassword', hash);
      expect(isInvalid).toBe(false);
    });
  });

  describe('Token Generation', () => {
    test('should generate email verification token', () => {
      const tokenData = User.generateEmailVerificationToken();
      
      expect(tokenData.token).toBeDefined();
      expect(tokenData.expires).toBeInstanceOf(Date);
      expect(tokenData.token.length).toBe(64); // 32 bytes = 64 hex chars
      expect(tokenData.expires.getTime()).toBeGreaterThan(Date.now());
    });

    test('should generate password reset token', () => {
      const tokenData = User.generatePasswordResetToken();
      
      expect(tokenData.token).toBeDefined();
      expect(tokenData.expires).toBeInstanceOf(Date);
      expect(tokenData.token.length).toBe(64); // 32 bytes = 64 hex chars
      expect(tokenData.expires.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('User CRUD Operations', () => {
    test('should create a new user', async () => {
      const userData = {
        name: 'Test User',
        company: 'Test Company',
        role: 'Tester',
        email: 'testuser@unittest.com',
        password: 'TestPassword123!'
      };

      const user = await User.create(userData);
      testUserId = user.id; // Store for cleanup
      
      expect(user).toBeInstanceOf(User);
      expect(user.id).toBeDefined();
      expect(user.name).toBe(userData.name);
      expect(user.email).toBe(userData.email.toLowerCase());
      expect(user.password_hash).toBeDefined();
      expect(user.password_hash).not.toBe(userData.password);
      expect(user.email_verified).toBe(false);
      expect(user.email_verification_token).toBeDefined();
    });

    test('should find user by ID', async () => {
      if (!testUserId) {
        throw new Error('Test user not created');
      }

      const user = await User.findById(testUserId);
      expect(user).toBeInstanceOf(User);
      expect(user.id).toBe(testUserId);
    });

    test('should find user by email', async () => {
      const user = await User.findByEmail('testuser@unittest.com');
      expect(user).toBeInstanceOf(User);
      expect(user.email).toBe('testuser@unittest.com');
    });

    test('should not create duplicate users', async () => {
      const userData = {
        name: 'Duplicate User',
        email: 'testuser@unittest.com', // Same email as above
        password: 'TestPassword123!'
      };

      await expect(User.create(userData)).rejects.toThrow('User with this email already exists');
    });

    test('should update user data', async () => {
      if (!testUserId) {
        throw new Error('Test user not created');
      }

      const user = await User.findById(testUserId);
      const updatedUser = await user.update({
        name: 'Updated Test User',
        company: 'Updated Company'
      });

      expect(updatedUser.name).toBe('Updated Test User');
      expect(updatedUser.company).toBe('Updated Company');
    });

    test('should verify email', async () => {
      if (!testUserId) {
        throw new Error('Test user not created');
      }

      const user = await User.findById(testUserId);
      await user.verifyEmail(user.email_verification_token);
      
      const verifiedUser = await User.findById(testUserId);
      expect(verifiedUser.email_verified).toBe(true);
      expect(verifiedUser.email_verification_token).toBeNull();
    });

    test('should update password', async () => {
      if (!testUserId) {
        throw new Error('Test user not created');
      }

      const user = await User.findById(testUserId);
      const oldHash = user.password_hash;
      
      await user.updatePassword('NewTestPassword123!');
      
      const updatedUser = await User.findById(testUserId);
      expect(updatedUser.password_hash).not.toBe(oldHash);
      
      // Test new password works
      const isValid = await User.comparePassword('NewTestPassword123!', updatedUser.password_hash);
      expect(isValid).toBe(true);
    });

    test('should get export data for GDPR compliance', async () => {
      if (!testUserId) {
        throw new Error('Test user not created');
      }

      const user = await User.findById(testUserId);
      const exportData = await user.getExportData();
      
      expect(exportData.user).toBeDefined();
      expect(exportData.user.id).toBe(testUserId);
      expect(exportData.user.email).toBe('testuser@unittest.com');
      expect(exportData.sessions).toBeDefined();
      expect(exportData.audit_log).toBeDefined();
      expect(Array.isArray(exportData.sessions)).toBe(true);
      expect(Array.isArray(exportData.audit_log)).toBe(true);
    });

    test('should convert to JSON without sensitive data', async () => {
      if (!testUserId) {
        throw new Error('Test user not created');
      }

      const user = await User.findById(testUserId);
      const json = user.toJSON();
      
      expect(json.id).toBeDefined();
      expect(json.name).toBeDefined();
      expect(json.email).toBeDefined();
      expect(json.password_hash).toBeUndefined();
      expect(json.email_verification_token).toBeUndefined();
      expect(json.password_reset_token).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle non-existent user lookups', async () => {
      const user = await User.findById(999999);
      expect(user).toBeNull();
      
      const userByEmail = await User.findByEmail('nonexistent@test.com');
      expect(userByEmail).toBeNull();
    });

    test('should handle invalid verification token', async () => {
      if (!testUserId) {
        throw new Error('Test user not created');
      }

      const user = await User.findById(testUserId);
      await expect(user.verifyEmail('invalid-token')).rejects.toThrow('Invalid verification token');
    });
  });
});
