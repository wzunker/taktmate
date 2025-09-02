const sql = require('mssql');
require('dotenv').config();

/**
 * Database configuration with comprehensive environment variable support
 */
class DatabaseConfig {
  constructor() {
    this.environment = process.env.NODE_ENV || 'development';
    this.config = this.buildConfig();
  }

  /**
   * Build database configuration based on environment variables
   */
  buildConfig() {
    // Validate required environment variables
    this.validateEnvironmentVariables();

    // Base configuration
    const baseConfig = {
      user: process.env.AZURE_SQL_USER,
      password: process.env.AZURE_SQL_PASSWORD,
      server: process.env.AZURE_SQL_SERVER,
      database: process.env.AZURE_SQL_DATABASE,
      options: {
        encrypt: this.parseBoolean(process.env.AZURE_SQL_ENCRYPT, true),
        enableArithAbort: this.parseBoolean(process.env.AZURE_SQL_ENABLE_ARITH_ABORT, true),
        trustServerCertificate: this.parseBoolean(process.env.AZURE_SQL_TRUST_SERVER_CERT, false),
        connectTimeout: this.parseInteger(process.env.AZURE_SQL_CONNECT_TIMEOUT, 30000),
        requestTimeout: this.parseInteger(process.env.AZURE_SQL_REQUEST_TIMEOUT, 30000),
        cancelTimeout: this.parseInteger(process.env.AZURE_SQL_CANCEL_TIMEOUT, 5000),
        packetSize: this.parseInteger(process.env.AZURE_SQL_PACKET_SIZE, 4096),
        useUTC: this.parseBoolean(process.env.AZURE_SQL_USE_UTC, true)
      },
      pool: {
        max: this.parseInteger(process.env.AZURE_SQL_POOL_MAX, 10),
        min: this.parseInteger(process.env.AZURE_SQL_POOL_MIN, 0),
        idleTimeoutMillis: this.parseInteger(process.env.AZURE_SQL_POOL_IDLE_TIMEOUT, 30000),
        acquireTimeoutMillis: this.parseInteger(process.env.AZURE_SQL_POOL_ACQUIRE_TIMEOUT, 60000),
        createTimeoutMillis: this.parseInteger(process.env.AZURE_SQL_POOL_CREATE_TIMEOUT, 30000),
        destroyTimeoutMillis: this.parseInteger(process.env.AZURE_SQL_POOL_DESTROY_TIMEOUT, 5000),
        reapIntervalMillis: this.parseInteger(process.env.AZURE_SQL_POOL_REAP_INTERVAL, 1000),
        createRetryIntervalMillis: this.parseInteger(process.env.AZURE_SQL_POOL_CREATE_RETRY_INTERVAL, 200)
      },
      connectionTimeout: this.parseInteger(process.env.AZURE_SQL_CONNECTION_TIMEOUT, 30000),
      requestTimeout: this.parseInteger(process.env.AZURE_SQL_REQUEST_TIMEOUT, 30000)
    };

    // Environment-specific overrides
    return this.applyEnvironmentOverrides(baseConfig);
  }

  /**
   * Apply environment-specific configuration overrides
   */
  applyEnvironmentOverrides(config) {
    switch (this.environment) {
      case 'test':
        return {
          ...config,
          database: process.env.AZURE_SQL_TEST_DATABASE || `${config.database}_test`,
          pool: {
            ...config.pool,
            max: 5, // Smaller pool for tests
            min: 0
          },
          options: {
            ...config.options,
            connectTimeout: 10000, // Faster timeouts for tests
            requestTimeout: 10000
          }
        };
        
      case 'development':
        return {
          ...config,
          pool: {
            ...config.pool,
            max: 5, // Smaller pool for development
            min: 1
          },
          options: {
            ...config.options,
            trustServerCertificate: this.parseBoolean(process.env.AZURE_SQL_TRUST_SERVER_CERT, true) // More lenient for dev
          }
        };
        
      case 'production':
        return {
          ...config,
          pool: {
            ...config.pool,
            max: this.parseInteger(process.env.AZURE_SQL_POOL_MAX, 20), // Larger pool for production
            min: this.parseInteger(process.env.AZURE_SQL_POOL_MIN, 2)
          },
          options: {
            ...config.options,
            encrypt: true, // Always encrypt in production
            trustServerCertificate: false // Never trust self-signed in production
          }
        };
        
      default:
        return config;
    }
  }

