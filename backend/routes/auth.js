const express = require('express');
const passport = require('passport');
const { 
  authRateLimit, 
  passwordResetRateLimit, 
  emailVerificationRateLimit,
  extractClientInfo,
  authService 
} = require('../middleware/auth');
const EmailService = require('../services/emailService');

const router = express.Router();
const emailService = new EmailService();

/**
 * Authentication routes for TaktMate
 */

/**
 * POST /auth/register
 * Register a new user with email and password
 */
router.post('/register', 
  extractClientInfo,
  authRateLimit,
  async (req, res) => {
    try {
      const { name, company, role, email, password } = req.body;

      // Validate required fields
      if (!name || !email || !password) {
        return res.status(400).json({
          success: false,
          error: 'Name, email, and password are required',
          code: 'MISSING_FIELDS'
        });
      }

      // Register user
      const result = await authService.registerUser({
        name: name.trim(),
        company: company ? company.trim() : null,
        role: role ? role.trim() : null,
        email: email.trim().toLowerCase(),
        password
      }, {
        ipAddress: req.clientInfo.ipAddress,
        userAgent: req.clientInfo.userAgent
      });

      // Set session info
      req.session.userId = result.user.id;
      req.session.token = result.token;

      // Send verification email
      try {
        await emailService.sendEmailVerification(result.user);
        console.log(`📧 Verification email sent to ${result.user.email}`);
      } catch (emailError) {
        console.error('Email sending failed:', emailError);
        // Don't fail registration if email fails - user can resend later
      }

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
          user: {
            id: result.user.id,
            name: result.user.name,
            company: result.user.company,
            role: result.user.role,
            email: result.user.email,
            email_verified: result.user.email_verified,
            created_at: result.user.created_at
          },
          token: result.token,
          requires_email_verification: result.requiresEmailVerification
        }
      });

    } catch (error) {
      console.error('Registration error:', error);
      
      if (error.message.includes('Validation failed')) {
        return res.status(400).json({
          success: false,
          error: error.message,
          code: 'VALIDATION_ERROR'
        });
      }
      
      if (error.message.includes('already exists')) {
        return res.status(409).json({
          success: false,
          error: 'User with this email already exists',
          code: 'USER_EXISTS'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Registration failed',
        code: 'REGISTRATION_ERROR'
      });
    }
  }
);

/**
 * POST /auth/login
 * Login with email and password
 */
router.post('/login',
  extractClientInfo,
  authRateLimit,
  async (req, res) => {
    try {
      const { email, password } = req.body;

      // Validate required fields
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: 'Email and password are required',
          code: 'MISSING_FIELDS'
        });
      }

      // Authenticate user
      const result = await authService.authenticateUser(
        email.trim().toLowerCase(),
        password,
        {
          ipAddress: req.clientInfo.ipAddress,
          userAgent: req.clientInfo.userAgent
        }
      );

      // Set session info
      req.session.userId = result.user.id;
      req.session.token = result.token;
      req.session.sessionId = result.session.session_id;

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: {
            id: result.user.id,
            name: result.user.name,
            company: result.user.company,
            role: result.user.role,
            email: result.user.email,
            email_verified: result.user.email_verified,
            last_login: result.user.last_login
          },
          token: result.token,
          session_id: result.session.session_id,
          expires_at: result.session.expires_at,
          requires_email_verification: result.requiresEmailVerification,
          security: {
            suspicious_activity: result.suspiciousActivity || false,
            session_expires_in_days: 7,
            login_timestamp: new Date().toISOString()
          }
        }
      });

    } catch (error) {
      console.error('Login error:', error);
      
      if (error.message.includes('Invalid email or password')) {
        return res.status(401).json({
          success: false,
          error: 'Invalid email or password',
          code: 'INVALID_CREDENTIALS'
        });
      }
      
      if (error.message.includes('social login')) {
        return res.status(400).json({
          success: false,
          error: error.message,
          code: 'OAUTH_ONLY_ACCOUNT',
          hint: 'Use Google or Microsoft sign-in buttons'
        });
      }
      
      if (error.message.includes('deactivated')) {
        return res.status(403).json({
          success: false,
          error: 'Account is deactivated. Please contact support.',
          code: 'ACCOUNT_DEACTIVATED'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Login failed',
        code: 'LOGIN_ERROR'
      });
    }
  }
);

