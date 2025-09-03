// TaktMate CSRF Protection Middleware
// Comprehensive Cross-Site Request Forgery protection for form submissions

const crypto = require('crypto');
const { body, cookie } = require('express-validator');

/**
 * Advanced CSRF Protection Service
 * Provides comprehensive protection against Cross-Site Request Forgery attacks
 */
class CSRFProtectionService {
    constructor(appInsights = null) {
        this.appInsights = appInsights;
        
        // CSRF configuration
        this.config = {
            // Token configuration
            tokenLength: 32, // 32 bytes = 256 bits
            tokenExpiry: 60 * 60 * 1000, // 1 hour in milliseconds
            
            // Cookie configuration
            cookieName: '_csrf_token',
            cookieOptions: {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production', // HTTPS only in production
                sameSite: 'strict', // Strict same-site policy
                maxAge: 60 * 60 * 1000, // 1 hour
                path: '/'
            },
            
            // Header configuration
            headerName: 'x-csrf-token',
            alternateHeaders: [
                'x-xsrf-token', // Common alternative
                'csrf-token'    // Another common alternative
            ],
            
            // Form field configuration
            fieldName: '_csrf',
            
            // Security options
            doubleSubmitCookie: true, // Use double submit cookie pattern
            encryptTokens: true,      // Encrypt tokens for additional security
            rotateTokens: true,       // Rotate tokens on each request
            validateOrigin: true,     // Validate request origin
            validateReferer: true,    // Validate referer header
            
            // Exempted paths (typically for API endpoints with other auth)
            exemptPaths: [
                '/health',
                '/health/cors',
                '/health/security',
                '/api/status',
                '/auth/config'
            ],
            
            // Methods that require CSRF protection
            protectedMethods: ['POST', 'PUT', 'PATCH', 'DELETE']
        };
        
        // In-memory token store (in production, use Redis or database)
        this.tokenStore = new Map();
        
        // Encryption key for token encryption
        this.encryptionKey = this.generateEncryptionKey();
        
        console.log('🛡️ CSRF Protection Service initialized');
        console.log(`   Token Length: ${this.config.tokenLength} bytes`);
        console.log(`   Token Expiry: ${this.config.tokenExpiry / 1000 / 60} minutes`);
        console.log(`   Double Submit Cookie: ${this.config.doubleSubmitCookie ? 'Enabled' : 'Disabled'}`);
        console.log(`   Token Encryption: ${this.config.encryptTokens ? 'Enabled' : 'Disabled'}`);
    }
    
    /**
     * Generate encryption key for token encryption
     */
    generateEncryptionKey() {
        // In production, this should come from environment variables or key management service
        const key = process.env.CSRF_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
        if (!process.env.CSRF_ENCRYPTION_KEY && process.env.NODE_ENV === 'production') {
            console.warn('⚠️ CSRF_ENCRYPTION_KEY not set in production. Using random key (tokens will not persist across restarts).');
        }
        return key;
    }
    
    /**
     * Generate cryptographically secure CSRF token
     */
    generateToken(sessionId = null) {
        const timestamp = Date.now();
        const randomBytes = crypto.randomBytes(this.config.tokenLength);
        const sessionComponent = sessionId ? crypto.createHash('sha256').update(sessionId).digest('hex').substring(0, 16) : '';
        
        // Create token payload
        const payload = {
            random: randomBytes.toString('hex'),
            timestamp: timestamp,
            session: sessionComponent
        };
        
        let token;
        if (this.config.encryptTokens) {
            // Encrypt the token payload
            token = this.encryptToken(JSON.stringify(payload));
        } else {
            // Base64 encode the token payload
            token = Buffer.from(JSON.stringify(payload)).toString('base64');
        }
        
        return {
            token: token,
            timestamp: timestamp,
            expires: timestamp + this.config.tokenExpiry
        };
    }
    
    /**
     * Encrypt token payload
     */
    encryptToken(payload) {
        try {
            const algorithm = 'aes-256-gcm';
            const key = Buffer.from(this.encryptionKey, 'hex');
            const iv = crypto.randomBytes(16);
            
            const cipher = crypto.createCipher(algorithm, key);
            cipher.setAAD(Buffer.from('csrf-token'));
            
            let encrypted = cipher.update(payload, 'utf8', 'hex');
            encrypted += cipher.final('hex');
            
            const authTag = cipher.getAuthTag();
            
            return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
        } catch (error) {
            console.error('❌ Token encryption failed:', error.message);
            // Fallback to base64 encoding
            return Buffer.from(payload).toString('base64');
        }
    }
    
