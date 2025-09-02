const crypto = require('crypto');
const User = require('../models/User');

/**
 * Security utilities for TaktMate authentication system
 */
class SecurityUtils {
  
  /**
   * Generate cryptographically secure random string
   */
  static generateSecureToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Generate secure session ID with timestamp
   */
  static generateSecureSessionId() {
    const timestamp = Date.now().toString(36);
    const randomBytes = crypto.randomBytes(32).toString('hex');
    return `${timestamp}_${randomBytes}`;
  }

  /**
   * Validate password strength
   */
  static validatePasswordStrength(password) {
    const minLength = 8;
    const maxLength = 128;
    
    const checks = {
      length: password.length >= minLength && password.length <= maxLength,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      numbers: /\d/.test(password),
      specialChars: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
      noCommonPatterns: !this.containsCommonPatterns(password)
    };
    
    const score = Object.values(checks).filter(Boolean).length;
    const isValid = Object.values(checks).every(Boolean);
    
    return {
      isValid,
      score,
      checks,
      strength: this.calculatePasswordStrength(score),
      suggestions: this.getPasswordSuggestions(checks)
    };
  }

  /**
   * Check for common password patterns
   */
  static containsCommonPatterns(password) {
    const commonPatterns = [
      /password/i,
      /123456/,
      /qwerty/i,
      /admin/i,
      /login/i,
      /welcome/i,
      /^(.)\1{3,}$/, // Repeated characters
      /^(012|123|234|345|456|567|678|789|890)+/,
      /^(abc|def|ghi|jkl|mno|pqr|stu|vwx|xyz)+/i
    ];
    
    return commonPatterns.some(pattern => pattern.test(password));
  }

  /**
   * Calculate password strength score
   */
  static calculatePasswordStrength(score) {
    if (score <= 2) return 'very_weak';
    if (score <= 3) return 'weak';
    if (score <= 4) return 'fair';
    if (score <= 5) return 'good';
    return 'excellent';
  }

  /**
   * Get password improvement suggestions
   */
  static getPasswordSuggestions(checks) {
    const suggestions = [];
    
    if (!checks.length) {
      suggestions.push('Password must be 8-128 characters long');
    }
    if (!checks.uppercase) {
      suggestions.push('Add at least one uppercase letter');
    }
    if (!checks.lowercase) {
      suggestions.push('Add at least one lowercase letter');
    }
    if (!checks.numbers) {
      suggestions.push('Add at least one number');
    }
    if (!checks.specialChars) {
      suggestions.push('Add at least one special character (!@#$%^&*...)');
    }
    if (!checks.noCommonPatterns) {
      suggestions.push('Avoid common patterns like "password", "123456", or "qwerty"');
    }
    
    return suggestions;
  }

  /**
   * Detect potential brute force attempts
   */
  static async detectBruteForceAttempt(email, ipAddress, timeWindowMinutes = 15) {
    try {
      const { executeQuery } = require('../config/database');
      
      const query = `
        SELECT COUNT(*) as failed_attempts
        FROM AuditLog 
        WHERE action = 'login_failed'
          AND (details LIKE '%"email":"${email}"%' OR ip_address = @ipAddress)
          AND created_at > DATEADD(minute, -@timeWindow, GETUTCDATE())
      `;
      
      const result = await executeQuery(query, {
        ipAddress,
        timeWindow: timeWindowMinutes
      });
      
      const failedAttempts = result.recordset[0].failed_attempts;
      const threshold = 5; // Maximum failed attempts
      
      return {
        isBruteForce: failedAttempts >= threshold,
        failedAttempts,
        threshold,
        timeWindowMinutes
      };
      
    } catch (error) {
      console.error('Brute force detection error:', error);
      return {
        isBruteForce: false,
        error: error.message
      };
    }
  }

  /**
   * Analyze login attempt patterns
   */
  static async analyzeLoginPattern(userId, ipAddress) {
    try {
      const { executeQuery } = require('../config/database');
      
      // Get recent login attempts for this user
      const recentLoginsQuery = `
        SELECT 
          action,
          ip_address,
          created_at,
          details
        FROM AuditLog 
        WHERE user_id = @userId 
          AND action IN ('login_success', 'login_failed')
          AND created_at > DATEADD(day, -7, GETUTCDATE())
        ORDER BY created_at DESC
      `;
      
      const result = await executeQuery(recentLoginsQuery, { userId });
      const recentLogins = result.recordset;
      
      // Analyze patterns
      const analysis = {
        totalAttempts: recentLogins.length,
        successfulLogins: recentLogins.filter(l => l.action === 'login_success').length,
        failedLogins: recentLogins.filter(l => l.action === 'login_failed').length,
        uniqueIPs: new Set(recentLogins.map(l => l.ip_address).filter(ip => ip)).size,
        currentIP: ipAddress,
        isNewIP: !recentLogins.some(l => l.ip_address === ipAddress),
        lastSuccessfulLogin: recentLogins.find(l => l.action === 'login_success')?.created_at,
        recentFailedAttempts: recentLogins.filter(l => 
          l.action === 'login_failed' && 
          new Date(l.created_at) > new Date(Date.now() - 60 * 60 * 1000) // Last hour
        ).length
      };
      
      // Determine risk level
      analysis.riskLevel = this.calculateRiskLevel(analysis);
      
      return analysis;
      
    } catch (error) {
      console.error('Login pattern analysis error:', error);
      return {
        error: error.message,
        riskLevel: 'unknown'
      };
    }
  }

