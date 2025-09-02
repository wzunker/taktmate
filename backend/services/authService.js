const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const User = require('../models/User');
const Session = require('../models/Session');
const SecurityUtils = require('../utils/security');

/**
 * Authentication service for TaktMate
 * Handles JWT tokens, password hashing, and authentication flows
 */
class AuthService {
  constructor() {
    this.jwtSecret = process.env.JWT_SECRET;
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '7d';
    this.sessionSecret = process.env.SESSION_SECRET;
    
    if (!this.jwtSecret) {
      throw new Error('JWT_SECRET environment variable is required');
    }
    
    if (!this.sessionSecret) {
      throw new Error('SESSION_SECRET environment variable is required');
    }
  }

  /**
   * Generate JWT token for user
   */
  generateJWT(user) {
    const payload = SecurityUtils.createJWTPayload(user);

    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.jwtExpiresIn,
      issuer: 'taktmate',
      audience: 'taktmate-users'
    });
  }

  /**
   * Verify JWT token
   */
  verifyJWT(token) {
    try {
      return jwt.verify(token, this.jwtSecret, {
        issuer: 'taktmate',
        audience: 'taktmate-users'
      });
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Token expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid token');
      } else {
        throw error;
      }
    }
  }

  /**
   * Hash password using bcrypt
   */
  async hashPassword(password) {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
  }

  /**
   * Compare password with hash
   */
  async comparePassword(password, hash) {
    return await bcrypt.compare(password, hash);
  }

  /**
   * Generate secure random token
   */
  generateSecureToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Register new user with email/password
   */
  async registerUser(userData, options = {}) {
    try {
      // Validate input data
      const validation = User.validate(userData);
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      // Check if user already exists
      const existingUser = await User.findByEmail(userData.email);
      if (existingUser) {
        throw new Error('User with this email already exists');
      }

      // Create user
      const user = await User.create(userData);

      // Log registration
      await User.logAuditEvent(user.id, 'user_registered', 'Users', options.ipAddress, {
        email: user.email,
        name: user.name,
        registration_method: 'email_password'
      });

      return {
        user,
        token: this.generateJWT(user),
        requiresEmailVerification: !user.email_verified
      };

    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  }

  /**
   * Authenticate user with email/password
   */
  async authenticateUser(email, password, options = {}) {
    try {
      // Find user by email
      const user = await User.findByEmail(email);
      if (!user) {
        // Log failed attempt
        await User.logAuditEvent(null, 'login_failed', 'Users', options.ipAddress, {
          email: email,
          reason: 'user_not_found'
        });
        throw new Error('Invalid email or password');
      }

      // Check if account is active
      if (!user.is_active) {
        await User.logAuditEvent(user.id, 'login_failed', 'Users', options.ipAddress, {
          email: email,
          reason: 'account_deactivated'
        });
        throw new Error('Account is deactivated. Please contact support.');
      }

      // Check if user has a password (might be OAuth-only user)
      if (!user.password_hash) {
        await User.logAuditEvent(user.id, 'login_failed', 'Users', options.ipAddress, {
          email: email,
          reason: 'no_password_set'
        });
        throw new Error('This account uses social login. Please sign in with Google or Microsoft.');
      }

      // Check for suspicious activity before password verification
      const suspiciousActivity = await Session.detectSuspiciousActivity(user.id, options.ipAddress);
      if (suspiciousActivity.suspicious) {
        await User.logAuditEvent(user.id, 'suspicious_login_attempt', 'Users', options.ipAddress, {
          email: email,
          suspicious_indicators: suspiciousActivity
        });
        
        // For now, just log but allow login - in production might want to require additional verification
        console.warn(`⚠️  Suspicious login activity detected for user ${user.id}`);
      }

      // Verify password
      const isValidPassword = await this.comparePassword(password, user.password_hash);
      if (!isValidPassword) {
        await User.logAuditEvent(user.id, 'login_failed', 'Users', options.ipAddress, {
          email: email,
          reason: 'invalid_password'
        });
        throw new Error('Invalid email or password');
      }

      // Update last login
      await user.updateLastLogin();

      // Create session
      const session = await Session.create(user.id, {
        ipAddress: options.ipAddress,
        userAgent: options.userAgent,
        durationDays: 7
      });

      // Log successful login
      await User.logAuditEvent(user.id, 'login_success', 'Users', options.ipAddress, {
        email: user.email,
        session_id: session.session_id,
        suspicious_activity: suspiciousActivity.suspicious
      });

      return {
        user,
        session,
        token: this.generateJWT(user),
        requiresEmailVerification: !user.email_verified,
        suspiciousActivity: suspiciousActivity.suspicious
      };

    } catch (error) {
      console.error('Authentication error:', error);
      throw error;
    }
  }

  /**
   * Verify email with token
   */
  async verifyEmail(token, options = {}) {
    try {
      // Find user by verification token
      const user = await User.findByEmailVerificationToken(token);
      if (!user) {
        throw new Error('Invalid or expired verification token');
      }

      // Verify email
      await user.verifyEmail(token);

      // Log email verification
      await User.logAuditEvent(user.id, 'email_verified', 'Users', options.ipAddress, {
        email: user.email
      });

      return {
        user,
        token: this.generateJWT(user) // Generate new token with updated email_verified status
      };

    } catch (error) {
      console.error('Email verification error:', error);
      throw error;
    }
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email, options = {}) {
    try {
      const user = await User.findByEmail(email);
      if (!user) {
        // Don't reveal if user exists, but log the attempt
        await User.logAuditEvent(null, 'password_reset_requested', 'Users', options.ipAddress, {
          email: email,
          result: 'user_not_found'
        });
        // Still return success to prevent email enumeration
        return { success: true, message: 'If an account with that email exists, a password reset link has been sent.' };
      }

      // Generate password reset token
      const resetToken = await user.setPasswordResetToken();

      // Log password reset request
      await User.logAuditEvent(user.id, 'password_reset_requested', 'Users', options.ipAddress, {
        email: user.email
      });

      return {
        success: true,
        resetToken, // This would be sent via email in a real implementation
        message: 'Password reset link has been sent to your email.'
      };

    } catch (error) {
      console.error('Password reset request error:', error);
      throw error;
    }
  }

  /**
   * Reset password with token
   */
  async resetPassword(token, newPassword, options = {}) {
    try {
      // Find user by reset token
      const user = await User.findByPasswordResetToken(token);
      if (!user) {
        throw new Error('Invalid or expired password reset token');
      }

      // Update password
      await user.updatePassword(newPassword);

      // Invalidate all existing sessions for security
      await Session.invalidateAllForUser(user.id);

      // Log password reset
      await User.logAuditEvent(user.id, 'password_reset_completed', 'Users', options.ipAddress, {
        email: user.email
      });

      return {
        user,
        token: this.generateJWT(user),
        message: 'Password has been reset successfully. Please log in with your new password.'
      };

    } catch (error) {
      console.error('Password reset error:', error);
      throw error;
    }
  }

  /**
   * Refresh JWT token
   */
  async refreshToken(oldToken, sessionId, options = {}) {
    try {
      // Verify old token (even if expired, we can still extract user info)
      let payload;
      try {
        payload = this.verifyJWT(oldToken);
      } catch (error) {
        if (error.message !== 'Token expired') {
          throw new Error('Invalid token');
        }
        // For expired tokens, decode without verification to get user info
        payload = jwt.decode(oldToken);
        if (!payload) {
          throw new Error('Invalid token');
        }
      }

      // Validate session
      const session = await Session.findBySessionId(sessionId);
      if (!session || session.user_id !== payload.userId) {
        throw new Error('Invalid session');
      }

      const sessionValidation = await session.validate();
      if (!sessionValidation.valid) {
        throw new Error(`Session invalid: ${sessionValidation.reason}`);
      }

      // Get current user data
      const user = await User.findById(payload.userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Generate new token
      const newToken = this.generateJWT(user);

      // Log token refresh
      await User.logAuditEvent(user.id, 'token_refreshed', 'Users', options.ipAddress, {
        session_id: sessionId
      });

      return {
        user,
        token: newToken,
        session
      };

    } catch (error) {
      console.error('Token refresh error:', error);
      throw error;
    }
  }

  /**
   * Logout user (invalidate session)
   */
  async logout(sessionId, options = {}) {
    try {
      const session = await Session.findBySessionId(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      // Invalidate session
      await session.invalidate();

      // Log logout
      await User.logAuditEvent(session.user_id, 'logout', 'Users', options.ipAddress, {
        session_id: sessionId
      });

      return { success: true, message: 'Logged out successfully' };

    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  }

  /**
   * Logout from all devices (invalidate all sessions)
   */
  async logoutAll(userId, options = {}) {
    try {
      const invalidatedCount = await Session.invalidateAllForUser(userId);

      // Log logout from all devices
      await User.logAuditEvent(userId, 'logout_all_devices', 'Users', options.ipAddress, {
        invalidated_sessions: invalidatedCount
      });

      return { 
        success: true, 
        message: `Logged out from ${invalidatedCount} devices successfully` 
      };

    } catch (error) {
      console.error('Logout all error:', error);
      throw error;
    }
  }

  /**
   * Validate session and return user info
   */
  async validateSession(sessionId, options = {}) {
    try {
      const session = await Session.findBySessionId(sessionId);
      if (!session) {
        return { valid: false, reason: 'Session not found' };
      }

      const validation = await session.validate();
      if (!validation.valid) {
        return validation;
      }

      const user = await User.findById(session.user_id);
      if (!user) {
        return { valid: false, reason: 'User not found' };
      }

      return {
        valid: true,
        user,
        session
      };

    } catch (error) {
      console.error('Session validation error:', error);
      return { valid: false, reason: 'Validation error' };
    }
  }

  /**
   * Get user profile with session info
   */
  async getUserProfile(userId, sessionId = null) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const profile = {
        id: user.id,
        name: user.name,
        company: user.company,
        role: user.role,
        email: user.email,
        email_verified: user.email_verified,
        created_at: user.created_at,
        last_login: user.last_login
      };

      // Add session info if session ID provided
      if (sessionId) {
        const session = await Session.findBySessionId(sessionId);
        if (session && session.user_id === userId) {
          profile.current_session = {
            id: session.session_id,
            created_at: session.created_at,
            last_accessed: session.last_accessed,
            expires_at: session.expires_at,
            ip_address: session.ip_address
          };
        }
      }

      // Get active sessions count
      const activeSessions = await Session.findByUserId(userId);
      profile.active_sessions_count = activeSessions.length;

      return profile;

    } catch (error) {
      console.error('Get user profile error:', error);
      throw error;
    }
  }

  /**
   * Generate session configuration for Express
   */
  getSessionConfig() {
    return {
      secret: this.sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === 'production', // HTTPS only in production
        httpOnly: true, // Prevent XSS
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        sameSite: 'strict' // CSRF protection
      },
      name: 'taktmate.sid' // Custom session name
    };
  }
}

module.exports = AuthService;
