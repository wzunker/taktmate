/**
 * File Management Routes
 * 
 * RESTful API endpoints for Azure Blob Storage file operations:
 * - List user's files
 * - Generate SAS tokens for secure upload/download
 * - Delete files
 * - Enforce 200MB per-user quota
 * 
 * All endpoints require authentication via Azure Static Web Apps
 */

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const {
  listUserFiles,
  sumBytes,
  sasForUpload,
  sasForRead,
  deleteBlob,
  healthCheck
} = require('../services/storage');

const router = express.Router();

// Rate limiting for SAS token generation (prevent abuse)
const rateLimitMap = new Map(); // In-memory rate limiting (consider Redis for production)
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute window
const RATE_LIMIT_MAX_REQUESTS = 30; // Max 30 SAS requests per minute per user

/**
 * Simple in-memory rate limiter for SAS token generation
 * @param {string} userId - User ID to check rate limit for
 * @returns {boolean} - True if request is allowed, false if rate limited
 */
function checkRateLimit(userId) {
  const now = Date.now();
  const userKey = `sas_${userId}`;
  
  if (!rateLimitMap.has(userKey)) {
    rateLimitMap.set(userKey, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }
  
  const userLimit = rateLimitMap.get(userKey);
  
  // Reset if window has passed
  if (now > userLimit.resetTime) {
    rateLimitMap.set(userKey, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }
  
  // Check if under limit
  if (userLimit.count < RATE_LIMIT_MAX_REQUESTS) {
    userLimit.count++;
    return true;
  }
  
  return false; // Rate limited
}

// Clean up old rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitMap.entries()) {
    if (now > value.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}, 5 * 60 * 1000); // Clean up every 5 minutes

// Apply authentication middleware to all routes
router.use(requireAuth);

// Constants
const MAX_STORAGE_BYTES = 200 * 1024 * 1024; // 200MB per user
const MAX_FILENAME_LENGTH = 255;
const ALLOWED_CONTENT_TYPES = [
  'text/csv',
  'application/csv',
  'text/plain',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
];

/**
 * Validate file name for security and Azure compliance
 * Enhanced security validation to prevent various attack vectors
 * @param {string} fileName - File name to validate
 * @returns {Object} - {valid: boolean, error?: string}
 */
function validateFileName(fileName) {
  if (!fileName || typeof fileName !== 'string') {
    return { valid: false, error: 'File name is required and must be a string' };
  }

  // Trim whitespace and check minimum length
  fileName = fileName.trim();
  if (fileName.length === 0) {
    return { valid: false, error: 'File name cannot be empty' };
  }

  if (fileName.length > MAX_FILENAME_LENGTH) {
    return { valid: false, error: `File name too long (max ${MAX_FILENAME_LENGTH} characters)` };
  }

  // Check for path traversal attempts (enhanced)
  if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
    return { valid: false, error: 'File name contains path traversal characters' };
  }

  // Check for reserved names and dangerous characters (enhanced)
  const invalidChars = /[<>:"|?*\x00-\x1f\x7f-\x9f]/; // Added control characters
  if (invalidChars.test(fileName)) {
    return { valid: false, error: 'File name contains invalid or control characters' };
  }

  // Check for Windows reserved names (case-insensitive)
  const reservedNames = [
    'CON', 'PRN', 'AUX', 'NUL',
    'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
    'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
  ];
  
  const nameWithoutExt = fileName.split('.')[0].toUpperCase();
  if (reservedNames.includes(nameWithoutExt)) {
    return { valid: false, error: 'File name uses a reserved system name' };
  }

  // Check for hidden files or files starting with special characters
  if (fileName.startsWith('.') || fileName.startsWith('-') || fileName.startsWith('_')) {
    return { valid: false, error: 'File name cannot start with special characters' };
  }

  // Ensure file has a valid extension
  if (!fileName.includes('.') || fileName.endsWith('.')) {
    return { valid: false, error: 'File name must have a valid extension' };
  }

  // Check for multiple consecutive dots
  if (fileName.includes('..')) {
    return { valid: false, error: 'File name cannot contain consecutive dots' };
  }

  // Check for Unicode normalization attacks
  const normalized = fileName.normalize('NFC');
  if (normalized !== fileName) {
    return { valid: false, error: 'File name contains non-normalized Unicode characters' };
  }

  // Validate file extension (case-insensitive)
  const allowedExtensions = ['.csv', '.pdf', '.docx', '.xlsx'];
  const fileExtension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
  
  if (!allowedExtensions.includes(fileExtension)) {
    return { valid: false, error: `File extension not supported. Allowed extensions: ${allowedExtensions.join(', ')}` };
  }

  return { valid: true };
}

/**
 * Validate content type
 * @param {string} contentType - MIME type to validate
 * @returns {Object} - {valid: boolean, error?: string}
 */
function validateContentType(contentType) {
  if (!contentType || typeof contentType !== 'string') {
    return { valid: false, error: 'Content type is required' };
  }

  if (!ALLOWED_CONTENT_TYPES.includes(contentType.toLowerCase())) {
    return { valid: false, error: `File type not supported. Supported types: CSV, PDF, DOCX, XLSX (${ALLOWED_CONTENT_TYPES.join(', ')})` };
  }

  return { valid: true };
}

/**
 * GET /api/files
 * List all files for the authenticated user
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    
    console.log(`Listing files for user: ${userId}`);
    
    const files = await listUserFiles(userId);
    const totalBytes = await sumBytes(userId);
    
    // Add quota information to response
    const response = {
      success: true,
      files: files,
      quota: {
        used: totalBytes,
        limit: MAX_STORAGE_BYTES,
        remaining: Math.max(0, MAX_STORAGE_BYTES - totalBytes),
        usedDisplay: totalBytes < 1024 * 1024 ? 
          `${Math.round(totalBytes / 1024)} KB` : 
          `${Math.round(totalBytes / 1024 / 1024 * 10) / 10} MB`,
        limitDisplay: `${Math.round(MAX_STORAGE_BYTES / 1024 / 1024)} MB`,
        remainingDisplay: (MAX_STORAGE_BYTES - totalBytes) < 1024 * 1024 ?
          `${Math.round((MAX_STORAGE_BYTES - totalBytes) / 1024)} KB` :
          `${Math.round((MAX_STORAGE_BYTES - totalBytes) / 1024 / 1024)} MB`,
        percentUsed: Math.round((totalBytes / MAX_STORAGE_BYTES) * 100)
      },
      timestamp: new Date().toISOString()
    };
    
    console.log(`User ${userId}: ${files.length} files, ${response.quota.usedDisplay} used`);
    res.json(response);
    
  } catch (error) {
    console.error(`Failed to list files for user ${req.user?.id}:`, error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to list files',
      message: error.message
    });
  }
});

/**
 * POST /api/files/sas
 * Generate a SAS token for uploading a file
 * Body: { fileName, contentType, sizeBytes }
 */
router.post('/sas', async (req, res) => {
  try {
    const userId = req.user.id;
    const { fileName, contentType, sizeBytes } = req.body;
    
    console.log(`SAS upload request from user ${userId}: ${fileName} (${sizeBytes} bytes)`);
    
    // Apply rate limiting for SAS token generation
    if (!checkRateLimit(userId)) {
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded',
        message: `Too many SAS token requests. Maximum ${RATE_LIMIT_MAX_REQUESTS} requests per minute allowed.`,
        retryAfter: Math.ceil(RATE_LIMIT_WINDOW / 1000) // seconds
      });
    }
    
    // Validate required fields
    if (!fileName || !contentType || !Number.isFinite(sizeBytes)) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'fileName, contentType, and sizeBytes are required'
      });
    }

    // Validate file size
    if (sizeBytes <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid file size',
        message: 'File size must be greater than 0'
      });
    }

    if (sizeBytes > 10 * 1024 * 1024) { // 10MB individual file limit
      return res.status(413).json({
        success: false,
        error: 'File too large',
        message: 'Individual files cannot exceed 10MB'
      });
    }

    // Validate file name
    const fileNameValidation = validateFileName(fileName);
    if (!fileNameValidation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid file name',
        message: fileNameValidation.error
      });
    }

    // Validate content type
    const contentTypeValidation = validateContentType(contentType);
    if (!contentTypeValidation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid content type',
        message: contentTypeValidation.error
      });
    }

    // Check for duplicate files
    const existingFiles = await listUserFiles(userId);
    const duplicateFile = existingFiles.find(file => file.name === fileName);
    if (duplicateFile) {
      return res.status(409).json({
        success: false,
        error: 'File already exists',
        message: `A file named '${fileName}' already exists. Please rename your file or delete the existing one first.`,
        existingFile: {
          name: duplicateFile.name,
          size: duplicateFile.size,
          lastModified: duplicateFile.lastModified
        }
      });
    }

    // Check quota before issuing SAS token
    const currentUsage = await sumBytes(userId);
    if (currentUsage + sizeBytes > MAX_STORAGE_BYTES) {
      const remainingMB = Math.round((MAX_STORAGE_BYTES - currentUsage) / 1024 / 1024 * 100) / 100;
      const requestedMB = Math.round(sizeBytes / 1024 / 1024 * 100) / 100;
      
      return res.status(413).json({
        success: false,
        error: 'Storage quota exceeded',
        message: `Cannot upload ${requestedMB}MB file. Only ${remainingMB}MB remaining of 200MB quota.`,
        quota: {
          used: currentUsage,
          limit: MAX_STORAGE_BYTES,
          remaining: MAX_STORAGE_BYTES - currentUsage,
          requestedSize: sizeBytes
        }
      });
    }

    // Generate SAS token for upload (10 minute expiry)
    const sasUrl = await sasForUpload(userId, fileName, contentType, 10);
    
    console.log(`Generated upload SAS for user ${userId}: ${fileName}`);
    
    res.json({
      success: true,
      uploadUrl: sasUrl,
      fileName: fileName,
      expiresInMinutes: 10,
      instructions: {
        method: 'PUT',
        headers: {
          'Content-Type': contentType,
          'x-ms-blob-type': 'BlockBlob'
        }
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error(`Failed to generate upload SAS for user ${req.user?.id}:`, error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to generate upload token',
      message: error.message
    });
  }
});

