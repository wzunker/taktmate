/**
 * User Service for Azure AD B2C Integration
 * 
 * This service provides comprehensive user management functionality,
 * including profile extraction from Azure AD B2C claims, user data
 * processing, validation, and business logic operations.
 */

const { 
  config,
  extractUserProfile,
  isFeatureEnabled,
  customClaims 
} = require('../config/azureAdB2C');

// Import Application Insights telemetry (optional)
let telemetry = null;
try {
  const appInsights = require('../config/applicationInsights');
  telemetry = appInsights.telemetry;
} catch (error) {
  // Application Insights not configured or available
  if (config.debugAuth) {
    console.log('ℹ️  Application Insights not available for user service telemetry');
  }
}

/**
 * User Service Class
 */
class UserService {
  constructor() {
    this.cache = new Map(); // In-memory user cache
    this.cacheTimeout = config.jwtCacheTtl || 3600000; // 1 hour default
    this.maxCacheSize = 1000; // Maximum cached users
    
    if (config.debugAuth) {
      console.log('🔧 UserService initialized with cache TTL:', this.cacheTimeout);
    }
  }

  /**
   * Extract and process user profile from JWT payload
   * @param {Object} jwtPayload - JWT token payload
   * @param {Object} options - Processing options
   * @returns {Object} Processed user profile
   */
  async processUserFromJWT(jwtPayload, options = {}) {
    const startTime = Date.now();
    
    try {
      if (!jwtPayload) {
        throw new Error('JWT payload is required');
      }

      // Extract basic user profile using Azure AD B2C config
      const baseProfile = extractUserProfile(jwtPayload);
      
      // Enhanced user profile processing
      const userProfile = await this.enhanceUserProfile(baseProfile, jwtPayload, options);
      
      // Validate user profile
      const validationResult = this.validateUserProfile(userProfile);
      if (!validationResult.valid) {
        throw new Error(`User profile validation failed: ${validationResult.errors.join(', ')}`);
      }

      // Cache the user profile
      if (options.cache !== false) {
        this.cacheUserProfile(userProfile);
      }

      const duration = Date.now() - startTime;

      // Track user profile processing
      if (telemetry) {
        telemetry.trackEvent('UserProfileProcessed', {
          userId: userProfile.id,
          email: userProfile.email,
          identityProvider: userProfile.identityProvider,
          hasCompany: !!userProfile.company,
          hasRole: !!userProfile.role,
          cached: options.cache !== false
        }, {
          processingDuration: duration
        });
      }

      if (config.debugAuth) {
        console.log(`✅ User profile processed for ${userProfile.email} in ${duration}ms`);
      }

      return {
        success: true,
        user: userProfile,
        processingDuration: duration
      };

    } catch (error) {
      const duration = Date.now() - startTime;

      // Track user profile processing error
      if (telemetry) {
        telemetry.trackError(error, jwtPayload?.sub, {
          component: 'userService.processUserFromJWT',
          duration: duration,
          jwtIssuer: jwtPayload?.iss,
          jwtAudience: jwtPayload?.aud
        });
      }

      if (config.debugAuth) {
        console.log(`❌ User profile processing failed in ${duration}ms:`, error.message);
      }

      return {
        success: false,
        error: error.message,
        processingDuration: duration
      };
    }
  }

