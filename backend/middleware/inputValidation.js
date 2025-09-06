// TaktMate Input Validation and Sanitization Middleware
// Comprehensive input validation, sanitization, and security protection

const { body, param, query, validationResult, matchedData } = require('express-validator');
const DOMPurify = require('isomorphic-dompurify');
const xss = require('xss');
const validator = require('validator');
const rateLimit = require('express-rate-limit');

/**
 * Input Validation and Sanitization Service
 * Provides comprehensive protection against malicious inputs
 */
class InputValidationService {
    constructor(appInsights = null) {
        this.appInsights = appInsights;
        
        // XSS filter configuration
        this.xssOptions = {
            whiteList: {
                // Allow minimal safe HTML tags for rich text
                'b': [],
                'i': [],
                'em': [],
                'strong': [],
                'p': [],
                'br': [],
                'span': ['class'],
                'div': ['class']
            },
            stripIgnoreTag: true,
            stripIgnoreTagBody: ['script', 'style', 'iframe', 'object', 'embed'],
            allowCommentTag: false,
            css: false // Disable CSS to prevent style-based attacks
        };
        
        // File upload validation limits
        this.fileValidationLimits = {
            maxFileSize: 5 * 1024 * 1024, // 5MB
            allowedMimeTypes: [
                'text/csv',
                'application/csv',
                'text/plain',
                'application/vnd.ms-excel',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            ],
            maxFilenameLength: 255,
            allowedFileExtensions: ['.csv', '.txt']
        };
        
        // Rate limiting for validation-heavy endpoints
        this.validationRateLimit = rateLimit({
            windowMs: 60000, // 1 minute
            max: 100, // 100 validation requests per minute per IP
            message: {
                error: 'Too many validation requests',
                message: 'Please slow down your requests',
                retryAfter: 60
            },
            standardHeaders: true,
            legacyHeaders: false
        });
        
        console.log('🛡️ Input Validation Service initialized with comprehensive security');
    }
    
    /**
     * Generic input sanitization
     */
    sanitizeInput(input, options = {}) {
        if (typeof input !== 'string') {
            return input;
        }
        
        let sanitized = input;
        
        // Basic HTML entity encoding
        if (options.encodeHtml !== false) {
            sanitized = validator.escape(sanitized);
        }
        
        // XSS protection
        if (options.xssProtection !== false) {
            sanitized = xss(sanitized, this.xssOptions);
        }
        
        // DOMPurify for additional HTML sanitization
        if (options.domPurify !== false) {
            sanitized = DOMPurify.sanitize(sanitized, {
                ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br'],
                ALLOWED_ATTR: [],
                KEEP_CONTENT: true
            });
        }
        
        // Trim whitespace
        if (options.trim !== false) {
            sanitized = sanitized.trim();
        }
        
        // Remove null bytes
        sanitized = sanitized.replace(/\0/g, '');
        
        // Normalize unicode
        if (options.normalizeUnicode !== false) {
            sanitized = sanitized.normalize('NFKC');
        }
        
        return sanitized;
    }
    
