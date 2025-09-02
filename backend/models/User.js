const { executeQuery, sql } = require('../config/database');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const validator = require('validator');

/**
 * User model for TaktMate authentication system
 */
class User {
  constructor(userData = {}) {
    this.id = userData.id;
    this.name = userData.name;
    this.company = userData.company;
    this.role = userData.role;
    this.email = userData.email;
    this.password_hash = userData.password_hash;
    this.email_verified = userData.email_verified || false;
    this.email_verification_token = userData.email_verification_token;
    this.email_verification_expires = userData.email_verification_expires;
    this.password_reset_token = userData.password_reset_token;
    this.password_reset_expires = userData.password_reset_expires;
    this.created_at = userData.created_at;
    this.updated_at = userData.updated_at;
    this.last_login = userData.last_login;
    this.is_active = userData.is_active !== undefined ? userData.is_active : true;
  }

  /**
   * Validation rules for user data
   */
  static getValidationRules() {
    return {
      name: {
        required: true,
        minLength: 2,
        maxLength: 100,
        pattern: /^[a-zA-Z\s\-'\.]+$/
      },
      company: {
        required: false,
        maxLength: 100,
        pattern: /^[a-zA-Z0-9\s\-'\.&,]+$/
      },
      role: {
        required: false,
        maxLength: 100,
        pattern: /^[a-zA-Z\s\-'\.]+$/
      },
      email: {
        required: true,
        maxLength: 255
      },
      password: {
        required: true,
        minLength: 8,
        maxLength: 128,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: true
      }
    };
  }

  /**
   * Validate user data
   */
  static validate(userData, isUpdate = false) {
    const errors = [];
    const rules = User.getValidationRules();

    // Validate name
    if (!isUpdate || userData.name !== undefined) {
      if (!userData.name || userData.name.trim() === '') {
        if (rules.name.required) {
          errors.push('Name is required');
        }
      } else {
        const name = userData.name.trim();
        if (name.length < rules.name.minLength) {
          errors.push(`Name must be at least ${rules.name.minLength} characters long`);
        }
        if (name.length > rules.name.maxLength) {
          errors.push(`Name must not exceed ${rules.name.maxLength} characters`);
        }
        if (!rules.name.pattern.test(name)) {
          errors.push('Name contains invalid characters. Only letters, spaces, hyphens, apostrophes, and periods are allowed');
        }
      }
    }

    // Validate company (optional)
    if (userData.company !== undefined && userData.company !== null && userData.company.trim() !== '') {
      const company = userData.company.trim();
      if (company.length > rules.company.maxLength) {
        errors.push(`Company name must not exceed ${rules.company.maxLength} characters`);
      }
      if (!rules.company.pattern.test(company)) {
        errors.push('Company name contains invalid characters');
      }
    }

    // Validate role (optional)
    if (userData.role !== undefined && userData.role !== null && userData.role.trim() !== '') {
      const role = userData.role.trim();
      if (role.length > rules.role.maxLength) {
        errors.push(`Role must not exceed ${rules.role.maxLength} characters`);
      }
      if (!rules.role.pattern.test(role)) {
        errors.push('Role contains invalid characters. Only letters, spaces, hyphens, apostrophes, and periods are allowed');
      }
    }

    // Validate email
    if (!isUpdate || userData.email !== undefined) {
      if (!userData.email || userData.email.trim() === '') {
        if (rules.email.required) {
          errors.push('Email is required');
        }
      } else {
        const email = userData.email.trim().toLowerCase();
        if (email.length > rules.email.maxLength) {
          errors.push(`Email must not exceed ${rules.email.maxLength} characters`);
        }
        if (!validator.isEmail(email)) {
          errors.push('Please provide a valid email address');
        }
      }
    }

    // Validate password (only for new users or password updates)
    if (userData.password !== undefined) {
      if (!userData.password || userData.password === '') {
        if (rules.password.required && !isUpdate) {
          errors.push('Password is required');
        }
      } else {
        const password = userData.password;
        if (password.length < rules.password.minLength) {
          errors.push(`Password must be at least ${rules.password.minLength} characters long`);
        }
        if (password.length > rules.password.maxLength) {
          errors.push(`Password must not exceed ${rules.password.maxLength} characters`);
        }
        if (rules.password.requireUppercase && !/[A-Z]/.test(password)) {
          errors.push('Password must contain at least one uppercase letter');
        }
        if (rules.password.requireLowercase && !/[a-z]/.test(password)) {
          errors.push('Password must contain at least one lowercase letter');
        }
        if (rules.password.requireNumbers && !/\d/.test(password)) {
          errors.push('Password must contain at least one number');
        }
        if (rules.password.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
          errors.push('Password must contain at least one special character');
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }

  /**
   * Hash password using bcrypt
   */
  static async hashPassword(password) {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
  }

  /**
   * Compare password with hash
   */
  static async comparePassword(password, hash) {
    return await bcrypt.compare(password, hash);
  }

  /**
   * Generate email verification token
   */
  static generateEmailVerificationToken() {
    return {
      token: crypto.randomBytes(32).toString('hex'),
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    };
  }

  /**
   * Generate password reset token
   */
  static generatePasswordResetToken() {
    return {
      token: crypto.randomBytes(32).toString('hex'),
      expires: new Date(Date.now() + 1 * 60 * 60 * 1000) // 1 hour
    };
  }

  /**
   * Create a new user
   */
  static async create(userData) {
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

    // Hash password if provided
    let passwordHash = null;
    if (userData.password) {
      passwordHash = await User.hashPassword(userData.password);
    }

    // Generate email verification token
    const emailVerification = User.generateEmailVerificationToken();

    // Prepare user data
    const cleanUserData = {
      name: userData.name.trim(),
      company: userData.company ? userData.company.trim() : null,
      role: userData.role ? userData.role.trim() : null,
      email: userData.email.trim().toLowerCase(),
      password_hash: passwordHash,
      email_verification_token: emailVerification.token,
      email_verification_expires: emailVerification.expires
    };

    const query = `
      INSERT INTO Users (name, company, role, email, password_hash, email_verification_token, email_verification_expires)
      OUTPUT INSERTED.*
      VALUES (@name, @company, @role, @email, @password_hash, @email_verification_token, @email_verification_expires)
    `;

    try {
      const result = await executeQuery(query, cleanUserData);
      const newUser = new User(result.recordset[0]);
      
      // Log user creation
      await User.logAuditEvent(newUser.id, 'user_created', 'Users', null, {
        email: newUser.email,
        name: newUser.name
      });

      return newUser;
    } catch (error) {
      if (error.message.includes('UNIQUE KEY constraint')) {
        throw new Error('User with this email already exists');
      }
      throw error;
    }
  }

  /**
   * Find user by ID
   */
  static async findById(id) {
    const query = 'SELECT * FROM Users WHERE id = @id AND is_active = 1';
    const result = await executeQuery(query, { id });
    
    if (result.recordset.length === 0) {
      return null;
    }
    
    return new User(result.recordset[0]);
  }

  /**
   * Find user by email
   */
  static async findByEmail(email) {
    const query = 'SELECT * FROM Users WHERE email = @email AND is_active = 1';
    const result = await executeQuery(query, { email: email.toLowerCase() });
    
    if (result.recordset.length === 0) {
      return null;
    }
    
    return new User(result.recordset[0]);
  }

  /**
   * Find user by email verification token
   */
  static async findByEmailVerificationToken(token) {
    const query = `
      SELECT * FROM Users 
      WHERE email_verification_token = @token 
        AND email_verification_expires > GETUTCDATE()
        AND is_active = 1
    `;
    const result = await executeQuery(query, { token });
    
    if (result.recordset.length === 0) {
      return null;
    }
    
    return new User(result.recordset[0]);
  }

  /**
   * Find user by password reset token
   */
  static async findByPasswordResetToken(token) {
    const query = `
      SELECT * FROM Users 
      WHERE password_reset_token = @token 
        AND password_reset_expires > GETUTCDATE()
        AND is_active = 1
    `;
    const result = await executeQuery(query, { token });
    
    if (result.recordset.length === 0) {
      return null;
    }
    
    return new User(result.recordset[0]);
  }

  /**
   * Update user data
   */
  async update(updateData) {
    // Validate update data
    const validation = User.validate(updateData, true);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    const updateFields = [];
    const parameters = { id: this.id };

    // Build dynamic update query
    if (updateData.name !== undefined) {
      updateFields.push('name = @name');
      parameters.name = updateData.name.trim();
    }
    if (updateData.company !== undefined) {
      updateFields.push('company = @company');
      parameters.company = updateData.company ? updateData.company.trim() : null;
    }
    if (updateData.role !== undefined) {
      updateFields.push('role = @role');
      parameters.role = updateData.role ? updateData.role.trim() : null;
    }
    if (updateData.email !== undefined) {
      // Check if new email already exists
      if (updateData.email.toLowerCase() !== this.email.toLowerCase()) {
        const existingUser = await User.findByEmail(updateData.email);
        if (existingUser) {
          throw new Error('User with this email already exists');
        }
      }
      updateFields.push('email = @email');
      parameters.email = updateData.email.trim().toLowerCase();
    }

    if (updateFields.length === 0) {
      return this; // No changes to make
    }

    const query = `
      UPDATE Users 
      SET ${updateFields.join(', ')}
      OUTPUT INSERTED.*
      WHERE id = @id
    `;

    try {
      const result = await executeQuery(query, parameters);
      const updatedUser = new User(result.recordset[0]);
      
      // Log user update
      await User.logAuditEvent(this.id, 'user_updated', 'Users', null, {
        updated_fields: Object.keys(updateData)
      });

      return updatedUser;
    } catch (error) {
      if (error.message.includes('UNIQUE KEY constraint')) {
        throw new Error('User with this email already exists');
      }
      throw error;
    }
  }

  /**
   * Verify email address
   */
  async verifyEmail(token) {
    if (this.email_verification_token !== token) {
      throw new Error('Invalid verification token');
    }
    
    if (new Date() > new Date(this.email_verification_expires)) {
      throw new Error('Verification token has expired');
    }

    const query = `
      UPDATE Users 
      SET email_verified = 1, 
          email_verification_token = NULL, 
          email_verification_expires = NULL
      WHERE id = @id
    `;
    
    await executeQuery(query, { id: this.id });
    
    // Log email verification
    await User.logAuditEvent(this.id, 'email_verified', 'Users');
    
    this.email_verified = true;
    this.email_verification_token = null;
    this.email_verification_expires = null;
  }

  /**
   * Update password
   */
  async updatePassword(newPassword) {
    // Validate password
    const validation = User.validate({ password: newPassword });
    if (!validation.isValid) {
      throw new Error(`Password validation failed: ${validation.errors.join(', ')}`);
    }

    const passwordHash = await User.hashPassword(newPassword);
    
    const query = `
      UPDATE Users 
      SET password_hash = @password_hash,
          password_reset_token = NULL,
          password_reset_expires = NULL
      WHERE id = @id
    `;
    
    await executeQuery(query, { 
      id: this.id, 
      password_hash: passwordHash 
    });
    
    // Log password change
    await User.logAuditEvent(this.id, 'password_changed', 'Users');
    
    this.password_hash = passwordHash;
    this.password_reset_token = null;
    this.password_reset_expires = null;
  }

  /**
   * Set password reset token
   */
  async setPasswordResetToken() {
    const resetToken = User.generatePasswordResetToken();
    
    const query = `
      UPDATE Users 
      SET password_reset_token = @token,
          password_reset_expires = @expires
      WHERE id = @id
    `;
    
    await executeQuery(query, {
      id: this.id,
      token: resetToken.token,
      expires: resetToken.expires
    });
    
    // Log password reset request
    await User.logAuditEvent(this.id, 'password_reset_requested', 'Users');
    
    this.password_reset_token = resetToken.token;
    this.password_reset_expires = resetToken.expires;
    
    return resetToken.token;
  }

  /**
   * Update last login timestamp
   */
  async updateLastLogin() {
    const query = 'UPDATE Users SET last_login = GETUTCDATE() WHERE id = @id';
    await executeQuery(query, { id: this.id });
    
    // Log login
    await User.logAuditEvent(this.id, 'login', 'Users');
    
    this.last_login = new Date();
  }

  /**
   * Deactivate user account (soft delete)
   */
  async deactivate() {
    const query = 'UPDATE Users SET is_active = 0 WHERE id = @id';
    await executeQuery(query, { id: this.id });
    
    // Log deactivation
    await User.logAuditEvent(this.id, 'user_deactivated', 'Users');
    
    this.is_active = false;
  }

  /**
   * Get user data for export (GDPR compliance)
   */
  async getExportData() {
    const userData = {
      id: this.id,
      name: this.name,
      company: this.company,
      role: this.role,
      email: this.email,
      email_verified: this.email_verified,
      created_at: this.created_at,
      updated_at: this.updated_at,
      last_login: this.last_login
    };

    // Get associated data
    const sessionsQuery = 'SELECT session_id, created_at, last_accessed, ip_address FROM Sessions WHERE user_id = @userId';
    const sessionsResult = await executeQuery(sessionsQuery, { userId: this.id });
    
    const auditQuery = 'SELECT action, resource, created_at FROM AuditLog WHERE user_id = @userId ORDER BY created_at DESC';
    const auditResult = await executeQuery(auditQuery, { userId: this.id });
    
    return {
      user: userData,
      sessions: sessionsResult.recordset,
      audit_log: auditResult.recordset
    };
  }

  /**
   * Log audit event
   */
  static async logAuditEvent(userId, action, resource, ipAddress = null, details = null) {
    const query = `
      INSERT INTO AuditLog (user_id, action, resource, ip_address, details)
      VALUES (@userId, @action, @resource, @ipAddress, @details)
    `;
    
    await executeQuery(query, {
      userId,
      action,
      resource,
      ipAddress,
      details: details ? JSON.stringify(details) : null
    });
  }

  /**
   * Convert to JSON (excluding sensitive data)
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      company: this.company,
      role: this.role,
      email: this.email,
      email_verified: this.email_verified,
      created_at: this.created_at,
      updated_at: this.updated_at,
      last_login: this.last_login,
      is_active: this.is_active
    };
  }
}

module.exports = User;