/**
 * POST /auth/verify-email
 * Verify email address with token
 */
router.post('/verify-email',
  extractClientInfo,
  emailVerificationRateLimit,
  async (req, res) => {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({
          success: false,
          error: 'Verification token is required',
          code: 'MISSING_TOKEN'
        });
      }

      // Verify email
      const result = await authService.verifyEmail(token, {
        ipAddress: req.clientInfo.ipAddress
      });

      // Update session token if user is logged in
      if (req.session.userId === result.user.id) {
        req.session.token = result.token;
      }

      // Send welcome email
      try {
        await emailService.sendWelcomeEmail(result.user);
        console.log(`📧 Welcome email sent to ${result.user.email}`);
      } catch (emailError) {
        console.error('Welcome email sending failed:', emailError);
        // Don't fail verification if welcome email fails
      }

      res.json({
        success: true,
        message: 'Email verified successfully',
        data: {
          user: {
            id: result.user.id,
            name: result.user.name,
            email: result.user.email,
            email_verified: result.user.email_verified
          },
          token: result.token
        }
      });

    } catch (error) {
      console.error('Email verification error:', error);
      
      if (error.message.includes('Invalid or expired')) {
        return res.status(400).json({
          success: false,
          error: 'Invalid or expired verification token',
          code: 'INVALID_TOKEN'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Email verification failed',
        code: 'VERIFICATION_ERROR'
      });
    }
  }
);

/**
 * POST /auth/request-password-reset
 * Request password reset token
 */
router.post('/request-password-reset',
  extractClientInfo,
  passwordResetRateLimit,
  async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          error: 'Email is required',
          code: 'MISSING_EMAIL'
        });
      }

      // Request password reset
      const result = await authService.requestPasswordReset(
        email.trim().toLowerCase(),
        {
          ipAddress: req.clientInfo.ipAddress
        }
      );

      // Send password reset email if user exists and resetToken is provided
      if (result.resetToken) {
        try {
          const User = require('../models/User');
          const user = await User.findByEmail(email.trim().toLowerCase());
          if (user) {
            await emailService.sendPasswordReset(user, result.resetToken);
            console.log(`📧 Password reset email sent to ${user.email}`);
          }
        } catch (emailError) {
          console.error('Password reset email sending failed:', emailError);
          // Don't fail the request if email fails
        }
      }

      res.json({
        success: true,
        message: result.message
      });

    } catch (error) {
      console.error('Password reset request error:', error);
      
      res.status(500).json({
        success: false,
        error: 'Password reset request failed',
        code: 'RESET_REQUEST_ERROR'
      });
    }
  }
);

/**
 * POST /auth/reset-password
 * Reset password with token
 */