  /**
   * Enhance user profile with additional processing
   * @param {Object} baseProfile - Basic user profile from extractUserProfile
   * @param {Object} jwtPayload - Original JWT payload
   * @param {Object} options - Enhancement options
   * @returns {Object} Enhanced user profile
   */
  async enhanceUserProfile(baseProfile, jwtPayload, options = {}) {
    const enhancedProfile = { ...baseProfile };

    try {
      // Add timestamp information
      enhancedProfile.profileCreatedAt = new Date().toISOString();
      enhancedProfile.lastLoginAt = new Date().toISOString();
      
      // Process authentication information
      if (jwtPayload.auth_time) {
        enhancedProfile.authTime = new Date(jwtPayload.auth_time * 1000).toISOString();
      }
      
      if (jwtPayload.iat) {
        enhancedProfile.tokenIssuedAt = new Date(jwtPayload.iat * 1000).toISOString();
      }
      
      if (jwtPayload.exp) {
        enhancedProfile.tokenExpiresAt = new Date(jwtPayload.exp * 1000).toISOString();
      }

      // Process identity provider information
      enhancedProfile.identityProvider = jwtPayload.idp || 'unknown';
      enhancedProfile.trustFrameworkPolicy = jwtPayload.tfp || jwtPayload.acr;
      
      // Enhanced name processing
      enhancedProfile.displayName = this.processDisplayName(enhancedProfile);
      enhancedProfile.initials = this.generateInitials(enhancedProfile);

      // Process custom attributes with fallbacks
      enhancedProfile.company = this.processCustomAttribute(jwtPayload, 'Company', enhancedProfile.company);
      enhancedProfile.role = this.processCustomAttribute(jwtPayload, 'Role', enhancedProfile.role);
      enhancedProfile.industry = this.processCustomAttribute(jwtPayload, 'Industry', enhancedProfile.industry);
      enhancedProfile.department = this.processCustomAttribute(jwtPayload, 'Department');
      enhancedProfile.jobTitle = jwtPayload.jobTitle || enhancedProfile.role;

      // Process email verification status
      enhancedProfile.emailVerified = this.processEmailVerification(jwtPayload);
      
      // Process multi-factor authentication status
      enhancedProfile.mfaEnabled = this.processMFAStatus(jwtPayload);

      // Generate user permissions and roles
      enhancedProfile.permissions = await this.generateUserPermissions(enhancedProfile, options);
      enhancedProfile.userType = this.determineUserType(enhancedProfile);

      // Add user preferences (with defaults)
      enhancedProfile.preferences = this.getDefaultUserPreferences();

      // Process user metadata
      enhancedProfile.metadata = {
        source: 'azure_ad_b2c',
        version: '1.0',
        lastUpdated: new Date().toISOString(),
        claims: Object.keys(jwtPayload).length,
        customClaims: this.countCustomClaims(jwtPayload)
      };

      if (config.debugAuth) {
        console.log(`🔧 Enhanced user profile for ${enhancedProfile.email}:`, {
          company: enhancedProfile.company,
          role: enhancedProfile.role,
          userType: enhancedProfile.userType,
          emailVerified: enhancedProfile.emailVerified,
          identityProvider: enhancedProfile.identityProvider
        });
      }

      return enhancedProfile;

    } catch (error) {
      console.error('User profile enhancement error:', error);
      
      // Return base profile with error information
      return {
        ...baseProfile,
        enhancementError: error.message,
        profileCreatedAt: new Date().toISOString()
      };
    }
  }

  /**
   * Process custom attribute with multiple fallback strategies
   * @param {Object} jwtPayload - JWT payload
   * @param {string} attributeName - Attribute name (e.g., 'Company', 'Role')
   * @param {string} fallbackValue - Fallback value if not found
   * @returns {string} Processed attribute value
   */
  processCustomAttribute(jwtPayload, attributeName, fallbackValue = null) {
    // Try extension_ prefixed claim (custom policies)
    const extensionClaim = `extension_${attributeName}`;
    if (jwtPayload[extensionClaim]) {
      return jwtPayload[extensionClaim];
    }

    // Try custom claims mapping
    if (customClaims[attributeName.toLowerCase()]) {
      const claimName = customClaims[attributeName.toLowerCase()];
      if (jwtPayload[claimName]) {
        return jwtPayload[claimName];
      }
    }

    // Try direct claim name
    const directClaim = attributeName.toLowerCase();
    if (jwtPayload[directClaim]) {
      return jwtPayload[directClaim];
    }

    // Try standard claim names
    const standardClaims = {
      'Company': ['organization', 'company', 'org'],
      'Role': ['role', 'jobTitle', 'title'],
      'Industry': ['industry', 'sector'],
      'Department': ['department', 'dept', 'division']
    };

    if (standardClaims[attributeName]) {
      for (const claimName of standardClaims[attributeName]) {
        if (jwtPayload[claimName]) {
          return jwtPayload[claimName];
        }
      }
    }

    return fallbackValue;
  }

