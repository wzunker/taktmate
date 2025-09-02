const EmailService = require('../services/emailService');
const User = require('../models/User');
const { initializeDatabase, closeDatabase } = require('../config/database');
const DatabaseMigration = require('../database/migrations');

describe('Email Verification System Tests', () => {
  let emailService;
  let testUser;

  beforeAll(async () => {
    // Initialize database connection
    await initializeDatabase();
    
    // Ensure database schema exists
    const migration = new DatabaseMigration();
    try {
      await migration.runInitialSetup();
    } catch (error) {
      console.log('Database setup note:', error.message);
    }

    // Initialize email service
    emailService = new EmailService();

    // Create test user for email verification tests
    try {
      testUser = await User.create({
        name: 'Email Test User',
        company: 'Test Company',
        role: 'Tester',
        email: 'emailtest@unittest.com',
        password: 'EmailTestPassword123!'
      });
    } catch (error) {
      // User might already exist
      testUser = await User.findByEmail('emailtest@unittest.com');
      if (!testUser) {
        throw error;
      }
    }
  });

  afterAll(async () => {
    // Clean up test data
    if (testUser) {
      try {
        await testUser.deactivate();
      } catch (error) {
        console.log('Cleanup error:', error.message);
      }
    }
    
    await closeDatabase();
  });

  describe('Email Service Configuration', () => {
    test('should initialize email service correctly', () => {
      expect(emailService).toBeDefined();
      expect(emailService.transporter).toBeDefined();
    });

    test('should get email service status', () => {
      const status = emailService.getServiceStatus();
      
      expect(status).toBeDefined();
      expect(status.service).toBeDefined();
      expect(typeof status.configured).toBe('boolean');
      expect(status.mode).toBeDefined();
      expect(status.fromEmail).toBeDefined();
    });

    test('should test email connection', async () => {
      const connectionTest = await emailService.testConnection();
      
      expect(connectionTest).toBeDefined();
      expect(connectionTest.success).toBe(true);
      expect(['console', 'smtp']).toContain(connectionTest.mode);
    });
  });

  describe('Email Verification Templates', () => {
    test('should generate HTML email verification template', () => {
      const verificationUrl = 'https://app.taktconnect.com/auth/verify-email?token=test123';
      const html = emailService.generateEmailVerificationHTML(testUser, verificationUrl);
      
      expect(html).toBeDefined();
      expect(html).toContain(testUser.name);
      expect(html).toContain(verificationUrl);
      expect(html).toContain('Verify Email Address');
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('TaktMate');
    });

    test('should generate plain text email verification template', () => {
      const verificationUrl = 'https://app.taktconnect.com/auth/verify-email?token=test123';
      const text = emailService.generateEmailVerificationText(testUser, verificationUrl);
      
      expect(text).toBeDefined();
      expect(text).toContain(testUser.name);
      expect(text).toContain(verificationUrl);
      expect(text).toContain('verify your email');
      expect(text).toContain('TaktMate');
    });

    test('should generate HTML password reset template', () => {
      const resetUrl = 'https://app.taktconnect.com/auth/reset-password?token=reset123';
      const html = emailService.generatePasswordResetHTML(testUser, resetUrl);
      
      expect(html).toBeDefined();
      expect(html).toContain(testUser.name);
      expect(html).toContain(resetUrl);
      expect(html).toContain('Reset Password');
      expect(html).toContain('expire in 1 hour');
      expect(html).toContain('<!DOCTYPE html>');
    });

    test('should generate plain text password reset template', () => {
      const resetUrl = 'https://app.taktconnect.com/auth/reset-password?token=reset123';
      const text = emailService.generatePasswordResetText(testUser, resetUrl);
      
      expect(text).toBeDefined();
      expect(text).toContain(testUser.name);
      expect(text).toContain(resetUrl);
      expect(text).toContain('password reset');
      expect(text).toContain('expire in 1 hour');
    });

    test('should generate HTML welcome email template', () => {
      const dashboardUrl = 'https://app.taktconnect.com/dashboard';
      const html = emailService.generateWelcomeHTML(testUser, dashboardUrl);
      
      expect(html).toBeDefined();
      expect(html).toContain(testUser.name);
      expect(html).toContain(dashboardUrl);
      expect(html).toContain('Welcome to TaktMate');
      expect(html).toContain('Start Using TaktMate');
      expect(html).toContain('CSV files');
    });

    test('should generate plain text welcome email template', () => {
      const dashboardUrl = 'https://app.taktconnect.com/dashboard';
      const text = emailService.generateWelcomeText(testUser, dashboardUrl);
      
      expect(text).toBeDefined();
      expect(text).toContain(testUser.name);
      expect(text).toContain(dashboardUrl);
      expect(text).toContain('Welcome to TaktMate');
      expect(text).toContain('CSV files');
    });
  });

  describe('Email Sending Operations', () => {
    test('should send email verification', async () => {
      // Ensure user has verification token
      if (!testUser.email_verification_token) {
        const verification = User.generateEmailVerificationToken();
        const { executeQuery } = require('../config/database');
        await executeQuery(
          'UPDATE Users SET email_verification_token = @token, email_verification_expires = @expires WHERE id = @id',
          {
            id: testUser.id,
            token: verification.token,
            expires: verification.expires
          }
        );
        testUser.email_verification_token = verification.token;
      }

      const result = await emailService.sendEmailVerification(testUser);
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(['console', 'smtp']).toContain(result.mode);
      
      if (result.mode === 'smtp') {
        expect(result.messageId).toBeDefined();
      }
    });

    test('should send password reset email', async () => {
      const resetToken = 'test-reset-token-123456';
      const result = await emailService.sendPasswordReset(testUser, resetToken);
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(['console', 'smtp']).toContain(result.mode);
    });

    test('should send welcome email', async () => {
      const result = await emailService.sendWelcomeEmail(testUser);
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(['console', 'smtp']).toContain(result.mode);
    });

    test('should send test email in development', async () => {
      // Only run this test in non-production environment
      if (process.env.NODE_ENV !== 'production') {
        const result = await emailService.sendTestEmail('test@example.com', 'Test Subject');
        
        expect(result).toBeDefined();
        expect(result.success).toBe(true);
        expect(['console', 'smtp']).toContain(result.mode);
      }
    });
  });

  describe('Email Verification Flow', () => {
    test('should resend email verification', async () => {
      // Ensure user is not verified
      if (testUser.email_verified) {
        const { executeQuery } = require('../config/database');
        await executeQuery(
          'UPDATE Users SET email_verified = 0 WHERE id = @id',
          { id: testUser.id }
        );
      }

      const result = await emailService.resendEmailVerification(testUser.id);
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.message).toContain('sent successfully');
    });

    test('should handle resend for already verified user', async () => {
      // Verify the user first
      if (!testUser.email_verified) {
        const { executeQuery } = require('../config/database');
        await executeQuery(
          'UPDATE Users SET email_verified = 1 WHERE id = @id',
          { id: testUser.id }
        );
      }

      await expect(emailService.resendEmailVerification(testUser.id))
        .rejects.toThrow('Email is already verified');
    });

    test('should handle resend for non-existent user', async () => {
      await expect(emailService.resendEmailVerification(999999))
        .rejects.toThrow('User not found');
    });

    test('should generate new token for expired verification', async () => {
      // Set expired verification token
      const { executeQuery } = require('../config/database');
      await executeQuery(
        `UPDATE Users 
         SET email_verified = 0, 
             email_verification_token = 'expired-token', 
             email_verification_expires = DATEADD(hour, -1, GETUTCDATE())
         WHERE id = @id`,
        { id: testUser.id }
      );

      const result = await emailService.resendEmailVerification(testUser.id);
      
      expect(result.success).toBe(true);
      
      // Verify new token was generated
      const updatedUser = await User.findById(testUser.id);
      expect(updatedUser.email_verification_token).not.toBe('expired-token');
      expect(new Date(updatedUser.email_verification_expires)).toBeInstanceOf(Date);
      expect(new Date(updatedUser.email_verification_expires).getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('Email Template Customization', () => {
    test('should handle different frontend URLs in templates', () => {
      // Test with custom frontend URL
      const customEmailService = new EmailService();
      customEmailService.frontendUrl = 'https://custom.taktmate.com';
      
      const verificationUrl = `${customEmailService.frontendUrl}/auth/verify-email?token=test123`;
      const html = customEmailService.generateEmailVerificationHTML(testUser, verificationUrl);
      
      expect(html).toContain('https://custom.taktmate.com');
    });

    test('should include user information in templates', () => {
      const userWithCompany = {
        ...testUser,
        name: 'John Doe',
        company: 'TaktMate Inc',
        role: 'Data Analyst'
      };
      
      const verificationUrl = 'https://app.taktconnect.com/auth/verify-email?token=test123';
      const html = emailService.generateEmailVerificationHTML(userWithCompany, verificationUrl);
      
      expect(html).toContain('John Doe');
      expect(html).toContain(verificationUrl);
    });

    test('should handle missing optional user fields gracefully', () => {
      const minimalUser = {
        id: 1,
        name: 'Minimal User',
        email: 'minimal@test.com',
        company: null,
        role: null
      };
      
      const verificationUrl = 'https://app.taktconnect.com/auth/verify-email?token=test123';
      const html = emailService.generateEmailVerificationHTML(minimalUser, verificationUrl);
      
      expect(html).toContain('Minimal User');
      expect(html).toContain(verificationUrl);
      expect(html).not.toContain('null');
      expect(html).not.toContain('undefined');
    });
  });

  describe('Error Handling', () => {
    test('should handle email sending errors gracefully', async () => {
      // Create a service with invalid configuration
      const invalidEmailService = new EmailService();
      invalidEmailService.transporter = null;

      await expect(invalidEmailService.sendEmailVerification(testUser))
        .rejects.toThrow();
    });

    test('should handle missing verification token', async () => {
      const userWithoutToken = {
        ...testUser,
        email_verification_token: null
      };

      await expect(emailService.sendEmailVerification(userWithoutToken))
        .rejects.toThrow('does not have an email verification token');
    });

    test('should validate email addresses in templates', () => {
      const userWithInvalidEmail = {
        ...testUser,
        email: 'invalid-email'
      };
      
      const verificationUrl = 'https://app.taktconnect.com/auth/verify-email?token=test123';
      
      // Should not throw error but should handle gracefully
      expect(() => {
        emailService.generateEmailVerificationHTML(userWithInvalidEmail, verificationUrl);
      }).not.toThrow();
    });
  });

  describe('Performance and Reliability', () => {
    test('should handle concurrent email sending', async () => {
      const promises = Array(3).fill().map((_, i) => 
        emailService.sendTestEmail(`test${i}@concurrent.test`, `Concurrent Test ${i}`)
      );

      const results = await Promise.all(promises);
      
      expect(results.length).toBe(3);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });

    test('should complete email operations within reasonable time', async () => {
      const startTime = Date.now();
      
      await emailService.sendTestEmail('performance@test.com', 'Performance Test');
      
      const executionTime = Date.now() - startTime;
      expect(executionTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    test('should handle large email content', async () => {
      const largeUser = {
        ...testUser,
        name: 'A'.repeat(100), // Maximum name length
        company: 'B'.repeat(100), // Maximum company length
        role: 'C'.repeat(100) // Maximum role length
      };
      
      const verificationUrl = 'https://app.taktconnect.com/auth/verify-email?token=' + 'x'.repeat(64);
      
      const html = emailService.generateEmailVerificationHTML(largeUser, verificationUrl);
      const text = emailService.generateEmailVerificationText(largeUser, verificationUrl);
      
      expect(html.length).toBeGreaterThan(1000);
      expect(text.length).toBeGreaterThan(500);
      expect(html).toContain(largeUser.name);
      expect(text).toContain(largeUser.name);
    });
  });

  describe('Security Features', () => {
    test('should not expose sensitive information in email templates', () => {
      const sensitiveUser = {
        ...testUser,
        password_hash: 'sensitive-hash-data',
        email_verification_token: 'secret-token-123'
      };
      
      const verificationUrl = 'https://app.taktconnect.com/auth/verify-email?token=public-token-456';
      const html = emailService.generateEmailVerificationHTML(sensitiveUser, verificationUrl);
      
      expect(html).not.toContain('sensitive-hash-data');
      expect(html).not.toContain('secret-token-123');
      expect(html).toContain('public-token-456'); // This should be in the URL
    });

    test('should generate secure verification URLs', () => {
      const token = 'verification-token-123';
      const verificationUrl = `${emailService.frontendUrl}/auth/verify-email?token=${token}`;
      const html = emailService.generateEmailVerificationHTML(testUser, verificationUrl);
      
      expect(html).toContain(verificationUrl);
      expect(verificationUrl).toMatch(/^https?:\/\//); // Should be a valid URL
      expect(verificationUrl).toContain(token);
    });

    test('should handle XSS prevention in email templates', () => {
      const maliciousUser = {
        ...testUser,
        name: '<script>alert("xss")</script>',
        company: '<img src="x" onerror="alert(1)">',
        role: 'javascript:alert(1)'
      };
      
      const verificationUrl = 'https://app.taktconnect.com/auth/verify-email?token=safe123';
      const html = emailService.generateEmailVerificationHTML(maliciousUser, verificationUrl);
      
      // HTML should not contain executable script tags
      expect(html).not.toContain('<script>');
      expect(html).not.toContain('onerror');
      expect(html).not.toContain('javascript:');
      
      // But should contain the escaped/safe content
      expect(html).toContain('&lt;script&gt;' || html.includes(maliciousUser.name));
    });
  });

  describe('Email Service Integration', () => {
    test('should integrate with User model for audit logging', async () => {
      // This test verifies that email sending creates audit log entries
      const initialAuditQuery = 'SELECT COUNT(*) as count FROM AuditLog WHERE action LIKE \'%email%\'';
      const { executeQuery } = require('../config/database');
      const initialCount = await executeQuery(initialAuditQuery);
      
      await emailService.sendEmailVerification(testUser);
      
      const finalCount = await executeQuery(initialAuditQuery);
      expect(finalCount.recordset[0].count).toBeGreaterThan(initialCount.recordset[0].count);
    });

    test('should handle email service configuration validation', () => {
      // Test that email service validates configuration properly
      const originalEnv = process.env.EMAIL_SERVICE;
      
      try {
        // Test with invalid service
        process.env.EMAIL_SERVICE = 'invalid-service';
        const invalidService = new EmailService();
        
        expect(invalidService.transporter).toBeDefined();
        expect(invalidService.transporter.options.streamTransport).toBe(true); // Should fallback to console
        
      } finally {
        // Restore original environment
        process.env.EMAIL_SERVICE = originalEnv;
      }
    });
  });
});