router.post('/reset-password',
  extractClientInfo,
  passwordResetRateLimit,
  async (req, res) => {
    try {
      const { token, password } = req.body;

      if (!token || !password) {
        return res.status(400).json({
          success: false,
          error: 'Token and new password are required',
          code: 'MISSING_FIELDS'
        });
      }

      // Reset password
      const result = await authService.resetPassword(token, password, {
        ipAddress: req.clientInfo.ipAddress
      });

      res.json({
        success: true,
        message: result.message,
        data: {
          user: {
            id: result.user.id,
            name: result.user.name,
            email: result.user.email,
            email_verified: result.user.email_verified
          },
          token: result.token
        }
      });

    } catch (error) {
      console.error('Password reset error:', error);
      
      if (error.message.includes('Invalid or expired')) {
        return res.status(400).json({
          success: false,
          error: 'Invalid or expired reset token',
          code: 'INVALID_TOKEN'
        });
      }
      
      if (error.message.includes('Validation failed')) {
        return res.status(400).json({
          success: false,
          error: error.message,
          code: 'VALIDATION_ERROR'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Password reset failed',
        code: 'RESET_ERROR'
      });
    }
  }
);

/**
 * POST /auth/refresh-token
 * Refresh JWT token
 */
router.post('/refresh-token',
  extractClientInfo,
  async (req, res) => {
    try {
      const { token, session_id } = req.body;
      const sessionId = session_id || req.session.sessionId;

      if (!token) {
        return res.status(400).json({
          success: false,
          error: 'Token is required',
          code: 'MISSING_TOKEN'
        });
      }

      if (!sessionId) {
        return res.status(400).json({
          success: false,
          error: 'Session ID is required',
          code: 'MISSING_SESSION_ID'
        });
      }

      // Refresh token
      const result = await authService.refreshToken(token, sessionId, {
        ipAddress: req.clientInfo.ipAddress
      });

      // Update session
      req.session.token = result.token;

      res.json({
        success: true,
        message: 'Token refreshed successfully',
        data: {
          token: result.token,
          user: {
            id: result.user.id,
            name: result.user.name,
            email: result.user.email,
            email_verified: result.user.email_verified
          }
        }
      });

    } catch (error) {
      console.error('Token refresh error:', error);
      
      if (error.message.includes('Invalid token') || error.message.includes('Invalid session')) {
        return res.status(401).json({
          success: false,
          error: error.message,
          code: 'INVALID_TOKEN_OR_SESSION'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Token refresh failed',
        code: 'REFRESH_ERROR'
      });
    }
  }
);

/**
 * POST /auth/logout
 * Logout user (invalidate session)
 */
router.post('/logout',
  extractClientInfo,
  async (req, res) => {
    try {
      const sessionId = req.body.session_id || req.session.sessionId;

      if (sessionId) {
        // Logout from specific session
        await authService.logout(sessionId, {
          ipAddress: req.clientInfo.ipAddress
        });
      }

      // Clear session
      req.session.destroy((err) => {
        if (err) {
          console.error('Session destruction error:', err);
        }
      });

      res.json({
        success: true,
        message: 'Logged out successfully'
      });

    } catch (error) {
      console.error('Logout error:', error);
      
      // Clear session even if logout fails
      req.session.destroy((err) => {
        if (err) {
          console.error('Session destruction error:', err);
        }
      });

      res.json({
        success: true,
        message: 'Logged out successfully'
      });
    }
  }
);

/**
 * POST /auth/logout-all
 * Logout from all devices
 */
router.post('/logout-all',
  extractClientInfo,
  async (req, res) => {
    try {
      const userId = req.body.user_id || req.session.userId;

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: 'User ID is required',
          code: 'MISSING_USER_ID'
        });
      }

      // Logout from all devices
      const result = await authService.logoutAll(userId, {
        ipAddress: req.clientInfo.ipAddress
      });

      // Clear current session
      req.session.destroy((err) => {
        if (err) {
          console.error('Session destruction error:', err);
        }
      });

      res.json({
        success: true,
        message: result.message
      });

    } catch (error) {
      console.error('Logout all error:', error);
      
      res.status(500).json({
        success: false,
        error: 'Logout from all devices failed',
        code: 'LOGOUT_ALL_ERROR'
      });
    }
  }
);

/**
 * GET /auth/me
 * Get current user info
 */
router.get('/me',
  extractClientInfo,
  async (req, res) => {
    try {
      const userId = req.session.userId;
      const sessionId = req.session.sessionId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Not authenticated',
          code: 'NOT_AUTHENTICATED'
        });
      }

      // Get user profile
      const profile = await authService.getUserProfile(userId, sessionId);

      res.json({
        success: true,
        data: profile
      });

    } catch (error) {
      console.error('Get user profile error:', error);
      
      if (error.message.includes('User not found')) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to get user profile',
        code: 'PROFILE_ERROR'
      });
    }
  }
);

/**
 * POST /auth/resend-verification
 * Resend email verification
 */
router.post('/resend-verification',
  extractClientInfo,
  emailVerificationRateLimit,
  async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          error: 'Email is required',
          code: 'MISSING_EMAIL'
        });
      }

      // Resend verification email
      const User = require('../models/User');
      const user = await User.findByEmail(email.trim().toLowerCase());
      
      if (!user) {
        // Don't reveal if user exists, but return success
        return res.json({
          success: true,
          message: 'If an account with that email exists and is unverified, a verification email has been sent.'
        });
      }

      if (user.email_verified) {
        return res.status(400).json({
          success: false,
          error: 'Email is already verified',
          code: 'EMAIL_ALREADY_VERIFIED'
        });
      }

      const result = await emailService.resendEmailVerification(user.id);

      res.json({
        success: true,
        message: 'Verification email sent successfully'
      });

    } catch (error) {
      console.error('Resend verification error:', error);
      
      if (error.message.includes('already verified')) {
        return res.status(400).json({
          success: false,
          error: 'Email is already verified',
          code: 'EMAIL_ALREADY_VERIFIED'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Failed to resend verification email',
        code: 'RESEND_ERROR'
      });
    }
  }
);

