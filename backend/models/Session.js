const { executeQuery, sql } = require('../config/database');
const crypto = require('crypto');
const User = require('./User');

/**
 * Session model for TaktMate authentication system
 */
class Session {
  constructor(sessionData = {}) {
    this.id = sessionData.id;
    this.session_id = sessionData.session_id;
    this.user_id = sessionData.user_id;
    this.expires_at = sessionData.expires_at;
    this.created_at = sessionData.created_at;
    this.last_accessed = sessionData.last_accessed;
    this.ip_address = sessionData.ip_address;
    this.user_agent = sessionData.user_agent;
    this.is_active = sessionData.is_active !== undefined ? sessionData.is_active : true;
  }

  /**
   * Generate secure session ID
   */
  static generateSessionId() {
    // Generate 32 bytes (256 bits) of random data
    const randomBytes = crypto.randomBytes(32);
    // Create timestamp prefix for uniqueness
    const timestamp = Date.now().toString(36);
    // Combine timestamp and random data
    return `${timestamp}_${randomBytes.toString('hex')}`;
  }

  /**
   * Calculate session expiration time
   * Default: 7 days from now (as specified in PRD)
   */
  static calculateExpiration(days = 7) {
    const expiration = new Date();
    expiration.setDate(expiration.getDate() + days);
    return expiration;
  }

  /**
   * Validate session data
   */
  static validate(sessionData) {
    const errors = [];

    // Validate user_id
    if (!sessionData.user_id || typeof sessionData.user_id !== 'number') {
      errors.push('Valid user ID is required');
    }

    // Validate IP address format (optional but if provided should be valid)
    if (sessionData.ip_address) {
      const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
      const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^::$/;
      
      if (!ipv4Regex.test(sessionData.ip_address) && !ipv6Regex.test(sessionData.ip_address)) {
        errors.push('Invalid IP address format');
      }
    }

    // Validate user agent length
    if (sessionData.user_agent && sessionData.user_agent.length > 500) {
      errors.push('User agent string too long (max 500 characters)');
    }

    // Validate expiration date
    if (sessionData.expires_at && new Date(sessionData.expires_at) <= new Date()) {
      errors.push('Session expiration must be in the future');
    }

    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }

  /**
   * Create a new session
   */
  static async create(userId, options = {}) {
    // Validate user exists
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Generate session data
    const sessionId = Session.generateSessionId();
    const expiresAt = Session.calculateExpiration(options.durationDays || 7);

    const sessionData = {
      session_id: sessionId,
      user_id: userId,
      expires_at: expiresAt,
      ip_address: options.ipAddress || null,
      user_agent: options.userAgent ? options.userAgent.substring(0, 500) : null
    };

    // Validate session data
    const validation = Session.validate(sessionData);
    if (!validation.isValid) {
      throw new Error(`Session validation failed: ${validation.errors.join(', ')}`);
    }

    const query = `
      INSERT INTO Sessions (session_id, user_id, expires_at, ip_address, user_agent)
      OUTPUT INSERTED.*
      VALUES (@session_id, @user_id, @expires_at, @ip_address, @user_agent)
    `;

    try {
      const result = await executeQuery(query, sessionData);
      const newSession = new Session(result.recordset[0]);
      
      // Log session creation
      await User.logAuditEvent(userId, 'session_created', 'Sessions', options.ipAddress, {
        session_id: sessionId,
        expires_at: expiresAt
      });

      return newSession;
    } catch (error) {
      console.error('Error creating session:', error);
      throw error;
    }
  }

  /**
   * Find session by session ID
   */
  static async findBySessionId(sessionId) {
    const query = `
      SELECT * FROM Sessions 
      WHERE session_id = @sessionId 
        AND expires_at > GETUTCDATE() 
        AND is_active = 1
    `;
    
    const result = await executeQuery(query, { sessionId });
    
    if (result.recordset.length === 0) {
      return null;
    }
    
    return new Session(result.recordset[0]);
  }

  /**
   * Find all active sessions for a user
   */
  static async findByUserId(userId) {
    const query = `
      SELECT * FROM Sessions 
      WHERE user_id = @userId 
        AND expires_at > GETUTCDATE() 
        AND is_active = 1
      ORDER BY last_accessed DESC
    `;
    
    const result = await executeQuery(query, { userId });
    
    return result.recordset.map(sessionData => new Session(sessionData));
  }

  /**
   * Validate and refresh session
   */
  async validate() {
    // Check if session is expired
    if (new Date() > new Date(this.expires_at)) {
      await this.invalidate();
      return { valid: false, reason: 'Session expired' };
    }

    // Check if session is active
    if (!this.is_active) {
      return { valid: false, reason: 'Session inactive' };
    }

    // Update last accessed time
    await this.updateLastAccessed();
    
    return { valid: true };
  }

  /**
   * Update last accessed timestamp
   */
  async updateLastAccessed() {
    const query = `
      UPDATE Sessions 
      SET last_accessed = GETUTCDATE() 
      WHERE id = @id
    `;
    
    await executeQuery(query, { id: this.id });
    this.last_accessed = new Date();
  }

  /**
   * Extend session expiration
   */
  async extend(additionalDays = 7) {
    const newExpiration = new Date(this.expires_at);
    newExpiration.setDate(newExpiration.getDate() + additionalDays);

    const query = `
      UPDATE Sessions 
      SET expires_at = @expires_at 
      WHERE id = @id
    `;
    
    await executeQuery(query, { 
      id: this.id, 
      expires_at: newExpiration 
    });
    
    // Log session extension
    await User.logAuditEvent(this.user_id, 'session_extended', 'Sessions', null, {
      session_id: this.session_id,
      new_expires_at: newExpiration
    });
    
    this.expires_at = newExpiration;
  }

