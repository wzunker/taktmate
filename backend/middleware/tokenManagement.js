// TaktMate Microsoft Entra External ID Token Management and Session Timeout System
// Comprehensive token lifecycle management, refresh handling, and session timeout configuration

const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-client').default || require('jwks-client');
const axios = require('axios');
const { config: azureConfig, getJwksUri } = require('../config/entraExternalId');

/**
 * Advanced Token Management Service
 * Handles Microsoft Entra External ID token lifecycle, refresh, session timeout, and security policies
 */
class TokenManagementService {
    constructor(appInsights = null) {
        this.appInsights = appInsights;
        
        // Token management configuration
        this.config = {
            // Token lifetime and refresh settings
            accessTokenLifetime: parseInt(process.env.ACCESS_TOKEN_LIFETIME) || 60 * 60 * 1000, // 1 hour
            refreshTokenLifetime: parseInt(process.env.REFRESH_TOKEN_LIFETIME) || 7 * 24 * 60 * 60 * 1000, // 7 days
            idTokenLifetime: parseInt(process.env.ID_TOKEN_LIFETIME) || 60 * 60 * 1000, // 1 hour
            
            // Session timeout settings
            sessionTimeout: parseInt(process.env.SESSION_TIMEOUT) || 8 * 60 * 60 * 1000, // 8 hours
            inactivityTimeout: parseInt(process.env.INACTIVITY_TIMEOUT) || 30 * 60 * 1000, // 30 minutes
            extendedSessionTimeout: parseInt(process.env.EXTENDED_SESSION_TIMEOUT) || 30 * 24 * 60 * 60 * 1000, // 30 days
            
            // Token refresh settings
            refreshThreshold: parseInt(process.env.TOKEN_REFRESH_THRESHOLD) || 5 * 60 * 1000, // 5 minutes before expiry
            refreshRetryAttempts: parseInt(process.env.REFRESH_RETRY_ATTEMPTS) || 3,
            refreshRetryDelay: parseInt(process.env.REFRESH_RETRY_DELAY) || 1000, // 1 second
            
            // Security settings
            enableTokenRotation: process.env.ENABLE_TOKEN_ROTATION !== 'false',
            enableSecureTokenStorage: process.env.ENABLE_SECURE_TOKEN_STORAGE !== 'false',
            enableTokenValidation: process.env.ENABLE_TOKEN_VALIDATION !== 'false',
            enableSessionFingerprinting: process.env.ENABLE_SESSION_FINGERPRINTING !== 'false',
            
            // Clock skew and validation
            clockTolerance: parseInt(process.env.JWT_CLOCK_TOLERANCE) || 300, // 5 minutes
            leeway: parseInt(process.env.JWT_LEEWAY) || 60, // 1 minute
            
            // Cache settings
            jwksCache: {
                ttl: parseInt(process.env.JWKS_CACHE_TTL) || 24 * 60 * 60 * 1000, // 24 hours
                maxSize: parseInt(process.env.JWKS_CACHE_MAX_SIZE) || 100,
                checkPeriod: parseInt(process.env.JWKS_CACHE_CHECK_PERIOD) || 60 * 60 * 1000 // 1 hour
            },
            
            tokenCache: {
                ttl: parseInt(process.env.TOKEN_CACHE_TTL) || 60 * 60 * 1000, // 1 hour
                maxSize: parseInt(process.env.TOKEN_CACHE_MAX_SIZE) || 1000,
                checkPeriod: parseInt(process.env.TOKEN_CACHE_CHECK_PERIOD) || 10 * 60 * 1000 // 10 minutes
            },
            
            // Advanced security features
            enableMutualTLS: process.env.ENABLE_MUTUAL_TLS === 'true',
            enableTokenBinding: process.env.ENABLE_TOKEN_BINDING === 'true',
            enableProofOfPossession: process.env.ENABLE_PROOF_OF_POSSESSION === 'true',
            
            // Monitoring and logging
            enableTokenMetrics: process.env.ENABLE_TOKEN_METRICS !== 'false',
            enableRefreshLogging: process.env.ENABLE_REFRESH_LOGGING !== 'false',
            enableSecurityEventLogging: process.env.ENABLE_SECURITY_EVENT_LOGGING !== 'false'
        };
        
        // JWKS client for token signature validation
        this.jwksClient = jwksClient({
            jwksUri: getJwksUri(),
            requestHeaders: {
                'User-Agent': 'TaktMate-Backend/2.0'
            },
            timeout: 30000, // 30 seconds
            cache: true,
            cacheMaxEntries: this.config.jwksCache.maxSize,
            cacheMaxAge: this.config.jwksCache.ttl,
            rateLimit: true,
            jwksRequestsPerMinute: 10,
            proxy: process.env.HTTPS_PROXY || process.env.HTTP_PROXY
        });
        
        // Token and session tracking
        this.activeTokens = new Map();
        this.refreshTokens = new Map();
        this.sessionFingerprints = new Map();
        this.tokenMetrics = {
            tokensIssued: 0,
            tokensRefreshed: 0,
            tokensExpired: 0,
            tokensRevoked: 0,
            refreshFailures: 0,
            validationFailures: 0,
            securityViolations: 0
        };
        
        // Token validation cache
        this.validationCache = new Map();
        this.lastCacheCleanup = Date.now();
        
        console.log('🔐 Token Management Service initialized');
        console.log(`   Access Token Lifetime: ${this.config.accessTokenLifetime / 1000 / 60} minutes`);
        console.log(`   Session Timeout: ${this.config.sessionTimeout / 1000 / 60 / 60} hours`);
        console.log(`   Inactivity Timeout: ${this.config.inactivityTimeout / 1000 / 60} minutes`);
        console.log(`   Token Refresh Threshold: ${this.config.refreshThreshold / 1000 / 60} minutes`);
        console.log(`   Token Rotation: ${this.config.enableTokenRotation ? '✅' : '❌'}`);
        console.log(`   Session Fingerprinting: ${this.config.enableSessionFingerprinting ? '✅' : '❌'}`);
    }
    