  /**
   * Calculate login risk level
   */
  static calculateRiskLevel(analysis) {
    let riskScore = 0;
    
    // High number of recent failed attempts
    if (analysis.recentFailedAttempts > 3) {
      riskScore += 3;
    }
    
    // New IP address
    if (analysis.isNewIP) {
      riskScore += 2;
    }
    
    // High number of unique IPs
    if (analysis.uniqueIPs > 5) {
      riskScore += 2;
    }
    
    // Low success rate
    if (analysis.totalAttempts > 0) {
      const successRate = analysis.successfulLogins / analysis.totalAttempts;
      if (successRate < 0.5) {
        riskScore += 2;
      }
    }
    
    // Determine risk level
    if (riskScore >= 6) return 'high';
    if (riskScore >= 4) return 'medium';
    if (riskScore >= 2) return 'low';
    return 'minimal';
  }

  /**
   * Sanitize user input to prevent injection attacks
   */
  static sanitizeInput(input) {
    if (typeof input !== 'string') {
      return input;
    }
    
    return input
      .trim()
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
      .replace(/javascript:/gi, '') // Remove javascript: URLs
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .replace(/&lt;script/gi, '') // Remove escaped script tags
      .replace(/&#x3C;script/gi, ''); // Remove hex encoded script tags
  }

  /**
   * Validate email format with additional security checks
   */
  static validateEmailSecurity(email) {
    const validator = require('validator');
    
    // Basic email validation
    if (!validator.isEmail(email)) {
      return {
        isValid: false,
        reason: 'Invalid email format'
      };
    }
    
    // Check for suspicious patterns
    const suspiciousPatterns = [
      /\+.*\+/, // Multiple plus signs
      /\.{2,}/, // Multiple consecutive dots
      /@.*@/, // Multiple @ symbols
      /[<>]/, // HTML brackets
      /javascript:/i, // JavaScript URLs
      /data:/i, // Data URLs
    ];
    
    const hasSuspiciousPattern = suspiciousPatterns.some(pattern => pattern.test(email));
    
    if (hasSuspiciousPattern) {
      return {
        isValid: false,
        reason: 'Email contains suspicious patterns'
      };
    }
    
    // Check email length
    if (email.length > 255) {
      return {
        isValid: false,
        reason: 'Email address too long'
      };
    }
    
    return {
      isValid: true,
      normalized: email.toLowerCase().trim()
    };
  }

  /**
   * Generate secure JWT payload
   */
  static createJWTPayload(user) {
    return {
      userId: user.id,
      email: user.email,
      name: user.name,
      emailVerified: user.email_verified,
      iat: Math.floor(Date.now() / 1000), // Issued at
      jti: this.generateSecureToken(16) // JWT ID for revocation tracking
    };
  }

  /**
   * Validate client information for security analysis
   */
  static analyzeClientInfo(req) {
    const clientInfo = {
      ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown',
      origin: req.get('Origin') || req.get('Referer') || 'unknown',
      acceptLanguage: req.get('Accept-Language') || 'unknown',
      acceptEncoding: req.get('Accept-Encoding') || 'unknown'
    };
    
    // Basic security analysis
    const analysis = {
      ...clientInfo,
      suspicious: false,
      suspiciousReasons: []
    };
    
    // Check for suspicious user agents
    if (clientInfo.userAgent.toLowerCase().includes('bot') || 
        clientInfo.userAgent.toLowerCase().includes('crawler') ||
        clientInfo.userAgent.toLowerCase().includes('spider')) {
      analysis.suspicious = true;
      analysis.suspiciousReasons.push('Bot-like user agent');
    }
    
    // Check for missing user agent
    if (clientInfo.userAgent === 'unknown' || clientInfo.userAgent.length < 10) {
      analysis.suspicious = true;
      analysis.suspiciousReasons.push('Missing or suspicious user agent');
    }
    
    // Check for suspicious origins
    if (clientInfo.origin !== 'unknown' && 
        !clientInfo.origin.includes('localhost') && 
        !clientInfo.origin.includes('taktconnect.com')) {
      analysis.suspicious = true;
      analysis.suspiciousReasons.push('Unexpected origin domain');
    }
    
    return analysis;
  }

  /**
   * Create security headers for responses
   */
  static getSecurityHeaders() {
    return {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'"
    };
  }

  /**
   * Log security event
   */
  static async logSecurityEvent(userId, event, details, ipAddress = null) {
    try {
      await User.logAuditEvent(userId, `security_${event}`, 'Security', ipAddress, details);
    } catch (error) {
      console.error('Security event logging error:', error);
    }
  }
}

module.exports = SecurityUtils;
