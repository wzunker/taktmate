// TaktMate CORS Configuration for staging Environment
// Generated on 2024-01-15T16:30:00Z

const corsConfiguration = {
    // Frontend origins allowed to make requests to the backend
    allowedOrigins: [
        'https://staging.taktconnect.com',
        // Development origins (always included for testing)
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        // Environment variable override
        process.env.FRONTEND_URL,
        process.env.CORS_ORIGIN_OVERRIDE
    ].filter(Boolean).filter((value, index, self) => self.indexOf(value) === index), // Remove duplicates

    // Backend API URLs (for reference and validation)
    backendUrls: [
        'https://api-staging.taktconnect.com',
        'https://taktmate-api-staging.azurewebsites.net',
    ],

    // CORS options for Express.js cors middleware
    corsOptions: {
        origin: function(origin, callback) {
            // Allow requests with no origin (mobile apps, Postman, etc.)
            if (!origin) {
                return callback(null, true);
            }
            
            // Check if origin is in allowed list
            if (corsConfiguration.allowedOrigins.includes(origin)) {
                return callback(null, true);
            }
            
            // For development, be more permissive
            if (process.env.NODE_ENV === 'development') {
                console.log('CORS: Allowing origin in development mode:', origin);
                return callback(null, true);
            }
            
            // Log blocked origin for debugging
            console.warn('CORS: Blocked origin:', origin);
            return callback(new Error('Not allowed by CORS policy'), false);
        },
        credentials: true, // Allow cookies and authorization headers
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD', 'PATCH'],
        allowedHeaders: [
            'Content-Type',
            'Authorization',
            'X-Requested-With',
            'Accept',
            'Origin',
            'Cache-Control',
            'X-File-Name',
            'X-File-Size',
            'X-File-Type',
            // Azure AD B2C headers
            'X-MS-CLIENT-PRINCIPAL-ID',
            'X-MS-CLIENT-PRINCIPAL-NAME',
            'X-MS-CLIENT-PRINCIPAL',
            // Custom application headers
            'X-API-Version',
            'X-Request-ID',
            'X-Correlation-ID'
        ],
        exposedHeaders: [
            'X-Total-Count',
            'X-Page-Count',
            'X-Request-ID',
            'X-Correlation-ID',
            'X-Rate-Limit-Limit',
            'X-Rate-Limit-Remaining',
            'X-Rate-Limit-Reset'
        ],
        optionsSuccessStatus: 200, // Some legacy browsers (IE11, various SmartTVs) choke on 204
        maxAge: 86400 // 24 hours - cache preflight response
    },

    // Environment-specific settings
    environment: 'staging',
    domain: 'taktconnect.com',
    
    // Security settings
    security: {
        // Strict origin checking for production
        strictOriginCheck: false,
        
        // Log CORS violations
        logViolations: true,
        
        // Rate limiting for preflight requests
        preflightRateLimit: {
            windowMs: 60000, // 1 minute
            max: 1000 // requests per window
        }
    },

    // Validation function
    validate: function() {
        const requiredOrigins = corsConfiguration.allowedOrigins.filter(origin => origin && !origin.includes('localhost'));
        
        if (requiredOrigins.length === 0) {
            console.warn('CORS: No production origins configured');
            return false;
        }
        
        console.log('CORS: Configuration validated successfully');
        console.log('CORS: Allowed origins:', requiredOrigins.length);
        
        return true;
    }
};

module.exports = corsConfiguration;