  /**
   * Validate required environment variables
   */
  validateEnvironmentVariables() {
    const required = [
      'AZURE_SQL_USER',
      'AZURE_SQL_PASSWORD', 
      'AZURE_SQL_SERVER',
      'AZURE_SQL_DATABASE'
    ];

    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    // Validate server format
    if (process.env.AZURE_SQL_SERVER && !process.env.AZURE_SQL_SERVER.includes('.database.windows.net')) {
      console.warn('⚠️  AZURE_SQL_SERVER should include .database.windows.net for Azure SQL Database');
    }

    // Validate password complexity
    if (process.env.AZURE_SQL_PASSWORD && process.env.AZURE_SQL_PASSWORD.length < 8) {
      console.warn('⚠️  AZURE_SQL_PASSWORD should be at least 8 characters long');
    }
  }

  /**
   * Parse boolean environment variable
   */
  parseBoolean(value, defaultValue = false) {
    if (value === undefined || value === null) {
      return defaultValue;
    }
    return value.toLowerCase() === 'true' || value === '1';
  }

  /**
   * Parse integer environment variable
   */
  parseInteger(value, defaultValue = 0) {
    if (value === undefined || value === null) {
      return defaultValue;
    }
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  }

  /**
   * Get configuration object
   */
  getConfig() {
    return this.config;
  }

  /**
   * Get configuration summary for logging
   */
  getConfigSummary() {
    return {
      environment: this.environment,
      server: this.config.server,
      database: this.config.database,
      user: this.config.user,
      pool: {
        max: this.config.pool.max,
        min: this.config.pool.min
      },
      options: {
        encrypt: this.config.options.encrypt,
        trustServerCertificate: this.config.options.trustServerCertificate
      }
    };
  }
}

// Initialize configuration
const dbConfig = new DatabaseConfig();
const config = dbConfig.getConfig();

// Connection pool
let pool;

/**
 * Initialize database connection pool
 */
async function initializeDatabase() {
  try {
    console.log('🔌 Initializing Azure SQL Database connection...');
    
    // Log configuration summary (without sensitive data)
    const configSummary = dbConfig.getConfigSummary();
    console.log('📋 Database Configuration:');
    console.log(`   Environment: ${configSummary.environment}`);
    console.log(`   Server: ${configSummary.server}`);
    console.log(`   Database: ${configSummary.database}`);
    console.log(`   User: ${configSummary.user}`);
    console.log(`   Pool: ${configSummary.pool.min}-${configSummary.pool.max} connections`);
    console.log(`   Encryption: ${configSummary.options.encrypt ? 'Enabled' : 'Disabled'}`);
    
    // Validate configuration before connecting
    await validateDatabaseConfig();
    
    pool = await sql.connect(config);
    console.log('✅ Connected to Azure SQL Database successfully');
    
    // Log connection pool status
    if (pool && pool.pool) {
      console.log(`📊 Connection pool initialized: ${pool.pool.numUsed()}/${pool.pool.numFree()} active/free connections`);
    }
    
    return pool;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    
    // Provide helpful error context
    if (error.code === 'ELOGIN') {
      console.error('💡 Check your AZURE_SQL_USER and AZURE_SQL_PASSWORD environment variables');
    } else if (error.code === 'ENOTFOUND') {
      console.error('💡 Check your AZURE_SQL_SERVER environment variable');
    } else if (error.code === 'ETIMEOUT') {
      console.error('💡 Check your network connection and Azure SQL firewall settings');
    }
    
    throw error;
  }
}

/**
 * Get database connection pool
 */
function getPool() {
  if (!pool) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return pool;
}

/**
 * Execute a query with parameters
 */
async function executeQuery(query, parameters = {}) {
  try {
    const pool = getPool();
    const request = pool.request();
    
    // Add parameters to request
    Object.keys(parameters).forEach(key => {
      request.input(key, parameters[key]);
    });
    
    const result = await request.query(query);
    return result;
  } catch (error) {
    console.error('Query execution error:', error);
    throw error;
  }
}

/**
 * Close database connection
 */
async function closeDatabase() {
  try {
    if (pool) {
      await pool.close();
      pool = null;
      console.log('Database connection closed');
    }
  } catch (error) {
    console.error('Error closing database connection:', error);
  }
}

/**
 * Test database connectivity
 */
async function testConnection() {
  try {
    const result = await executeQuery('SELECT 1 as test');
    console.log('✅ Database connectivity test passed');
    return result;
  } catch (error) {
    console.error('❌ Database connectivity test failed:', error);
    throw error;
  }
}

/**
 * Validate database configuration
 */