    /**
     * Validate Microsoft Entra External ID token with comprehensive security checks
     */
    async validateToken(token, options = {}) {
        const startTime = Date.now();
        
        try {
            // Check validation cache first
            const cacheKey = this.generateCacheKey(token, options);
            const cached = this.validationCache.get(cacheKey);
            
            if (cached && cached.expiresAt > Date.now()) {
                this.trackTokenEvent('token_validation_cached', { cached: true });
                return cached.result;
            }
            
            // Decode token header to get key ID
            const decoded = jwt.decode(token, { complete: true });
            if (!decoded || !decoded.header || !decoded.header.kid) {
                throw new Error('Invalid token format or missing key ID');
            }
            
            // Get signing key from JWKS
            const signingKey = await this.getSigningKey(decoded.header.kid);
            
            // Validate token signature and claims
            const verifyOptions = {
                algorithms: ['RS256'],
                issuer: azureConfig.getIssuerUrl(),
                audience: azureConfig.config.clientId,
                clockTolerance: this.config.clockTolerance,
                ignoreExpiration: options.ignoreExpiration || false,
                ignoreNotBefore: options.ignoreNotBefore || false,
                ...options
            };
            
            const payload = jwt.verify(token, signingKey, verifyOptions);
            
            // Additional security validations
            await this.performSecurityValidations(payload, token, options);
            
            // Extract user profile
            const userProfile = azureConfig.extractUserProfile(payload);
            
            // Create validation result
            const result = {
                valid: true,
                payload: payload,
                user: userProfile,
                tokenType: this.determineTokenType(payload),
                expiresAt: payload.exp * 1000,
                issuedAt: payload.iat * 1000,
                validatedAt: Date.now(),
                validationDuration: Date.now() - startTime
            };
            
            // Cache validation result
            this.cacheValidationResult(cacheKey, result);
            
            // Track successful validation
            this.trackTokenEvent('token_validation_success', {
                tokenType: result.tokenType,
                userId: userProfile.id,
                duration: result.validationDuration
            });
            
            // Update token metrics
            this.tokenMetrics.tokensIssued++;
            
            return result;
            
        } catch (error) {
            // Track validation failure
            this.trackTokenEvent('token_validation_failed', {
                error: error.message,
                duration: Date.now() - startTime
            });
            
            this.tokenMetrics.validationFailures++;
            
            throw new Error(`Token validation failed: ${error.message}`);
        }
    }
    