  /**
   * Process display name with intelligent fallbacks
   * @param {Object} profile - User profile
   * @returns {string} Processed display name
   */
  processDisplayName(profile) {
    // Try existing display name
    if (profile.displayName && profile.displayName.trim()) {
      return profile.displayName.trim();
    }

    // Try name field
    if (profile.name && profile.name.trim()) {
      return profile.name.trim();
    }

    // Construct from first and last name
    const firstName = profile.firstName || profile.givenName || '';
    const lastName = profile.lastName || profile.familyName || '';
    
    if (firstName && lastName) {
      return `${firstName} ${lastName}`.trim();
    }

    if (firstName) {
      return firstName.trim();
    }

    if (lastName) {
      return lastName.trim();
    }

    // Fallback to email local part
    if (profile.email) {
      const localPart = profile.email.split('@')[0];
      return localPart.replace(/[._-]/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());
    }

    return 'User';
  }

  /**
   * Generate user initials
   * @param {Object} profile - User profile
   * @returns {string} User initials
   */
  generateInitials(profile) {
    const displayName = profile.displayName || profile.name || '';
    
    if (displayName) {
      const nameParts = displayName.trim().split(/\s+/);
      if (nameParts.length >= 2) {
        return (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase();
      } else if (nameParts.length === 1) {
        return nameParts[0].substring(0, 2).toUpperCase();
      }
    }

    if (profile.email) {
      return profile.email.substring(0, 2).toUpperCase();
    }

    return 'U';
  }

  /**
   * Process email verification status
   * @param {Object} jwtPayload - JWT payload
   * @returns {boolean} Email verification status
   */
  processEmailVerification(jwtPayload) {
    // Check explicit email verification claims
    if (typeof jwtPayload.email_verified === 'boolean') {
      return jwtPayload.email_verified;
    }

    if (typeof jwtPayload.emailVerified === 'boolean') {
      return jwtPayload.emailVerified;
    }

    // Check string representations
    if (jwtPayload.email_verified === 'true' || jwtPayload.emailVerified === 'true') {
      return true;
    }

    if (jwtPayload.email_verified === 'false' || jwtPayload.emailVerified === 'false') {
      return false;
    }

    // For social logins, assume verified if from trusted provider
    const trustedProviders = ['google.com', 'microsoft.com', 'live.com'];
    if (jwtPayload.idp && trustedProviders.includes(jwtPayload.idp.toLowerCase())) {
      return true;
    }

    // Default to false for security
    return false;
  }

  /**
   * Process MFA status
   * @param {Object} jwtPayload - JWT payload
   * @returns {boolean} MFA enabled status
   */
  processMFAStatus(jwtPayload) {
    // Check for MFA-related claims
    if (jwtPayload.amr && Array.isArray(jwtPayload.amr)) {
      // Authentication Method Reference - check for MFA methods
      const mfaMethods = ['mfa', 'sms', 'otp', 'phone', 'email'];
      return jwtPayload.amr.some(method => mfaMethods.includes(method.toLowerCase()));
    }

    // Check for explicit MFA claims
    if (typeof jwtPayload.mfa_enabled === 'boolean') {
      return jwtPayload.mfa_enabled;
    }

    if (jwtPayload.mfa_enabled === 'true') {
      return true;
    }

    // Default to false
    return false;
  }

  /**
   * Generate user permissions based on profile
   * @param {Object} profile - User profile
   * @param {Object} options - Permission generation options
   * @returns {Array} User permissions
   */
  async generateUserPermissions(profile, options = {}) {
    const permissions = [];

    // Base permissions for all authenticated users
    permissions.push('read:profile', 'update:profile', 'upload:csv', 'chat:csv');

    // Role-based permissions
    if (profile.role) {
      const role = profile.role.toLowerCase();
      
      switch (role) {
        case 'admin':
        case 'administrator':
          permissions.push('admin:all', 'manage:users', 'view:analytics', 'export:data');
          break;
        case 'manager':
        case 'supervisor':
          permissions.push('manage:team', 'view:reports', 'export:reports');
          break;
        case 'analyst':
        case 'data analyst':
          permissions.push('advanced:analytics', 'export:data', 'view:detailed_reports');
          break;
        case 'user':
        case 'employee':
        default:
          // Base permissions already added
          break;
      }
    }

    // Company-based permissions (if implementing multi-tenant features)
    if (profile.company) {
      permissions.push(`company:${profile.company.toLowerCase().replace(/\s+/g, '_')}`);
    }

    // Email verification required permissions
    if (profile.emailVerified) {
      permissions.push('verified:email', 'share:data', 'collaborate:team');
    }

    return [...new Set(permissions)]; // Remove duplicates
  }

  /**
   * Determine user type based on profile
   * @param {Object} profile - User profile
   * @returns {string} User type
   */
  determineUserType(profile) {
    // Check for admin roles
    if (profile.role) {
      const role = profile.role.toLowerCase();
      if (['admin', 'administrator', 'super admin', 'system admin'].includes(role)) {
        return 'admin';
      }
      if (['manager', 'supervisor', 'team lead', 'director'].includes(role)) {
        return 'manager';
      }
      if (['analyst', 'data analyst', 'business analyst'].includes(role)) {
        return 'analyst';
      }
    }

    // Check identity provider
    if (profile.identityProvider === 'google.com') {
      return 'google_user';
    }
    if (['microsoft.com', 'live.com'].includes(profile.identityProvider)) {
      return 'microsoft_user';
    }

    return 'standard_user';
  }

  /**
   * Get default user preferences
   * @returns {Object} Default user preferences
   */
  getDefaultUserPreferences() {
    return {
      theme: 'light',
      language: 'en',
      timezone: 'UTC',
      notifications: {
        email: true,
        browser: true,
        chat: true
      },
      privacy: {
        showProfile: true,
        shareAnalytics: false
      },
      features: {
        advancedAnalytics: false,
        dataExport: true,
        collaboration: true
      }
    };
  }

  /**
   * Count custom claims in JWT payload
   * @param {Object} jwtPayload - JWT payload
   * @returns {number} Number of custom claims
   */
  countCustomClaims(jwtPayload) {
    let count = 0;
    const standardClaims = [
      'iss', 'aud', 'exp', 'iat', 'nbf', 'sub', 'auth_time', 'idp', 'tfp', 'acr',
      'emails', 'given_name', 'family_name', 'name', 'email', 'email_verified'
    ];

    for (const claim in jwtPayload) {
      if (!standardClaims.includes(claim) && !claim.startsWith('extension_')) {
        count++;
      }
      if (claim.startsWith('extension_')) {
        count++;
      }
    }

    return count;
  }

  /**
   * Validate user profile
   * @param {Object} profile - User profile to validate
   * @returns {Object} Validation result
   */
  validateUserProfile(profile) {
    const errors = [];

    // Required fields validation
    if (!profile.id) {
      errors.push('User ID is required');
    }

    if (!profile.email) {
      errors.push('Email is required');
    } else if (!this.isValidEmail(profile.email)) {
      errors.push('Invalid email format');
    }

    // Optional field validation
    if (profile.company && profile.company.length > 100) {
      errors.push('Company name too long (max 100 characters)');
    }

    if (profile.role && profile.role.length > 50) {
      errors.push('Role too long (max 50 characters)');
    }

    if (profile.displayName && profile.displayName.length > 100) {
      errors.push('Display name too long (max 100 characters)');
    }

    return {
      valid: errors.length === 0,
      errors: errors
    };
  }

  /**
   * Validate email format
   * @param {string} email - Email to validate
   * @returns {boolean} Is valid email
   */
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Cache user profile
   * @param {Object} profile - User profile to cache
   */
  cacheUserProfile(profile) {
    try {
      // Implement cache size limit
      if (this.cache.size >= this.maxCacheSize) {
        // Remove oldest entries (simple LRU)
        const oldestKey = this.cache.keys().next().value;
        this.cache.delete(oldestKey);
      }

      const cacheEntry = {
        profile: profile,
        timestamp: Date.now(),
        expiresAt: Date.now() + this.cacheTimeout
      };

      this.cache.set(profile.id, cacheEntry);

      if (config.debugAuth) {
        console.log(`💾 Cached user profile for ${profile.email} (cache size: ${this.cache.size})`);
      }

    } catch (error) {
      console.error('User profile caching error:', error);
    }
  }

  /**
   * Get cached user profile
   * @param {string} userId - User ID
   * @returns {Object|null} Cached user profile or null
   */
  getCachedUserProfile(userId) {
    try {
      const cacheEntry = this.cache.get(userId);
      
      if (!cacheEntry) {
        return null;
      }

      // Check if cache entry has expired
      if (Date.now() > cacheEntry.expiresAt) {
        this.cache.delete(userId);
        return null;
      }

      if (config.debugAuth) {
        console.log(`💾 Retrieved cached user profile for ${userId}`);
      }

      return cacheEntry.profile;

    } catch (error) {
      console.error('User profile cache retrieval error:', error);
      return null;
    }
  }

  /**
   * Clear user from cache
   * @param {string} userId - User ID
   */
  clearUserCache(userId) {
    try {
      const deleted = this.cache.delete(userId);
      
      if (deleted && config.debugAuth) {
        console.log(`🗑️  Cleared cached user profile for ${userId}`);
      }

      return deleted;

    } catch (error) {
      console.error('User profile cache clearing error:', error);
      return false;
    }
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getCacheStats() {
    const now = Date.now();
    let expiredCount = 0;

    for (const [userId, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        expiredCount++;
      }
    }

    return {
      totalEntries: this.cache.size,
      expiredEntries: expiredCount,
      activeEntries: this.cache.size - expiredCount,
      maxSize: this.maxCacheSize,
      cacheTimeout: this.cacheTimeout,
      memoryUsage: this.cache.size * 1024 // Rough estimate
    };
  }

  /**
   * Clear expired cache entries
   * @returns {number} Number of entries cleared
   */
  clearExpiredCache() {
    const now = Date.now();
    let clearedCount = 0;

    for (const [userId, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(userId);
        clearedCount++;
      }
    }

    if (clearedCount > 0 && config.debugAuth) {
      console.log(`🗑️  Cleared ${clearedCount} expired user cache entries`);
    }

    return clearedCount;
  }

  /**
   * Update user profile in cache
   * @param {string} userId - User ID
   * @param {Object} updates - Profile updates
   * @returns {Object|null} Updated profile or null
   */
  updateCachedUserProfile(userId, updates) {
    try {
      const cacheEntry = this.cache.get(userId);
      
      if (!cacheEntry || Date.now() > cacheEntry.expiresAt) {
        return null;
      }

      // Update profile
      const updatedProfile = {
        ...cacheEntry.profile,
        ...updates,
        lastUpdated: new Date().toISOString()
      };

      // Update cache entry
      cacheEntry.profile = updatedProfile;
      cacheEntry.timestamp = Date.now();
      this.cache.set(userId, cacheEntry);

      if (config.debugAuth) {
        console.log(`🔄 Updated cached user profile for ${userId}`);
      }

      return updatedProfile;

    } catch (error) {
      console.error('User profile cache update error:', error);
      return null;
    }
  }
}

// Create singleton instance
const userService = new UserService();

// Periodic cache cleanup
if (isFeatureEnabled('userCacheCleanup')) {
  setInterval(() => {
    userService.clearExpiredCache();
  }, 15 * 60 * 1000); // Clean every 15 minutes
}

module.exports = {
  UserService,
  userService
};
