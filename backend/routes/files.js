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

// Apply authentication middleware to all routes
router.use(requireAuth);

// Constants
const MAX_STORAGE_BYTES = 200 * 1024 * 1024; // 200MB per user
const MAX_FILENAME_LENGTH = 255;
const ALLOWED_CONTENT_TYPES = [
  'text/csv',
  'application/csv',
  'text/plain'
];

/**
 * Validate file name for security and Azure compliance
 * @param {string} fileName - File name to validate
 * @returns {Object} - {valid: boolean, error?: string}
 */
function validateFileName(fileName) {
  if (!fileName || typeof fileName !== 'string') {
    return { valid: false, error: 'File name is required and must be a string' };
  }

  if (fileName.length > MAX_FILENAME_LENGTH) {
    return { valid: false, error: `File name too long (max ${MAX_FILENAME_LENGTH} characters)` };
  }

  // Check for path traversal attempts
  if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
    return { valid: false, error: 'File name contains invalid characters' };
  }

  // Check for reserved names and characters
  const invalidChars = /[<>:"|?*\x00-\x1f]/;
  if (invalidChars.test(fileName)) {
    return { valid: false, error: 'File name contains invalid characters' };
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
    return { valid: false, error: `Only CSV files are allowed. Supported types: ${ALLOWED_CONTENT_TYPES.join(', ')}` };
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
        usedMB: Math.round(totalBytes / 1024 / 1024 * 100) / 100,
        limitMB: Math.round(MAX_STORAGE_BYTES / 1024 / 1024),
        percentUsed: Math.round((totalBytes / MAX_STORAGE_BYTES) * 100)
      },
      timestamp: new Date().toISOString()
    };
    
    console.log(`User ${userId}: ${files.length} files, ${response.quota.usedMB}MB used`);
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