    /**
     * Check if token needs refresh
     */
    needsRefresh(token, threshold = null) {
        try {
            const decoded = jwt.decode(token);
            if (!decoded || !decoded.exp) {
                return true; // Invalid token needs refresh
            }
            
            const expiresAt = decoded.exp * 1000;
            const now = Date.now();
            const refreshThreshold = threshold || this.config.refreshThreshold;
            
            return (expiresAt - now) <= refreshThreshold;
        } catch (error) {
            return true; // Error decoding token, needs refresh
        }
    }
    
    /**
     * Refresh Microsoft Entra External ID token
     */
    async refreshToken(refreshToken, options = {}) {
        const startTime = Date.now();
        let attempt = 0;
        
        while (attempt < this.config.refreshRetryAttempts) {
            try {
                attempt++;
                
                // Track refresh attempt
                this.trackTokenEvent('token_refresh_attempt', {
                    attempt: attempt,
                    maxAttempts: this.config.refreshRetryAttempts
                });
                
                // Prepare refresh request
                const refreshUrl = this.buildRefreshUrl();
                const refreshData = this.buildRefreshData(refreshToken, options);
                
                // Make refresh request
                const response = await axios.post(refreshUrl, refreshData, {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'User-Agent': 'TaktMate-Backend/2.0'
                    },
                    timeout: 30000, // 30 seconds
                    validateStatus: (status) => status < 500 // Retry on server errors
                });
                
                if (response.status !== 200) {
                    throw new Error(`Token refresh failed with status ${response.status}: ${response.data?.error_description || response.statusText}`);
                }
                
                const tokenData = response.data;
                
                // Validate response
                if (!tokenData.access_token) {
                    throw new Error('No access token in refresh response');
                }
                
                // Create token set
                const tokenSet = {
                    accessToken: tokenData.access_token,
                    idToken: tokenData.id_token,
                    refreshToken: tokenData.refresh_token || refreshToken, // Use new refresh token if provided
                    tokenType: tokenData.token_type || 'Bearer',
                    expiresIn: tokenData.expires_in || 3600,
                    scope: tokenData.scope,
                    expiresAt: Date.now() + ((tokenData.expires_in || 3600) * 1000),
                    refreshedAt: Date.now()
                };
                
                // Validate new tokens
                if (this.config.enableTokenValidation) {
                    await this.validateToken(tokenSet.accessToken, { ignoreExpiration: false });
                    if (tokenSet.idToken) {
                        await this.validateToken(tokenSet.idToken, { ignoreExpiration: false });
                    }
                }
                
                // Track successful refresh
                this.trackTokenEvent('token_refresh_success', {
                    attempt: attempt,
                    duration: Date.now() - startTime,
                    newExpiresIn: tokenSet.expiresIn
                });
                
                this.tokenMetrics.tokensRefreshed++;
                
                // Store refresh token if rotation is enabled
                if (this.config.enableTokenRotation && tokenSet.refreshToken !== refreshToken) {
                    this.storeRefreshToken(tokenSet.refreshToken, tokenSet);
                    this.revokeRefreshToken(refreshToken);
                }
                
                return tokenSet;
                
            } catch (error) {
                console.error(`❌ Token refresh attempt ${attempt} failed:`, error.message);
                
                // Check if error is retryable
                if (!this.isRetryableError(error) || attempt >= this.config.refreshRetryAttempts) {
                    this.trackTokenEvent('token_refresh_failed', {
                        attempt: attempt,
                        error: error.message,
                        duration: Date.now() - startTime
                    });
                    
                    this.tokenMetrics.refreshFailures++;
                    
                    throw new Error(`Token refresh failed after ${attempt} attempts: ${error.message}`);
                }
                
                // Wait before retry
                if (attempt < this.config.refreshRetryAttempts) {
                    await this.delay(this.config.refreshRetryDelay * attempt);
                }
            }
        }
    }
    
    /**
     * Create session fingerprint for enhanced security
     */
    createSessionFingerprint(request) {
        if (!this.config.enableSessionFingerprinting) {
            return null;
        }
        
        const components = [
            request.headers['user-agent'] || '',
            request.ip || request.connection?.remoteAddress || '',
            request.headers['accept-language'] || '',
            request.headers['accept-encoding'] || '',
            // Note: Don't include highly variable headers that change frequently
        ];
        
        return this.hashComponents(components);
    }
    
    /**
     * Validate session fingerprint
     */
    validateSessionFingerprint(sessionId, currentFingerprint) {
        if (!this.config.enableSessionFingerprinting) {
            return true;
        }
        
        const storedFingerprint = this.sessionFingerprints.get(sessionId);
        if (!storedFingerprint) {
            return false; // No stored fingerprint
        }
        
        const isValid = storedFingerprint === currentFingerprint;
        
        if (!isValid) {
            this.trackSecurityEvent('session_fingerprint_mismatch', {
                sessionId: sessionId,
                stored: storedFingerprint,
                current: currentFingerprint
            });
        }
        
        return isValid;
    }
    
    /**
     * Get token expiration information
     */
    getTokenExpirationInfo(token) {
        try {
            const decoded = jwt.decode(token);
            if (!decoded || !decoded.exp) {
                return null;
            }
            
            const expiresAt = decoded.exp * 1000;
            const now = Date.now();
            const timeRemaining = Math.max(0, expiresAt - now);
            
            return {
                expiresAt: expiresAt,
                expiresAtISO: new Date(expiresAt).toISOString(),
                timeRemaining: timeRemaining,
                timeRemainingMinutes: Math.floor(timeRemaining / 1000 / 60),
                isExpired: timeRemaining <= 0,
                needsRefresh: this.needsRefresh(token),
                issuedAt: decoded.iat ? decoded.iat * 1000 : null,
                issuedAtISO: decoded.iat ? new Date(decoded.iat * 1000).toISOString() : null
            };
        } catch (error) {
            return null;
        }
    }
    
    /**
     * Revoke token
     */
    async revokeToken(token, tokenType = 'access_token') {
        try {
            const revokeUrl = this.buildRevokeUrl();
            const revokeData = new URLSearchParams({
                token: token,
                token_type_hint: tokenType,
                client_id: azureConfig.config.clientId
            });
            
            if (azureConfig.config.clientSecret) {
                revokeData.append('client_secret', azureConfig.config.clientSecret);
            }
            
            const response = await axios.post(revokeUrl, revokeData, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'TaktMate-Backend/2.0'
                },
                timeout: 30000,
                validateStatus: (status) => status < 500
            });
            
            this.trackTokenEvent('token_revoked', {
                tokenType: tokenType,
                status: response.status
            });
            
            this.tokenMetrics.tokensRevoked++;
            
            return response.status === 200;
            
        } catch (error) {
            console.error('❌ Token revocation failed:', error.message);
            return false;
        }
    }
    
    /**
     * Perform comprehensive security validations
     */
    async performSecurityValidations(payload, token, options) {
        // Validate token type
        const tokenType = this.determineTokenType(payload);
        if (options.expectedTokenType && tokenType !== options.expectedTokenType) {
            throw new Error(`Expected ${options.expectedTokenType} token, got ${tokenType}`);
        }
        
        // Validate authentication method
        if (payload.amr && options.requiredAuthMethods) {
            const hasRequiredMethod = options.requiredAuthMethods.some(method => 
                payload.amr.includes(method)
            );
            if (!hasRequiredMethod) {
                throw new Error(`Required authentication method not present: ${options.requiredAuthMethods.join(', ')}`);
            }
        }
        
        // Validate authentication context class
        if (payload.acr && options.requiredAcr) {
            if (payload.acr !== options.requiredAcr) {
                throw new Error(`Required authentication context class not met: expected ${options.requiredAcr}, got ${payload.acr}`);
            }
        }
        
        // Validate nonce if provided
        if (options.nonce && payload.nonce !== options.nonce) {
            throw new Error('Nonce validation failed');
        }
        
        // Validate at_hash for ID tokens
        if (tokenType === 'id_token' && payload.at_hash && options.accessToken) {
            const isValidHash = await this.validateAccessTokenHash(payload.at_hash, options.accessToken);
            if (!isValidHash) {
                throw new Error('Access token hash validation failed');
            }
        }
        
        // Additional custom validations
        if (options.customValidator && typeof options.customValidator === 'function') {
            await options.customValidator(payload, token);
        }
    }
    
    /**
     * Get signing key from JWKS
     */
    async getSigningKey(keyId) {
        return new Promise((resolve, reject) => {
            this.jwksClient.getSigningKey(keyId, (err, key) => {
                if (err) {
                    reject(new Error(`Failed to get signing key: ${err.message}`));
                    return;
                }
                
                const signingKey = key.getPublicKey();
                resolve(signingKey);
            });
        });
    }
    
    /**
     * Determine token type from payload
     */
    determineTokenType(payload) {
        if (payload.aud && payload.aud === azureConfig.config.clientId) {
            if (payload.nonce || payload.at_hash) {
                return 'id_token';
            }
            return 'access_token';
        }
        
        if (payload.scp || payload.scope) {
            return 'access_token';
        }
        
        return 'unknown';
    }
    
    /**
     * Build token refresh URL
     */
    buildRefreshUrl() {
        const { domain, tenantName, signUpSignInPolicy } = azureConfig.config;
        return `https://${domain}/${tenantName}.onmicrosoft.com/${signUpSignInPolicy}/oauth2/v2.0/token`;
    }
    
    /**
     * Build token refresh data
     */
    buildRefreshData(refreshToken, options = {}) {
        const data = new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            client_id: azureConfig.config.clientId,
            scope: options.scope || azureConfig.config.scope
        });
        
        if (azureConfig.config.clientSecret) {
            data.append('client_secret', azureConfig.config.clientSecret);
        }
        
        return data;
    }
    
    /**
     * Build token revocation URL
     */
    buildRevokeUrl() {
        const { domain, tenantName, signUpSignInPolicy } = azureConfig.config;
        return `https://${domain}/${tenantName}.onmicrosoft.com/${signUpSignInPolicy}/oauth2/v2.0/logout`;
    }
    
    /**
     * Check if error is retryable
     */
    isRetryableError(error) {
        // Network errors are retryable
        if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
            return true;
        }
        
        // HTTP 5xx errors are retryable
        if (error.response && error.response.status >= 500) {
            return true;
        }
        
        // Rate limiting is retryable
        if (error.response && error.response.status === 429) {
            return true;
        }
        
        // Temporary Microsoft Entra External ID errors
        const retryableErrorCodes = [
            'temporarily_unavailable',
            'server_error',
            'service_unavailable'
        ];
        
        if (error.response && error.response.data && error.response.data.error) {
            return retryableErrorCodes.includes(error.response.data.error);
        }
        
        return false;
    }
    
    /**
     * Generate cache key for validation results
     */
    generateCacheKey(token, options) {
        const tokenHash = this.hashString(token);
        const optionsHash = this.hashString(JSON.stringify(options));
        return `${tokenHash}_${optionsHash}`;
    }
    
    /**
     * Cache validation result
     */
    cacheValidationResult(cacheKey, result) {
        // Set cache TTL to token expiry or default cache TTL
        const cacheTtl = Math.min(
            result.expiresAt - Date.now(),
            this.config.tokenCache.ttl
        );
        
        this.validationCache.set(cacheKey, {
            result: result,
            expiresAt: Date.now() + cacheTtl
        });
        
        // Clean up cache if needed
        if (Date.now() - this.lastCacheCleanup > this.config.tokenCache.checkPeriod) {
            this.cleanupValidationCache();
        }
    }
    
    /**
     * Clean up expired validation cache entries
     */
    cleanupValidationCache() {
        const now = Date.now();
        let cleanedCount = 0;
        
        for (const [key, cached] of this.validationCache.entries()) {
            if (cached.expiresAt <= now) {
                this.validationCache.delete(key);
                cleanedCount++;
            }
        }
        
        this.lastCacheCleanup = now;
        
        if (cleanedCount > 0) {
            console.log(`🧹 Cleaned up ${cleanedCount} expired token validation cache entries`);
        }
    }
    
    /**
     * Store refresh token securely
     */
    storeRefreshToken(refreshToken, tokenSet) {
        if (!this.config.enableSecureTokenStorage) {
            return;
        }
        
        const tokenHash = this.hashString(refreshToken);
        this.refreshTokens.set(tokenHash, {
            tokenSet: tokenSet,
            storedAt: Date.now(),
            expiresAt: Date.now() + this.config.refreshTokenLifetime
        });
    }
    
    /**
     * Revoke refresh token
     */
    revokeRefreshToken(refreshToken) {
        const tokenHash = this.hashString(refreshToken);
        this.refreshTokens.delete(tokenHash);
    }
    
    /**
     * Validate access token hash in ID token
     */
    async validateAccessTokenHash(atHash, accessToken) {
        try {
            const crypto = require('crypto');
            const hash = crypto.createHash('sha256').update(accessToken).digest();
            const leftHalf = hash.slice(0, hash.length / 2);
            const base64Hash = leftHalf.toString('base64url');
            
            return base64Hash === atHash;
        } catch (error) {
            console.error('❌ Access token hash validation error:', error.message);
            return false;
        }
    }
    
    /**
     * Hash string using SHA-256
     */
    hashString(input) {
        const crypto = require('crypto');
        return crypto.createHash('sha256').update(input).digest('hex');
    }
    
    /**
     * Hash components for fingerprinting
     */
    hashComponents(components) {
        const combined = components.join('|');
        return this.hashString(combined);
    }
    
    /**
     * Delay execution
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * Track token-related events
     */
    trackTokenEvent(eventType, data = {}) {
        if (this.config.enableTokenMetrics && this.appInsights) {
            this.appInsights.telemetry.trackEvent(`Token_${eventType}`, {
                ...data,
                timestamp: new Date().toISOString(),
                service: 'token-management'
            });
        }
        
        if (this.config.enableRefreshLogging) {
            console.log(`🔐 Token Event: ${eventType}`, data);
        }
    }
    
    /**
     * Track security events
     */
    trackSecurityEvent(eventType, data = {}) {
        if (this.config.enableSecurityEventLogging) {
            console.warn(`🚨 Security Event: ${eventType}`, data);
            
            if (this.appInsights) {
                this.appInsights.telemetry.trackEvent(`Security_${eventType}`, {
                    ...data,
                    timestamp: new Date().toISOString(),
                    service: 'token-management',
                    severity: 'warning'
                });
            }
            
            this.tokenMetrics.securityViolations++;
        }
    }
    
    /**
     * Get comprehensive token management statistics
     */
    getStatistics() {
        return {
            ...this.tokenMetrics,
            activeTokensCount: this.activeTokens.size,
            refreshTokensCount: this.refreshTokens.size,
            validationCacheSize: this.validationCache.size,
            sessionFingerprintsCount: this.sessionFingerprints.size,
            
            configuration: {
                accessTokenLifetime: this.config.accessTokenLifetime / 1000 / 60 + ' minutes',
                sessionTimeout: this.config.sessionTimeout / 1000 / 60 / 60 + ' hours',
                inactivityTimeout: this.config.inactivityTimeout / 1000 / 60 + ' minutes',
                refreshThreshold: this.config.refreshThreshold / 1000 / 60 + ' minutes',
                tokenRotation: this.config.enableTokenRotation,
                secureStorage: this.config.enableSecureTokenStorage,
                sessionFingerprinting: this.config.enableSessionFingerprinting,
                tokenValidation: this.config.enableTokenValidation
            },
            
            cache: {
                jwksCacheTtl: this.config.jwksCache.ttl / 1000 / 60 / 60 + ' hours',
                tokenCacheTtl: this.config.tokenCache.ttl / 1000 / 60 + ' minutes',
                lastCacheCleanup: new Date(this.lastCacheCleanup).toISOString()
            }
        };
    }
    
    /**
     * Create Express middleware for token management
     */
    createTokenMiddleware() {
        return async (req, res, next) => {
            try {
                // Skip for non-authenticated routes
                if (!req.user || !req.headers.authorization) {
                    return next();
                }
                
                const token = req.headers.authorization.replace('Bearer ', '');
                
                // Get token expiration info
                const expirationInfo = this.getTokenExpirationInfo(token);
                
                if (expirationInfo) {
                    // Add token info to request
                    req.tokenInfo = expirationInfo;
                    
                    // Check if token needs refresh
                    if (expirationInfo.needsRefresh && !expirationInfo.isExpired) {
                        // Set header to indicate client should refresh token
                        res.set('X-Token-Refresh-Needed', 'true');
                        res.set('X-Token-Expires-At', expirationInfo.expiresAtISO);
                        res.set('X-Token-Time-Remaining', expirationInfo.timeRemaining.toString());
                    }
                    
                    // Create/validate session fingerprint
                    if (this.config.enableSessionFingerprinting) {
                        const fingerprint = this.createSessionFingerprint(req);
                        const sessionId = req.sessionID || req.user.sessionId;
                        
                        if (sessionId) {
                            if (!this.sessionFingerprints.has(sessionId)) {
                                this.sessionFingerprints.set(sessionId, fingerprint);
                            } else {
                                const isValid = this.validateSessionFingerprint(sessionId, fingerprint);
                                if (!isValid) {
                                    return res.status(401).json({
                                        success: false,
                                        error: 'Session security validation failed',
                                        code: 'SESSION_FINGERPRINT_MISMATCH'
                                    });
                                }
                            }
                        }
                    }
                }
                
                next();
            } catch (error) {
                console.error('❌ Token middleware error:', error.message);
                next(); // Continue without token info
            }
        };
    }
    
    /**
     * Create Express middleware for automatic token refresh
     */
    createAutoRefreshMiddleware() {
        return async (req, res, next) => {
            try {
                // Only process if user has refresh token capability
                if (!req.user || !req.user.refreshToken) {
                    return next();
                }
                
                const token = req.headers.authorization?.replace('Bearer ', '');
                
                if (token && this.needsRefresh(token)) {
                    try {
                        const newTokenSet = await this.refreshToken(req.user.refreshToken);
                        
                        // Update response headers with new tokens
                        res.set('X-New-Access-Token', newTokenSet.accessToken);
                        if (newTokenSet.idToken) {
                            res.set('X-New-Id-Token', newTokenSet.idToken);
                        }
                        if (newTokenSet.refreshToken !== req.user.refreshToken) {
                            res.set('X-New-Refresh-Token', newTokenSet.refreshToken);
                        }
                        res.set('X-Token-Refreshed', 'true');
                        
                        console.log(`🔄 Automatically refreshed token for user ${req.user.id}`);
                        
                    } catch (refreshError) {
                        console.error('❌ Automatic token refresh failed:', refreshError.message);
                        // Don't fail the request, just log the error
                    }
                }
                
                next();
            } catch (error) {
                console.error('❌ Auto-refresh middleware error:', error.message);
                next();
            }
        };
    }
}

module.exports = {
    TokenManagementService
};