/**
 * GET /api/files/:blobName/sas
 * Generate a SAS token for downloading a specific file
 */
router.get('/:blobName/sas', async (req, res) => {
  try {
    const userId = req.user.id;
    const { blobName } = req.params;
    
    console.log(`SAS download request from user ${userId}: ${blobName}`);
    
    // Apply rate limiting for SAS token generation
    if (!checkRateLimit(userId)) {
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded',
        message: `Too many SAS token requests. Maximum ${RATE_LIMIT_MAX_REQUESTS} requests per minute allowed.`,
        retryAfter: Math.ceil(RATE_LIMIT_WINDOW / 1000) // seconds
      });
    }
    
    // Validate blob name
    const fileNameValidation = validateFileName(blobName);
    if (!fileNameValidation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid file name',
        message: fileNameValidation.error
      });
    }

    // Check if file exists by listing user's files
    const userFiles = await listUserFiles(userId);
    const fileExists = userFiles.some(file => file.name === blobName);
    
    if (!fileExists) {
      return res.status(404).json({
        success: false,
        error: 'File not found',
        message: `File '${blobName}' does not exist or you don't have access to it`
      });
    }

    // Generate SAS token for download (10 minute expiry)
    const sasUrl = await sasForRead(userId, blobName, 10);
    
    console.log(`Generated download SAS for user ${userId}: ${blobName}`);
    
    res.json({
      success: true,
      downloadUrl: sasUrl,
      fileName: blobName,
      expiresInMinutes: 10,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error(`Failed to generate download SAS for user ${req.user?.id}, file ${req.params.blobName}:`, error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to generate download token',
      message: error.message
    });
  }
});