    /**
     * Validate and sanitize CSV file content
     */
    validateCsvContent(content, filename) {
        const errors = [];
        const warnings = [];
        
        // Check content length
        if (!content || content.length === 0) {
            errors.push('CSV content is empty');
            return { isValid: false, errors, warnings, sanitizedContent: '' };
        }
        
        if (content.length > 10 * 1024 * 1024) { // 10MB limit
            errors.push('CSV content exceeds maximum size limit (10MB)');
        }
        
        // Basic CSV format validation
        const lines = content.split('\n');
        if (lines.length < 2) {
            errors.push('CSV must contain at least a header row and one data row');
        }
        
        // Check for suspicious patterns
        const suspiciousPatterns = [
            /<script[\s\S]*?<\/script>/gi,
            /<iframe[\s\S]*?<\/iframe>/gi,
            /javascript:/gi,
            /data:text\/html/gi,
            /vbscript:/gi,
            /on\w+\s*=/gi // Event handlers like onclick, onload
        ];
        
        let hasSuspiciousContent = false;
        suspiciousPatterns.forEach(pattern => {
            if (pattern.test(content)) {
                hasSuspiciousContent = true;
                warnings.push(`Potentially malicious content detected: ${pattern.source}`);
            }
        });
        
        // Sanitize CSV content
        let sanitizedContent = content;
        
        // Remove potential script tags and dangerous content
        sanitizedContent = sanitizedContent.replace(/<script[\s\S]*?<\/script>/gi, '');
        sanitizedContent = sanitizedContent.replace(/<iframe[\s\S]*?<\/iframe>/gi, '');
        sanitizedContent = sanitizedContent.replace(/javascript:/gi, '');
        sanitizedContent = sanitizedContent.replace(/vbscript:/gi, '');
        
        // Normalize line endings
        sanitizedContent = sanitizedContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        
        // Remove null bytes
        sanitizedContent = sanitizedContent.replace(/\0/g, '');
        
        // Validate CSV structure
        const sanitizedLines = sanitizedContent.split('\n').filter(line => line.trim());
        if (sanitizedLines.length > 0) {
            const headerCols = sanitizedLines[0].split(',').length;
            let structureValid = true;
            
            for (let i = 1; i < Math.min(sanitizedLines.length, 10); i++) { // Check first 10 rows
                const cols = sanitizedLines[i].split(',').length;
                if (Math.abs(cols - headerCols) > headerCols * 0.2) { // Allow 20% variance
                    structureValid = false;
                    warnings.push(`Row ${i + 1} has inconsistent column count (${cols} vs expected ~${headerCols})`);
                }
            }
        }
        
        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            sanitizedContent,
            hasSuspiciousContent,
            originalSize: content.length,
            sanitizedSize: sanitizedContent.length
        };
    }
    
    /**
     * File upload validation
     */
    validateFileUpload(file) {
        const errors = [];
        const warnings = [];
        
        if (!file) {
            errors.push('No file provided');
            return { isValid: false, errors, warnings };
        }
        
        // Check file size
        if (file.size > this.fileValidationLimits.maxFileSize) {
            errors.push(`File size (${Math.round(file.size / 1024 / 1024)}MB) exceeds maximum limit (${Math.round(this.fileValidationLimits.maxFileSize / 1024 / 1024)}MB)`);
        }
        
        // Check MIME type
        if (!this.fileValidationLimits.allowedMimeTypes.includes(file.mimetype)) {
            errors.push(`File type '${file.mimetype}' is not allowed. Allowed types: ${this.fileValidationLimits.allowedMimeTypes.join(', ')}`);
        }
        
        // Check filename
        if (!file.originalname || file.originalname.length > this.fileValidationLimits.maxFilenameLength) {
            errors.push(`Filename is invalid or too long (max ${this.fileValidationLimits.maxFilenameLength} characters)`);
        }
        
        // Check file extension
        const fileExt = file.originalname ? file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.')) : '';
        if (!this.fileValidationLimits.allowedFileExtensions.includes(fileExt)) {
            errors.push(`File extension '${fileExt}' is not allowed. Allowed extensions: ${this.fileValidationLimits.allowedFileExtensions.join(', ')}`);
        }
        
        // Check for suspicious filename patterns
        const suspiciousFilenamePatterns = [
            /\.\./,           // Directory traversal
            /[<>:"|?*]/,      // Invalid filename characters
            /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i, // Windows reserved names
            /\.(exe|bat|cmd|scr|pif|vbs|js|jar|com|pif)$/i // Executable extensions
        ];
        
        suspiciousFilenamePatterns.forEach(pattern => {
            if (pattern.test(file.originalname)) {
                errors.push(`Filename contains suspicious patterns: ${file.originalname}`);
            }
        });
        
        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            sanitizedFilename: this.sanitizeFilename(file.originalname)
        };
    }
    
    /**
     * Sanitize filename
     */
    sanitizeFilename(filename) {
        if (!filename) return 'untitled.csv';
        
        // Remove dangerous characters
        let sanitized = filename.replace(/[<>:"|?*]/g, '');
        
        // Remove directory traversal attempts
        sanitized = sanitized.replace(/\.\./g, '');
        
        // Limit length
        if (sanitized.length > this.fileValidationLimits.maxFilenameLength) {
            const ext = sanitized.substring(sanitized.lastIndexOf('.'));
            const name = sanitized.substring(0, sanitized.lastIndexOf('.'));
            sanitized = name.substring(0, this.fileValidationLimits.maxFilenameLength - ext.length) + ext;
        }
        
        // Ensure it has a valid extension
        if (!sanitized.includes('.')) {
            sanitized += '.csv';
        }
        
        return sanitized;
    }
    
    /**
     * Chat message validation and sanitization
     */
    validateChatMessage(message) {
        const errors = [];
        const warnings = [];
        
        if (!message || typeof message !== 'string') {
            errors.push('Message is required and must be a string');
            return { isValid: false, errors, warnings, sanitizedMessage: '' };
        }
        
        // Length validation
        if (message.length > 10000) { // 10k character limit
            errors.push('Message exceeds maximum length (10,000 characters)');
        }
        
        if (message.trim().length === 0) {
            errors.push('Message cannot be empty');
        }
        
        // Check for spam patterns
        const spamPatterns = [
            /(.)\1{50,}/g,        // Repeated characters (50+ times)
            /(https?:\/\/[^\s]+){5,}/g, // Multiple URLs
            /[A-Z]{20,}/g,        // Excessive caps
            /[$€£¥₹]{3,}/g        // Multiple currency symbols
        ];
        
        spamPatterns.forEach(pattern => {
            if (pattern.test(message)) {
                warnings.push('Message contains potential spam patterns');
            }
        });
        
        // Sanitize message
        let sanitizedMessage = this.sanitizeInput(message, {
            xssProtection: true,
            domPurify: true,
            encodeHtml: false, // Keep readable for chat
            trim: true
        });
        
        // Additional chat-specific sanitization
        sanitizedMessage = sanitizedMessage.replace(/\n{3,}/g, '\n\n'); // Limit consecutive newlines
        
        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            sanitizedMessage,
            originalLength: message.length,
            sanitizedLength: sanitizedMessage.length
        };
    }
    
    /**
     * Track validation events
     */
    trackValidationEvent(type, result, metadata = {}) {
        if (!this.appInsights) return;
        
        this.appInsights.telemetry.trackEvent('Input_Validation', {
            validationType: type,
            isValid: result.isValid,
            errorCount: result.errors ? result.errors.length : 0,
            warningCount: result.warnings ? result.warnings.length : 0,
            ...metadata
        });
        
        if (!result.isValid && result.errors) {
            result.errors.forEach(error => {
                this.appInsights.telemetry.trackEvent('Validation_Error', {
                    validationType: type,
                    error: error,
                    ...metadata
                });
            });
        }
    }
    
    /**
     * Express middleware for request validation
     */
    createValidationMiddleware(validationRules) {
        // Handle both array and object formats
        let rules = [];
        if (Array.isArray(validationRules)) {
            rules = validationRules;
        } else if (validationRules && typeof validationRules === 'object') {
            // Convert object format to array of validation middleware
            rules = [];
            if (validationRules.body) {
                rules.push(...this.createBodyValidation(validationRules.body));
            }
            if (validationRules.query) {
                rules.push(...this.createQueryValidation(validationRules.query));
            }
            if (validationRules.params) {
                rules.push(...this.createParamsValidation(validationRules.params));
            }
        }
        
        return [
            // Apply rate limiting for validation-heavy requests
            this.validationRateLimit,
            
            // Apply validation rules
            ...rules,
            
            // Handle validation results
            (req, res, next) => {
                const errors = validationResult(req);
                
                if (!errors.isEmpty()) {
                    const validationErrors = errors.array();
                    
                    // Track validation failure
                    this.trackValidationEvent('middleware_validation', {
                        isValid: false,
                        errors: validationErrors.map(e => e.msg)
                    }, {
                        endpoint: req.path,
                        method: req.method,
                        userAgent: req.get('User-Agent')
                    });
                    
                    return res.status(400).json({
                        error: 'Validation failed',
                        message: 'Please check your input and try again',
                        details: validationErrors.map(error => ({
                            field: error.param,
                            message: error.msg,
                            value: error.value
                        })),
                        code: 'VALIDATION_ERROR'
                    });
                }
                
                // Get sanitized data
                const sanitizedData = matchedData(req, { includeOptionals: true });
                req.validatedData = sanitizedData;
                
                next();
            }
        ];
    }
}