    /**
     * Decrypt token payload
     */
    decryptToken(encryptedToken) {
        try {
            const parts = encryptedToken.split(':');
            if (parts.length !== 3) {
                // Try base64 decoding for fallback
                return Buffer.from(encryptedToken, 'base64').toString('utf8');
            }
            
            const algorithm = 'aes-256-gcm';
            const key = Buffer.from(this.encryptionKey, 'hex');
            const iv = Buffer.from(parts[0], 'hex');
            const authTag = Buffer.from(parts[1], 'hex');
            const encrypted = parts[2];
            
            const decipher = crypto.createDecipher(algorithm, key);
            decipher.setAAD(Buffer.from('csrf-token'));
            decipher.setAuthTag(authTag);
            
            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            
            return decrypted;
        } catch (error) {
            console.error('❌ Token decryption failed:', error.message);
            // Try base64 decoding for fallback
            try {
                return Buffer.from(encryptedToken, 'base64').toString('utf8');
            } catch {
                throw new Error('Invalid token format');
            }
        }
    }
    
    /**
     * Validate CSRF token
     */
    validateToken(token, sessionId = null) {
        if (!token) {
            return {
                valid: false,
                reason: 'Token not provided',
                code: 'TOKEN_MISSING'
            };
        }
        
        try {
            // Decrypt/decode token
            const payloadStr = this.config.encryptTokens ? 
                this.decryptToken(token) : 
                Buffer.from(token, 'base64').toString('utf8');
            
            const payload = JSON.parse(payloadStr);
            
            // Validate token structure
            if (!payload.random || !payload.timestamp) {
                return {
                    valid: false,
                    reason: 'Invalid token structure',
                    code: 'TOKEN_MALFORMED'
                };
            }
            
            // Check token expiry
            const now = Date.now();
            if (now > payload.timestamp + this.config.tokenExpiry) {
                return {
                    valid: false,
                    reason: 'Token expired',
                    code: 'TOKEN_EXPIRED',
                    expired: true
                };
            }
            
            // Validate session component if provided
            if (sessionId && payload.session) {
                const expectedSessionComponent = crypto.createHash('sha256').update(sessionId).digest('hex').substring(0, 16);
                if (payload.session !== expectedSessionComponent) {
                    return {
                        valid: false,
                        reason: 'Token session mismatch',
                        code: 'TOKEN_SESSION_MISMATCH'
                    };
                }
            }
            
            return {
                valid: true,
                payload: payload,
                age: now - payload.timestamp
            };
        } catch (error) {
            return {
                valid: false,
                reason: 'Token validation failed: ' + error.message,
                code: 'TOKEN_INVALID'
            };
        }
    }
    
    /**
     * Get session ID from request (user ID or session identifier)
     */
    getSessionId(req) {
        // Try to get user ID from JWT token
        if (req.user && req.user.id) {
            return req.user.id;
        }
        
        // Try to get session ID from session
        if (req.session && req.session.id) {
            return req.session.id;
        }
        
        // Fallback to IP address (less secure but better than nothing)
        return req.ip || req.connection.remoteAddress || 'anonymous';
    }
    
    /**
     * Extract CSRF token from request
     */
    extractTokenFromRequest(req) {
        // Check header first (preferred for AJAX requests)
        let token = req.get(this.config.headerName);
        
        // Check alternative headers
        if (!token) {
            for (const altHeader of this.config.alternateHeaders) {
                token = req.get(altHeader);
                if (token) break;
            }
        }
        
        // Check form body
        if (!token && req.body && req.body[this.config.fieldName]) {
            token = req.body[this.config.fieldName];
        }
        
        // Check query parameters (less secure, but sometimes necessary)
        if (!token && req.query && req.query[this.config.fieldName]) {
            token = req.query[this.config.fieldName];
        }
        
        return token;
    }
    