async function validateDatabaseConfig() {
  // Check if all required environment variables are present
  const required = ['AZURE_SQL_USER', 'AZURE_SQL_PASSWORD', 'AZURE_SQL_SERVER', 'AZURE_SQL_DATABASE'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  
  // Validate server format for Azure SQL Database
  if (!process.env.AZURE_SQL_SERVER.includes('.database.windows.net')) {
    console.warn('⚠️  AZURE_SQL_SERVER should include .database.windows.net for Azure SQL Database');
  }
  
  // Basic validation passed
  return true;
}

/**
 * Get current database configuration (safe for logging)
 */
function getDatabaseConfig() {
  return dbConfig.getConfigSummary();
}

/**
 * Get connection pool statistics
 */
function getPoolStatistics() {
  if (!pool || !pool.pool) {
    return {
      connected: false,
      message: 'No active connection pool'
    };
  }
  
  try {
    return {
      connected: true,
      totalConnections: pool.pool.totalCount(),
      usedConnections: pool.pool.numUsed(),
      freeConnections: pool.pool.numFree(),
      pendingAcquires: pool.pool.numPendingAcquires(),
      pendingCreates: pool.pool.numPendingCreates()
    };
  } catch (error) {
    return {
      connected: false,
      error: error.message
    };
  }
}

/**
 * Validate environment variables and provide setup guidance
 */
function validateEnvironmentSetup() {
  const issues = [];
  const warnings = [];
  
  // Check required variables
  const required = [
    { key: 'AZURE_SQL_USER', description: 'Database username' },
    { key: 'AZURE_SQL_PASSWORD', description: 'Database password' },
    { key: 'AZURE_SQL_SERVER', description: 'Database server (e.g., server.database.windows.net)' },
    { key: 'AZURE_SQL_DATABASE', description: 'Database name' }
  ];
  
  required.forEach(({ key, description }) => {
    if (!process.env[key]) {
      issues.push(`${key}: ${description}`);
    }
  });
  
  // Check optional but recommended variables
  const recommended = [
    { key: 'AZURE_SQL_POOL_MAX', description: 'Maximum connection pool size', default: '10' },
    { key: 'AZURE_SQL_POOL_MIN', description: 'Minimum connection pool size', default: '0' },
    { key: 'NODE_ENV', description: 'Environment (development, test, production)', default: 'development' }
  ];
  
  recommended.forEach(({ key, description, default: defaultValue }) => {
    if (!process.env[key]) {
      warnings.push(`${key}: ${description} (using default: ${defaultValue})`);
    }
  });
  
  // Validate specific values
  if (process.env.AZURE_SQL_SERVER && !process.env.AZURE_SQL_SERVER.includes('.database.windows.net')) {
    warnings.push('AZURE_SQL_SERVER: Should include .database.windows.net for Azure SQL Database');
  }
  
  if (process.env.AZURE_SQL_PASSWORD && process.env.AZURE_SQL_PASSWORD.length < 8) {
    warnings.push('AZURE_SQL_PASSWORD: Should be at least 8 characters long');
  }
  
  return {
    valid: issues.length === 0,
    issues,
    warnings,
    environment: process.env.NODE_ENV || 'development'
  };
}

/**
 * Create environment file template
 */
function generateEnvironmentTemplate() {
  return `# Azure SQL Database Configuration
AZURE_SQL_SERVER=your-server.database.windows.net
AZURE_SQL_DATABASE=TaktMateDB
AZURE_SQL_USER=your-username
AZURE_SQL_PASSWORD=your-secure-password

# Optional: Connection Pool Settings
AZURE_SQL_POOL_MAX=10
AZURE_SQL_POOL_MIN=0
AZURE_SQL_POOL_IDLE_TIMEOUT=30000

# Optional: Connection Settings
AZURE_SQL_ENCRYPT=true
AZURE_SQL_TRUST_SERVER_CERT=false
AZURE_SQL_CONNECTION_TIMEOUT=30000
AZURE_SQL_REQUEST_TIMEOUT=30000

# Optional: Test Database
AZURE_SQL_TEST_DATABASE=TaktMateDB_test

# Application Environment
NODE_ENV=development

# Other Configuration (from previous setup)
OPENAI_API_KEY=your-azure-openai-api-key
DEBUG_PROMPTS=false
PORT=3001
JWT_SECRET=your-jwt-secret
SESSION_SECRET=your-session-secret`;
}

module.exports = {
  initializeDatabase,
  getPool,
  executeQuery,
  closeDatabase,
  testConnection,
  validateDatabaseConfig,
  getDatabaseConfig,
  getPoolStatistics,
  validateEnvironmentSetup,
  generateEnvironmentTemplate,
  sql // Export sql types for model definitions
};