  /**
   * Invalidate session (logout)
   */
  async invalidate() {
    const query = `
      UPDATE Sessions 
      SET is_active = 0 
      WHERE id = @id
    `;
    
    await executeQuery(query, { id: this.id });
    
    // Log session invalidation
    await User.logAuditEvent(this.user_id, 'session_invalidated', 'Sessions', null, {
      session_id: this.session_id
    });
    
    this.is_active = false;
  }

  /**
   * Get session with user information
   */
  async getWithUser() {
    const query = `
      SELECT 
        s.*,
        u.name as user_name,
        u.email as user_email,
        u.is_active as user_active
      FROM Sessions s
      INNER JOIN Users u ON s.user_id = u.id
      WHERE s.id = @id
    `;
    
    const result = await executeQuery(query, { id: this.id });
    
    if (result.recordset.length === 0) {
      return null;
    }
    
    const data = result.recordset[0];
    return {
      session: new Session(data),
      user: {
        id: data.user_id,
        name: data.user_name,
        email: data.user_email,
        is_active: data.user_active
      }
    };
  }

  /**
   * Invalidate all sessions for a user
   */
  static async invalidateAllForUser(userId) {
    const query = `
      UPDATE Sessions 
      SET is_active = 0 
      WHERE user_id = @userId AND is_active = 1
    `;
    
    const result = await executeQuery(query, { userId });
    
    // Log mass session invalidation
    await User.logAuditEvent(userId, 'all_sessions_invalidated', 'Sessions', null, {
      invalidated_count: result.rowsAffected[0]
    });
    
    return result.rowsAffected[0];
  }

  /**
   * Clean up expired sessions (maintenance function)
   */
  static async cleanupExpired() {
    const query = `
      DELETE FROM Sessions 
      WHERE expires_at < GETUTCDATE() OR is_active = 0
    `;
    
    const result = await executeQuery(query);
    
    // Log cleanup
    await User.logAuditEvent(null, 'session_cleanup', 'Sessions', null, {
      deleted_count: result.rowsAffected[0]
    });
    
    return result.rowsAffected[0];
  }

  /**
   * Get session statistics
   */
  static async getStatistics() {
    const query = `
      SELECT 
        COUNT(*) as total_sessions,
        COUNT(CASE WHEN expires_at > GETUTCDATE() AND is_active = 1 THEN 1 END) as active_sessions,
        COUNT(CASE WHEN expires_at <= GETUTCDATE() THEN 1 END) as expired_sessions,
        COUNT(CASE WHEN is_active = 0 THEN 1 END) as inactive_sessions,
        COUNT(CASE WHEN created_at > DATEADD(day, -1, GETUTCDATE()) THEN 1 END) as sessions_last_24h,
        COUNT(CASE WHEN last_accessed > DATEADD(hour, -1, GETUTCDATE()) THEN 1 END) as sessions_last_hour
      FROM Sessions
    `;
    
    const result = await executeQuery(query);
    return result.recordset[0];
  }

  /**
   * Get active sessions summary for monitoring
   */
  static async getActiveSessions() {
    const query = `
      SELECT 
        s.session_id,
        s.user_id,
        u.name as user_name,
        u.email as user_email,
        s.created_at,
        s.last_accessed,
        s.expires_at,
        s.ip_address,
        DATEDIFF(MINUTE, s.last_accessed, GETUTCDATE()) as minutes_inactive
      FROM Sessions s
      INNER JOIN Users u ON s.user_id = u.id
      WHERE s.expires_at > GETUTCDATE() 
        AND s.is_active = 1
      ORDER BY s.last_accessed DESC
    `;
    
    const result = await executeQuery(query);
    return result.recordset;
  }

  /**
   * Check for suspicious session activity
   */
  static async detectSuspiciousActivity(userId, ipAddress) {
    // Check for multiple sessions from different IPs in last hour
    const query = `
      SELECT 
        COUNT(DISTINCT ip_address) as unique_ips,
        COUNT(*) as session_count
      FROM Sessions 
      WHERE user_id = @userId 
        AND created_at > DATEADD(hour, -1, GETUTCDATE())
        AND is_active = 1
    `;
    
    const result = await executeQuery(query, { userId });
    const stats = result.recordset[0];
    
    // Flag as suspicious if more than 3 different IPs or more than 10 sessions in last hour
    const isSuspicious = stats.unique_ips > 3 || stats.session_count > 10;
    
    if (isSuspicious) {
      await User.logAuditEvent(userId, 'suspicious_session_activity', 'Sessions', ipAddress, {
        unique_ips: stats.unique_ips,
        session_count: stats.session_count
      });
    }
    
    return {
      suspicious: isSuspicious,
      unique_ips: stats.unique_ips,
      session_count: stats.session_count
    };
  }

  /**
   * Convert to JSON (excluding sensitive data)
   */
  toJSON() {
    return {
      id: this.id,
      session_id: this.session_id, // This is safe to expose as it's already in cookies
      user_id: this.user_id,
      expires_at: this.expires_at,
      created_at: this.created_at,
      last_accessed: this.last_accessed,
      is_active: this.is_active
      // Note: ip_address and user_agent excluded for privacy
    };
  }

  /**
   * Convert to JSON with full details (for admin/debugging)
   */
  toFullJSON() {
    return {
      id: this.id,
      session_id: this.session_id,
      user_id: this.user_id,
      expires_at: this.expires_at,
      created_at: this.created_at,
      last_accessed: this.last_accessed,
      ip_address: this.ip_address,
      user_agent: this.user_agent,
      is_active: this.is_active
    };
  }
}

module.exports = Session;