    /**
     * Validate request origin and referer
     */
    validateRequestOrigin(req) {
        const origin = req.get('Origin');
        const referer = req.get('Referer');
        const host = req.get('Host');
        
        if (!origin && !referer) {
            return {
                valid: false,
                reason: 'Missing Origin and Referer headers',
                code: 'ORIGIN_MISSING'
            };
        }
        
        // Validate origin
        if (origin) {
            const originHost = new URL(origin).host;
            if (originHost !== host) {
                return {
                    valid: false,
                    reason: `Origin mismatch: ${originHost} !== ${host}`,
                    code: 'ORIGIN_MISMATCH'
                };
            }
        }
        
        // Validate referer
        if (referer) {
            const refererHost = new URL(referer).host;
            if (refererHost !== host) {
                return {
                    valid: false,
                    reason: `Referer mismatch: ${refererHost} !== ${host}`,
                    code: 'REFERER_MISMATCH'
                };
            }
        }
        
        return { valid: true };
    }
    
    /**
     * Generate CSRF token middleware
     */
    generateTokenMiddleware() {
        return (req, res, next) => {
            // Skip if already has valid token and not rotating
            if (!this.config.rotateTokens && req.csrfToken) {
                return next();
            }
            
            const sessionId = this.getSessionId(req);
            const tokenData = this.generateToken(sessionId);
            
            // Store token data
            req.csrfToken = tokenData.token;
            req.csrfTokenData = tokenData;
            
            // Set cookie if using double submit cookie pattern
            if (this.config.doubleSubmitCookie) {
                res.cookie(this.config.cookieName, tokenData.token, this.config.cookieOptions);
            }
            
            // Add token to response locals for template rendering
            res.locals.csrfToken = tokenData.token;
            
            // Add helper function to response
            res.csrfToken = () => tokenData.token;
            
            // Track token generation
            this.trackTokenGeneration(req, sessionId);
            
            next();
        };
    }
    
    /**
     * CSRF validation middleware
     */
    createCSRFProtection() {
        return (req, res, next) => {
            // Skip if method doesn't require protection
            if (!this.config.protectedMethods.includes(req.method)) {
                return next();
            }
            
            // Skip if path is exempted
            if (this.config.exemptPaths.some(path => req.path.startsWith(path))) {
                return next();
            }
            
            // Skip for API endpoints with valid JWT authentication
            if (req.path.startsWith('/api/') && req.user && req.user.id) {
                // For API endpoints, we rely on JWT authentication instead of CSRF
                return next();
            }
            
            const sessionId = this.getSessionId(req);
            
            // Validate origin and referer if configured
            if (this.config.validateOrigin || this.config.validateReferer) {
                const originValidation = this.validateRequestOrigin(req);
                if (!originValidation.valid) {
                    this.trackCSRFViolation(req, 'origin_validation', originValidation.reason);
                    return res.status(403).json({
                        error: 'CSRF validation failed',
                        message: 'Request origin validation failed',
                        code: originValidation.code,
                        timestamp: new Date().toISOString()
                    });
                }
            }
            
            // Extract token from request
            const requestToken = this.extractTokenFromRequest(req);
            
            if (!requestToken) {
                this.trackCSRFViolation(req, 'token_missing', 'CSRF token not provided');
                return res.status(403).json({
                    error: 'CSRF validation failed',
                    message: 'CSRF token is required for this request',
                    code: 'CSRF_TOKEN_MISSING',
                    timestamp: new Date().toISOString()
                });
            }
            
            // Validate token
            const tokenValidation = this.validateToken(requestToken, sessionId);
            
            if (!tokenValidation.valid) {
                this.trackCSRFViolation(req, 'token_invalid', tokenValidation.reason);
                return res.status(403).json({
                    error: 'CSRF validation failed',
                    message: tokenValidation.reason,
                    code: tokenValidation.code,
                    timestamp: new Date().toISOString()
                });
            }
            
            // Double submit cookie validation
            if (this.config.doubleSubmitCookie) {
                const cookieToken = req.cookies[this.config.cookieName];
                if (!cookieToken || cookieToken !== requestToken) {
                    this.trackCSRFViolation(req, 'cookie_mismatch', 'CSRF cookie token mismatch');
                    return res.status(403).json({
                        error: 'CSRF validation failed',
                        message: 'CSRF token cookie mismatch',
                        code: 'CSRF_COOKIE_MISMATCH',
                        timestamp: new Date().toISOString()
                    });
                }
            }
            
            // Track successful validation
            this.trackCSRFValidation(req, sessionId, tokenValidation.age);
            
            // Store validation result for potential use in route handlers
            req.csrfValidated = true;
            req.csrfTokenAge = tokenValidation.age;
            
            next();
        };
    }
    