/**
 * Common validation rules
 */
const ValidationRules = {
    // File upload validation
    fileUpload: [
        body('filename')
            .optional()
            .isLength({ max: 255 })
            .withMessage('Filename must be less than 255 characters')
            .matches(/^[a-zA-Z0-9._-]+$/)
            .withMessage('Filename contains invalid characters'),
    ],
    
    // Chat message validation
    chatMessage: [
        body('message')
            .notEmpty()
            .withMessage('Message is required')
            .isLength({ min: 1, max: 10000 })
            .withMessage('Message must be between 1 and 10,000 characters')
            .customSanitizer((value) => {
                return DOMPurify.sanitize(value, {
                    ALLOWED_TAGS: [],
                    ALLOWED_ATTR: [],
                    KEEP_CONTENT: true
                });
            })
            .trim(),
            
        body('fileId')
            .optional()
            .isUUID()
            .withMessage('File ID must be a valid UUID')
    ],
    
    // User profile validation
    userProfile: [
        body('name')
            .optional()
            .isLength({ min: 1, max: 100 })
            .withMessage('Name must be between 1 and 100 characters')
            .matches(/^[a-zA-Z0-9\s._-]+$/)
            .withMessage('Name contains invalid characters')
            .customSanitizer((value) => validator.escape(value.trim())),
            
        body('email')
            .optional()
            .isEmail()
            .withMessage('Invalid email format')
            .normalizeEmail(),
            
        body('preferences')
            .optional()
            .isJSON()
            .withMessage('Preferences must be valid JSON')
            .customSanitizer((value) => {
                try {
                    const parsed = JSON.parse(value);
                    return JSON.stringify(parsed); // Re-stringify to ensure clean JSON
                } catch {
                    return '{}';
                }
            })
    ],
    
    // API parameter validation
    apiParams() {
        return [
        param('id')
            .isUUID()
            .withMessage('ID must be a valid UUID'),
            
        query('limit')
            .optional()
            .isInt({ min: 1, max: 100 })
            .withMessage('Limit must be between 1 and 100')
            .toInt(),
            
        query('offset')
            .optional()
            .isInt({ min: 0 })
            .withMessage('Offset must be a non-negative integer')
            .toInt(),
            
        query('search')
            .optional()
            .isLength({ max: 500 })
            .withMessage('Search query must be less than 500 characters')
            .customSanitizer((value) => validator.escape(value.trim()))
        ];
    }
    
    // File operation validation
    fileOperation() {
        return [
        param('fileId')
            .isUUID()
            .withMessage('File ID must be a valid UUID'),
            
        body('operation')
            .isIn(['analyze', 'delete', 'download', 'rename'])
            .withMessage('Invalid operation type'),
            
        body('parameters')
            .optional()
            .isJSON()
            .withMessage('Parameters must be valid JSON')
        ];
    }
    
    // Token refresh validation
    tokenRefresh() {
        return [
        body('refreshToken')
            .notEmpty()
            .withMessage('Refresh token is required')
            .isLength({ min: 10, max: 10000 })
            .withMessage('Refresh token must be between 10 and 10000 characters')
            .trim(),
            
        body('scope')
            .optional()
            .isLength({ max: 1000 })
            .withMessage('Scope must not exceed 1000 characters')
            .trim()
        ];
    }
    
    // Token validation
    tokenValidation() {
        return [
        body('token')
            .notEmpty()
            .withMessage('Token is required')
            .isLength({ min: 10, max: 10000 })
            .withMessage('Token must be between 10 and 10000 characters')
            .trim(),
            
        body('tokenType')
            .optional()
            .isIn(['access_token', 'id_token', 'refresh_token'])
            .withMessage('Token type must be access_token, id_token, or refresh_token')
            .trim()
        ];
    }
    
    /**
     * Create body validation rules from object
     */
    createBodyValidation(bodyRules) {
        const rules = [];
        for (const [field, rule] of Object.entries(bodyRules)) {
            if (rule.required) {
                rules.push(body(field).notEmpty().withMessage(`${field} is required`));
            }
            if (rule.isEmail) {
                rules.push(body(field).isEmail().withMessage(`${field} must be a valid email`));
            }
            if (rule.isLength) {
                rules.push(body(field).isLength(rule.isLength).withMessage(`${field} length is invalid`));
            }
            if (rule.custom) {
                rules.push(body(field).custom(rule.custom));
            }
        }
        return rules;
    }
    
    /**
     * Create query validation rules from object
     */
    createQueryValidation(queryRules) {
        const rules = [];
        for (const [field, rule] of Object.entries(queryRules)) {
            if (rule.required) {
                rules.push(query(field).notEmpty().withMessage(`${field} is required`));
            }
            if (rule.isDate) {
                rules.push(query(field).isISO8601().withMessage(`${field} must be a valid date`));
            }
            if (rule.custom) {
                rules.push(query(field).custom(rule.custom));
            }
        }
        return rules;
    }
    
    /**
     * Create params validation rules from object
     */
    createParamsValidation(paramsRules) {
        const rules = [];
        for (const [field, rule] of Object.entries(paramsRules)) {
            if (rule.required) {
                rules.push(param(field).notEmpty().withMessage(`${field} is required`));
            }
            if (rule.isUUID) {
                rules.push(param(field).isUUID().withMessage(`${field} must be a valid UUID`));
            }
            if (rule.custom) {
                rules.push(param(field).custom(rule.custom));
            }
        }
        return rules;
    }
};