/**
 * DELETE /api/files/:blobName
 * Delete a specific file
 */
router.delete('/:blobName', async (req, res) => {
  try {
    const userId = req.user.id;
    const { blobName } = req.params;
    
    console.log(`Delete request from user ${userId}: ${blobName}`);
    
    // Validate blob name
    const fileNameValidation = validateFileName(blobName);
    if (!fileNameValidation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid file name',
        message: fileNameValidation.error
      });
    }

    // Check if file exists by listing user's files
    const userFiles = await listUserFiles(userId);
    const fileExists = userFiles.some(file => file.name === blobName);
    
    if (!fileExists) {
      return res.status(404).json({
        success: false,
        error: 'File not found',
        message: `File '${blobName}' does not exist or you don't have access to it`
      });
    }

    // Delete the file
    await deleteBlob(userId, blobName);
    
    console.log(`Successfully deleted file for user ${userId}: ${blobName}`);
    
    res.json({
      success: true,
      message: `File '${blobName}' has been deleted`,
      fileName: blobName,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error(`Failed to delete file for user ${req.user?.id}, file ${req.params.blobName}:`, error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to delete file',
      message: error.message
    });
  }
});

/**
 * DELETE /api/files
 * Delete ALL files for the authenticated user (GDPR compliance)
 * This is a destructive operation that removes all user data
 */
router.delete('/', async (req, res) => {
  try {
    const userId = req.user.id;
    
    console.log(`GDPR deletion request from user ${userId}: deleting all user data`);
    
    // Get list of all user files first
    const userFiles = await listUserFiles(userId);
    
    if (userFiles.length === 0) {
      return res.json({
        success: true,
        message: 'No files found to delete',
        deletedFiles: [],
        timestamp: new Date().toISOString()
      });
    }
    
    // Delete all files
    const deletedFiles = [];
    const errors = [];
    
    for (const file of userFiles) {
      try {
        await deleteBlob(userId, file.name);
        deletedFiles.push(file.name);
        console.log(`Successfully deleted file for user ${userId}: ${file.name}`);
      } catch (error) {
        console.error(`Failed to delete file ${file.name} for user ${userId}:`, error.message);
        errors.push({ fileName: file.name, error: error.message });
      }
    }
    
    // Log the GDPR deletion event
    console.log(`GDPR deletion completed for user ${userId}: ${deletedFiles.length} files deleted, ${errors.length} errors`);
    
    const response = {
      success: errors.length === 0,
      message: errors.length === 0 
        ? `Successfully deleted all ${deletedFiles.length} files`
        : `Deleted ${deletedFiles.length} files with ${errors.length} errors`,
      deletedFiles: deletedFiles,
      errors: errors,
      totalFilesProcessed: userFiles.length,
      timestamp: new Date().toISOString()
    };
    
    res.status(errors.length === 0 ? 200 : 207).json(response); // 207 = Multi-Status for partial success
    
  } catch (error) {
    console.error(`Failed to process GDPR deletion for user ${req.user?.id}:`, error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to delete user data',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/files/health
 * Health check endpoint for storage connectivity
 */
router.get('/health', async (req, res) => {
  try {
    const health = await healthCheck();
    
    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json({
      success: health.status === 'healthy',
      storage: health,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Storage health check failed:', error.message);
    res.status(503).json({
      success: false,
      error: 'Health check failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