    /**
     * Express validator rules for CSRF token
     */
    createValidationRules() {
        return [
            // Validate CSRF token in body
            body(this.config.fieldName)
                .optional()
                .isLength({ min: 1 })
                .withMessage('CSRF token cannot be empty')
                .custom((value, { req }) => {
                    const sessionId = this.getSessionId(req);
                    const validation = this.validateToken(value, sessionId);
                    if (!validation.valid) {
                        throw new Error(validation.reason);
                    }
                    return true;
                }),
            
            // Validate CSRF token in cookie (for double submit pattern)
            cookie(this.config.cookieName)
                .optional()
                .isLength({ min: 1 })
                .withMessage('CSRF cookie cannot be empty')
        ];
    }
    
    /**
     * Track CSRF token generation
     */
    trackTokenGeneration(req, sessionId) {
        if (this.appInsights) {
            this.appInsights.telemetry.trackEvent('CSRF_Token_Generated', {
                sessionId: sessionId,
                path: req.path,
                method: req.method,
                userAgent: req.get('User-Agent'),
                ip: req.ip
            });
        }
    }
    
    /**
     * Track CSRF validation success
     */
    trackCSRFValidation(req, sessionId, tokenAge) {
        if (this.appInsights) {
            this.appInsights.telemetry.trackEvent('CSRF_Validation_Success', {
                sessionId: sessionId,
                path: req.path,
                method: req.method,
                tokenAge: tokenAge,
                userAgent: req.get('User-Agent'),
                ip: req.ip
            });
        }
    }
    
    /**
     * Track CSRF validation violations
     */
    trackCSRFViolation(req, violationType, reason) {
        const sessionId = this.getSessionId(req);
        
        console.warn(`🚨 CSRF violation: ${violationType} - ${reason} from ${req.ip} on ${req.path}`);
        
        if (this.appInsights) {
            this.appInsights.telemetry.trackEvent('CSRF_Violation', {
                violationType: violationType,
                reason: reason,
                sessionId: sessionId,
                path: req.path,
                method: req.method,
                userAgent: req.get('User-Agent'),
                ip: req.ip,
                origin: req.get('Origin'),
                referer: req.get('Referer'),
                severity: 'high'
            });
        }
    }
    
    /**
     * Get CSRF protection status
     */
    getCSRFStatus() {
        return {
            enabled: true,
            configuration: {
                tokenLength: this.config.tokenLength,
                tokenExpiry: this.config.tokenExpiry / 1000 / 60 + ' minutes',
                doubleSubmitCookie: this.config.doubleSubmitCookie,
                encryptTokens: this.config.encryptTokens,
                rotateTokens: this.config.rotateTokens,
                validateOrigin: this.config.validateOrigin,
                validateReferer: this.config.validateReferer,
                protectedMethods: this.config.protectedMethods,
                exemptPaths: this.config.exemptPaths.length
            },
            statistics: {
                activeTokens: this.tokenStore.size,
                encryptionEnabled: this.config.encryptTokens
            }
        };
    }
    
    /**
     * Clean up expired tokens
     */
    cleanup() {
        const now = Date.now();
        let cleanedCount = 0;
        
        for (const [key, tokenData] of this.tokenStore) {
            if (now > tokenData.expires) {
                this.tokenStore.delete(key);
                cleanedCount++;
            }
        }
        
        if (cleanedCount > 0) {
            console.log(`🧹 Cleaned up ${cleanedCount} expired CSRF tokens`);
        }
    }
    
    /**
     * Create CSRF token for API response
     */
    createTokenForResponse(req, res) {
        const sessionId = this.getSessionId(req);
        const tokenData = this.generateToken(sessionId);
        
        // Set cookie if using double submit cookie pattern
        if (this.config.doubleSubmitCookie) {
            res.cookie(this.config.cookieName, tokenData.token, this.config.cookieOptions);
        }
        
        return {
            token: tokenData.token,
            expires: new Date(tokenData.expires).toISOString(),
            headerName: this.config.headerName,
            fieldName: this.config.fieldName
        };
    }
}

module.exports = {
    CSRFProtectionService
};