/**
 * Security middleware for additional protection
 */
const SecurityMiddleware = {
    // Prevent parameter pollution
    preventParameterPollution: (req, res, next) => {
        // Convert array parameters to single values (take first)
        Object.keys(req.query).forEach(key => {
            if (Array.isArray(req.query[key])) {
                req.query[key] = req.query[key][0];
            }
        });
        
        Object.keys(req.body || {}).forEach(key => {
            if (Array.isArray(req.body[key])) {
                req.body[key] = req.body[key][0];
            }
        });
        
        next();
    },
    
    // Content type validation
    validateContentType: (allowedTypes = ['application/json', 'multipart/form-data']) => {
        return (req, res, next) => {
            if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
                const contentType = req.get('Content-Type');
                const isAllowed = allowedTypes.some(type => 
                    contentType && contentType.toLowerCase().includes(type.toLowerCase())
                );
                
                if (!isAllowed) {
                    return res.status(415).json({
                        error: 'Unsupported Media Type',
                        message: `Content-Type must be one of: ${allowedTypes.join(', ')}`,
                        code: 'UNSUPPORTED_MEDIA_TYPE'
                    });
                }
            }
            next();
        };
    },
    
    // Request size validation
    validateRequestSize: (maxSize = 10 * 1024 * 1024) => { // 10MB default
        return (req, res, next) => {
            const contentLength = req.get('Content-Length');
            if (contentLength && parseInt(contentLength) > maxSize) {
                return res.status(413).json({
                    error: 'Payload Too Large',
                    message: `Request size exceeds maximum limit (${Math.round(maxSize / 1024 / 1024)}MB)`,
                    code: 'PAYLOAD_TOO_LARGE'
                });
            }
            next();
        };
    }
};

/**
 * Common validation rules
 */
const ValidationRules = {
    tokenRefresh: () => [
        body('refresh_token').notEmpty().withMessage('Refresh token is required')
    ],
    
    tokenValidation: () => [
        body('access_token').notEmpty().withMessage('Access token is required')
    ],
    
    chatMessage: [
        body('message').notEmpty().withMessage('Message is required'),
        body('message').isLength({ max: 1000 }).withMessage('Message too long')
    ]
};

module.exports = {
    InputValidationService,
    ValidationRules,
    SecurityMiddleware
};