/**
 * GET /auth/email-status
 * Check email service status
 */
router.get('/email-status', (req, res) => {
  try {
    const status = emailService.getServiceStatus();
    
    res.json({
      success: true,
      data: {
        email_service: status.service,
        configured: status.configured,
        mode: status.mode,
        from_email: status.fromEmail
      }
    });
  } catch (error) {
    console.error('Email status error:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to get email service status',
      code: 'EMAIL_STATUS_ERROR'
    });
  }
});

/**
 * POST /auth/test-email
 * Send test email (development/admin only)
 */
router.post('/test-email',
  extractClientInfo,
  async (req, res) => {
    try {
      // Only allow in development environment
      if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({
          success: false,
          error: 'Test email endpoint not available in production',
          code: 'NOT_ALLOWED'
        });
      }

      const { email, subject } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          error: 'Email is required',
          code: 'MISSING_EMAIL'
        });
      }

      const result = await emailService.sendTestEmail(email, subject);

      res.json({
        success: true,
        message: 'Test email sent successfully',
        data: result
      });

    } catch (error) {
      console.error('Test email error:', error);
      
      res.status(500).json({
        success: false,
        error: 'Failed to send test email',
        code: 'TEST_EMAIL_ERROR'
      });
    }
  }
);

/**
 * GET /auth/providers
 * Get available OAuth providers
 */
router.get('/providers', (req, res) => {
  const { getOAuthProviders } = require('../config/passport');
  
  try {
    const providers = getOAuthProviders();
    
    res.json({
      success: true,
      data: {
        providers: providers.map(provider => ({
          name: provider.name,
          displayName: provider.displayName,
          configured: provider.configured,
          authUrl: provider.authUrl || null
        }))
      }
    });
  } catch (error) {
    console.error('Get providers error:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to get OAuth providers',
      code: 'PROVIDERS_ERROR'
    });
  }
});

/**
 * GET /auth/google
 * Initiate Google OAuth
 */
router.get('/google',
  extractClientInfo,
  passport.authenticate('google', {
    scope: ['profile', 'email']
  })
);

/**
 * GET /auth/google/callback
 * Google OAuth callback
 */
router.get('/google/callback',
  extractClientInfo,
  passport.authenticate('google', { failureRedirect: '/auth/failure' }),
  (req, res) => {
    try {
      const authResult = req.user;
      
      // Set session info
      req.session.userId = authResult.user.id;
      req.session.token = authResult.token;

      // Redirect to frontend with success
      const redirectUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      res.redirect(`${redirectUrl}/auth/callback?success=true&provider=google&token=${authResult.token}`);
      
    } catch (error) {
      console.error('Google OAuth callback error:', error);
      res.redirect('/auth/failure');
    }
  }
);

/**
 * GET /auth/microsoft
 * Initiate Microsoft OAuth
 */
router.get('/microsoft',
  extractClientInfo,
  passport.authenticate('microsoft', {
    scope: ['user.read']
  })
);

/**
 * GET /auth/microsoft/callback
 * Microsoft OAuth callback
 */
router.get('/microsoft/callback',
  extractClientInfo,
  passport.authenticate('microsoft', { failureRedirect: '/auth/failure' }),
  (req, res) => {
    try {
      const authResult = req.user;
      
      // Set session info
      req.session.userId = authResult.user.id;
      req.session.token = authResult.token;

      // Redirect to frontend with success
      const redirectUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      res.redirect(`${redirectUrl}/auth/callback?success=true&provider=microsoft&token=${authResult.token}`);
      
    } catch (error) {
      console.error('Microsoft OAuth callback error:', error);
      res.redirect('/auth/failure');
    }
  }
);

/**
 * GET /auth/failure
 * OAuth failure redirect
 */
router.get('/failure', (req, res) => {
  const redirectUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  res.redirect(`${redirectUrl}/auth/callback?success=false&error=oauth_failed`);
});

module.exports = router;
