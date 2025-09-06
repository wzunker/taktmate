/**
 * Enhanced File Storage System for TaktMate
 * 
 * This module provides comprehensive file storage functionality with user association,
 * access control, file management, and integration with Microsoft Entra External ID authentication.
 */

const { config } = require('./config/entraExternalId');

// Import Application Insights telemetry (optional)
let telemetry = null;
try {
  const appInsights = require('./config/applicationInsights');
  telemetry = appInsights.telemetry;
} catch (error) {
  // Application Insights not configured or available
  if (config.debugAuth) {
    console.log('ℹ️  Application Insights not available for file store telemetry');
  }
}

/**
 * Enhanced File Store Class with User Association
 */
class FileStore {
  constructor() {
    this.files = new Map(); // fileId -> file data
    this.userFiles = new Map(); // userId -> Set of fileIds
    this.fileMetadata = new Map(); // fileId -> metadata
    this.fileAccess = new Map(); // fileId -> access control data
    
    // Configuration
    this.maxFilesPerUser = parseInt(process.env.MAX_FILES_PER_USER) || 50;
    this.maxFileAge = parseInt(process.env.MAX_FILE_AGE_MS) || 7 * 24 * 60 * 60 * 1000; // 7 days
    this.maxTotalFiles = parseInt(process.env.MAX_TOTAL_FILES) || 1000;
    
    // Statistics
    this.stats = {
      totalFiles: 0,
      totalUsers: 0,
      storageUsed: 0,
      uploadsToday: 0,
      lastCleanup: new Date()
    };
    
    if (config.debugAuth) {
      console.log('🗄️  Enhanced FileStore initialized:', {
        maxFilesPerUser: this.maxFilesPerUser,
        maxFileAge: this.maxFileAge,
        maxTotalFiles: this.maxTotalFiles
      });
    }
    
    // Start periodic cleanup
    this.startPeriodicCleanup();
  }

  /**
   * Store parsed CSV data with user association
   * @param {string} fileId - Unique file identifier
   * @param {string} filename - Original filename
   * @param {Array} rows - Parsed CSV data
   * @param {string} userId - User ID from Microsoft Entra External ID
   * @param {Object} userProfile - User profile information
   * @param {Object} options - Additional storage options
   * @returns {Object} Storage result
   */
  store(fileId, filename, rows, userId, userProfile = null, options = {}) {
    const startTime = Date.now();
    
    try {
      // Validate inputs
      if (!fileId || !filename || !rows || !userId) {
        throw new Error('Missing required parameters: fileId, filename, rows, userId');
      }

      // Check if user exists and has permission to upload
      if (!this.canUserUpload(userId, userProfile)) {
        throw new Error('User has reached maximum file limit or lacks upload permissions');
      }

      // Check global file limit
      if (this.files.size >= this.maxTotalFiles) {
        throw new Error('System has reached maximum file storage capacity');
      }

      // Calculate file size estimate
      const estimatedSize = this.estimateFileSize(rows, filename);
      
      // Create file data
      const fileData = {
        fileId,
      filename,
      rows,
        userId,
        uploadedAt: new Date(),
        lastAccessedAt: new Date(),
        accessCount: 0,
        size: estimatedSize,
        rowCount: rows.length,
        userProfile: userProfile ? {
          email: userProfile.email,
          displayName: userProfile.displayName,
          company: userProfile.company,
          role: userProfile.role
        } : null,
        options: {
          isPublic: options.isPublic || false,
          allowSharing: options.allowSharing !== false, // Default true
          retentionDays: options.retentionDays || 7,
          tags: options.tags || [],
          description: options.description || ''
        }
      };

      // Create metadata
      const metadata = {
        fileId,
        filename,
        userId,
        uploadedAt: fileData.uploadedAt,
        size: estimatedSize,
        rowCount: rows.length,
        contentType: 'text/csv',
        encoding: 'utf-8',
        headers: rows.length > 0 ? Object.keys(rows[0]) : [],
        checksum: this.calculateChecksum(rows),
        version: '1.0'
      };

      // Create access control
      const accessControl = {
        fileId,
        owner: userId,
        permissions: {
          read: [userId],
          write: [userId],
          delete: [userId],
          share: options.allowSharing ? [userId] : []
        },
        isPublic: options.isPublic || false,
        sharedWith: [],
        accessLog: [{
          action: 'upload',
          userId: userId,
          timestamp: new Date(),
          userAgent: options.userAgent || 'unknown',
          ip: options.ip || 'unknown'
        }]
      };

      // Store file data
      this.files.set(fileId, fileData);
      this.fileMetadata.set(fileId, metadata);
      this.fileAccess.set(fileId, accessControl);

      // Associate with user
      if (!this.userFiles.has(userId)) {
        this.userFiles.set(userId, new Set());
        this.stats.totalUsers++;
      }
      this.userFiles.get(userId).add(fileId);

      // Update statistics
      this.stats.totalFiles++;
      this.stats.storageUsed += estimatedSize;
      this.updateDailyStats();

      const duration = Date.now() - startTime;

      // Track file upload
      if (telemetry) {
        telemetry.trackEvent('FileUploaded', {
          fileId: fileId,
          filename: filename,
          userId: userId,
          userEmail: userProfile?.email || 'unknown',
          userCompany: userProfile?.company || 'unknown',
          rowCount: rows.length.toString(),
          isPublic: (options.isPublic || false).toString(),
          allowSharing: (options.allowSharing !== false).toString()
        }, {
          fileSize: estimatedSize,
          processingDuration: duration
        });
      }

      if (config.debugAuth) {
        console.log(`📁 File stored: ${filename} (${fileId}) for user ${userProfile?.email || userId} in ${duration}ms`);
      }

      return {
        success: true,
        fileId: fileId,
        filename: filename,
        size: estimatedSize,
        rowCount: rows.length,
        uploadedAt: fileData.uploadedAt,
        processingDuration: duration
      };

    } catch (error) {
      const duration = Date.now() - startTime;

      // Track file upload error
      if (telemetry) {
        telemetry.trackError(error, userId, {
          component: 'fileStore.store',
          fileId: fileId,
          filename: filename,
          duration: duration
        });
      }

      if (config.debugAuth) {
        console.log(`❌ File storage failed: ${error.message} in ${duration}ms`);
      }

      return {
        success: false,
        error: error.message,
        processingDuration: duration
      };
    }
  }

  /**
   * Retrieve CSV data by fileId with access control
   * @param {string} fileId - File identifier
   * @param {string} userId - User ID requesting access
   * @param {Object} options - Access options
   * @returns {Object} File data or null
   */
  get(fileId, userId = null, options = {}) {
    const startTime = Date.now();
    
    try {
      if (!fileId) {
        throw new Error('File ID is required');
      }

      const fileData = this.files.get(fileId);
      if (!fileData) {
        return null;
      }

      // Check access permissions
      if (userId && !this.hasFileAccess(fileId, userId, 'read')) {
        throw new Error('Access denied: insufficient permissions to read file');
      }

      // Update access tracking
      fileData.lastAccessedAt = new Date();
      fileData.accessCount++;

      // Log access
      if (userId) {
        this.logFileAccess(fileId, userId, 'read', options);
      }

      const duration = Date.now() - startTime;

      // Track file access
      if (telemetry && userId) {
        telemetry.trackEvent('FileAccessed', {
          fileId: fileId,
          filename: fileData.filename,
          userId: userId,
          accessCount: fileData.accessCount.toString()
        }, {
          fileSize: fileData.size,
          accessDuration: duration
        });
      }

      if (config.debugAuth && userId) {
        console.log(`📖 File accessed: ${fileData.filename} (${fileId}) by user ${userId} in ${duration}ms`);
      }

      return {
        ...fileData,
        accessDuration: duration
      };

    } catch (error) {
      const duration = Date.now() - startTime;

      if (config.debugAuth) {
        console.log(`❌ File access failed: ${error.message} in ${duration}ms`);
      }

      // Track file access error
      if (telemetry && userId) {
        telemetry.trackError(error, userId, {
          component: 'fileStore.get',
          fileId: fileId,
          duration: duration
        });
      }

      throw error;
    }
  }

  /**
   * Get file metadata
   * @param {string} fileId - File identifier
   * @param {string} userId - User ID requesting metadata
   * @returns {Object} File metadata or null
   */
  getMetadata(fileId, userId = null) {
    if (!fileId) {
      return null;
    }

    const metadata = this.fileMetadata.get(fileId);
    if (!metadata) {
      return null;
    }

    // Check access permissions for metadata
    if (userId && !this.hasFileAccess(fileId, userId, 'read')) {
      return null;
    }

    return { ...metadata };
  }

  /**
   * Get files for a specific user
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Array} Array of file information
   */
  getUserFiles(userId, options = {}) {
    const startTime = Date.now();
    
    try {
      if (!userId) {
        throw new Error('User ID is required');
      }

      const userFileIds = this.userFiles.get(userId);
      if (!userFileIds || userFileIds.size === 0) {
        return [];
      }

      let files = [];
      
      for (const fileId of userFileIds) {
        const fileData = this.files.get(fileId);
        const metadata = this.fileMetadata.get(fileId);
        
        if (fileData && metadata) {
          files.push({
            fileId: fileId,
            filename: fileData.filename,
            uploadedAt: fileData.uploadedAt,
            lastAccessedAt: fileData.lastAccessedAt,
            accessCount: fileData.accessCount,
            size: fileData.size,
            rowCount: fileData.rowCount,
            isPublic: fileData.options.isPublic,
            allowSharing: fileData.options.allowSharing,
            tags: fileData.options.tags,
            description: fileData.options.description,
            headers: metadata.headers,
            checksum: metadata.checksum
          });
        }
      }

      // Apply sorting and filtering
      if (options.sortBy) {
        files.sort((a, b) => {
          const aVal = a[options.sortBy];
          const bVal = b[options.sortBy];
          
          if (options.sortOrder === 'desc') {
            return bVal > aVal ? 1 : bVal < aVal ? -1 : 0;
          } else {
            return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
          }
        });
      }

      // Apply pagination
      if (options.limit) {
        const offset = options.offset || 0;
        files = files.slice(offset, offset + options.limit);
      }

      const duration = Date.now() - startTime;

      // Track user files query
      if (telemetry) {
        telemetry.trackEvent('UserFilesQueried', {
          userId: userId,
          fileCount: files.length.toString(),
          totalUserFiles: userFileIds.size.toString()
        }, {
          queryDuration: duration
        });
      }

      if (config.debugAuth) {
        console.log(`📋 Retrieved ${files.length} files for user ${userId} in ${duration}ms`);
      }

      return files;

    } catch (error) {
      const duration = Date.now() - startTime;

      if (config.debugAuth) {
        console.log(`❌ User files query failed: ${error.message} in ${duration}ms`);
      }

      throw error;
    }
  }

  /**
   * Delete a file
   * @param {string} fileId - File identifier
   * @param {string} userId - User ID requesting deletion
   * @param {Object} options - Deletion options
   * @returns {boolean} Success status
   */
  delete(fileId, userId, options = {}) {
    const startTime = Date.now();
    
    try {
      if (!fileId || !userId) {
        throw new Error('File ID and User ID are required');
      }

      const fileData = this.files.get(fileId);
      if (!fileData) {
        return false; // File doesn't exist
      }

      // Check delete permissions
      if (!this.hasFileAccess(fileId, userId, 'delete')) {
        throw new Error('Access denied: insufficient permissions to delete file');
      }

      // Get file info for tracking
      const filename = fileData.filename;
      const fileSize = fileData.size;

      // Remove from all maps
      this.files.delete(fileId);
      this.fileMetadata.delete(fileId);
      this.fileAccess.delete(fileId);

      // Remove from user's file list
      const userFileIds = this.userFiles.get(fileData.userId);
      if (userFileIds) {
        userFileIds.delete(fileId);
        if (userFileIds.size === 0) {
          this.userFiles.delete(fileData.userId);
          this.stats.totalUsers--;
        }
      }

      // Update statistics
      this.stats.totalFiles--;
      this.stats.storageUsed -= fileSize;

      const duration = Date.now() - startTime;

      // Track file deletion
      if (telemetry) {
        telemetry.trackEvent('FileDeleted', {
          fileId: fileId,
          filename: filename,
          userId: userId,
          fileOwner: fileData.userId,
          reason: options.reason || 'user_request'
        }, {
          fileSize: fileSize,
          deletionDuration: duration
        });
      }

      if (config.debugAuth) {
        console.log(`🗑️  File deleted: ${filename} (${fileId}) by user ${userId} in ${duration}ms`);
      }

      return true;

    } catch (error) {
      const duration = Date.now() - startTime;

      if (config.debugAuth) {
        console.log(`❌ File deletion failed: ${error.message} in ${duration}ms`);
      }

      // Track file deletion error
      if (telemetry) {
        telemetry.trackError(error, userId, {
          component: 'fileStore.delete',
          fileId: fileId,
          duration: duration
        });
      }

      throw error;
    }
  }

  /**
   * Check if file exists
   * @param {string} fileId - File identifier
   * @param {string} userId - User ID (for access control)
   * @returns {boolean} File exists and user has access
   */
  exists(fileId, userId = null) {
    if (!fileId) {
      return false;
    }

    const fileExists = this.files.has(fileId);
    
    if (!fileExists) {
      return false;
    }

    // If userId provided, check access permissions
    if (userId) {
      return this.hasFileAccess(fileId, userId, 'read');
    }

    return fileExists;
  }

  /**
   * Check if user can upload files
   * @param {string} userId - User ID
   * @param {Object} userProfile - User profile
   * @returns {boolean} Can upload
   */
  canUserUpload(userId, userProfile = null) {
    if (!userId) {
      return false;
    }

    // Check user file count limit
    const userFileIds = this.userFiles.get(userId);
    const userFileCount = userFileIds ? userFileIds.size : 0;
    
    if (userFileCount >= this.maxFilesPerUser) {
      return false;
    }

    // Check user permissions (if profile provided)
    if (userProfile && userProfile.permissions) {
      if (!userProfile.permissions.includes('upload:csv')) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check file access permissions
   * @param {string} fileId - File identifier
   * @param {string} userId - User ID
   * @param {string} permission - Permission type ('read', 'write', 'delete', 'share')
   * @returns {boolean} Has permission
   */
  hasFileAccess(fileId, userId, permission = 'read') {
    if (!fileId || !userId) {
      return false;
    }

    const accessControl = this.fileAccess.get(fileId);
    if (!accessControl) {
      return false;
    }

    // Owner has all permissions
    if (accessControl.owner === userId) {
      return true;
    }

    // Check if file is public (for read access)
    if (permission === 'read' && accessControl.isPublic) {
      return true;
    }

    // Check specific permission
    const permissionList = accessControl.permissions[permission];
    return permissionList && permissionList.includes(userId);
  }

  /**
   * Log file access
   * @param {string} fileId - File identifier
   * @param {string} userId - User ID
   * @param {string} action - Action performed
   * @param {Object} options - Additional options
   */
  logFileAccess(fileId, userId, action, options = {}) {
    const accessControl = this.fileAccess.get(fileId);
    if (accessControl) {
      accessControl.accessLog.push({
        action: action,
        userId: userId,
        timestamp: new Date(),
        userAgent: options.userAgent || 'unknown',
        ip: options.ip || 'unknown'
      });

      // Keep only last 100 access log entries
      if (accessControl.accessLog.length > 100) {
        accessControl.accessLog = accessControl.accessLog.slice(-100);
      }
    }
  }

  /**
   * Estimate file size
   * @param {Array} rows - CSV rows
   * @param {string} filename - Filename
   * @returns {number} Estimated size in bytes
   */
  estimateFileSize(rows, filename) {
    if (!rows || rows.length === 0) {
      return filename.length * 2; // Rough estimate for filename
    }

    // Estimate based on first few rows
    const sampleSize = Math.min(10, rows.length);
    let totalSize = 0;
    
    for (let i = 0; i < sampleSize; i++) {
      const row = rows[i];
      totalSize += JSON.stringify(row).length;
    }

    // Extrapolate to full dataset
    const avgRowSize = totalSize / sampleSize;
    return Math.round(avgRowSize * rows.length * 1.2); // 20% overhead
  }

  /**
   * Calculate checksum for data integrity
   * @param {Array} rows - CSV rows
   * @returns {string} Simple checksum
   */
  calculateChecksum(rows) {
    if (!rows || rows.length === 0) {
      return '0';
    }

    let hash = 0;
    const str = JSON.stringify(rows.slice(0, Math.min(5, rows.length))); // Sample first 5 rows
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(16);
  }

  /**
   * Update daily statistics
   */
  updateDailyStats() {
    const today = new Date().toDateString();
    const lastUpdate = this.stats.lastCleanup.toDateString();
    
    if (today !== lastUpdate) {
      this.stats.uploadsToday = 1;
      this.stats.lastCleanup = new Date();
    } else {
      this.stats.uploadsToday++;
    }
  }

  /**
   * Get storage statistics
   * @returns {Object} Storage statistics
   */
  getStats() {
    return {
      ...this.stats,
      averageFileSize: this.stats.totalFiles > 0 ? Math.round(this.stats.storageUsed / this.stats.totalFiles) : 0,
      storageUsedMB: Math.round(this.stats.storageUsed / (1024 * 1024) * 100) / 100,
      maxStorageCapacity: this.maxTotalFiles,
      utilizationPercent: Math.round((this.stats.totalFiles / this.maxTotalFiles) * 100)
    };
  }

  /**
   * Get all file IDs (for debugging/admin)
   * @param {string} userId - Optional user filter
   * @returns {Array} Array of file IDs
   */
  getAllIds(userId = null) {
    if (userId) {
      const userFileIds = this.userFiles.get(userId);
      return userFileIds ? Array.from(userFileIds) : [];
    }
    
    return Array.from(this.files.keys());
  }

  /**
   * Clear expired files
   * @returns {number} Number of files cleared
   */
  clearExpiredFiles() {
    const now = Date.now();
    let clearedCount = 0;

    for (const [fileId, fileData] of this.files.entries()) {
      const fileAge = now - fileData.uploadedAt.getTime();
      const maxAge = fileData.options.retentionDays * 24 * 60 * 60 * 1000;
      
      if (fileAge > maxAge) {
        try {
          this.delete(fileId, fileData.userId, { reason: 'expired' });
          clearedCount++;
        } catch (error) {
          console.error(`Failed to delete expired file ${fileId}:`, error);
        }
      }
    }

    if (clearedCount > 0 && config.debugAuth) {
      console.log(`🗑️  Cleared ${clearedCount} expired files`);
    }

    return clearedCount;
  }

  /**
   * Clear all files for a user
   * @param {string} userId - User ID
   * @returns {number} Number of files cleared
   */
  clearUserFiles(userId) {
    if (!userId) {
      return 0;
    }

    const userFileIds = this.userFiles.get(userId);
    if (!userFileIds || userFileIds.size === 0) {
      return 0;
    }

    let clearedCount = 0;
    const fileIds = Array.from(userFileIds); // Copy to avoid modification during iteration

    for (const fileId of fileIds) {
      try {
        this.delete(fileId, userId, { reason: 'user_cleanup' });
        clearedCount++;
      } catch (error) {
        console.error(`Failed to delete user file ${fileId}:`, error);
      }
    }

    if (clearedCount > 0 && config.debugAuth) {
      console.log(`🗑️  Cleared ${clearedCount} files for user ${userId}`);
    }

    return clearedCount;
  }

  /**
   * Clear all files (admin function)
   */
  clear() {
    this.files.clear();
    this.userFiles.clear();
    this.fileMetadata.clear();
    this.fileAccess.clear();
    
    this.stats = {
      totalFiles: 0,
      totalUsers: 0,
      storageUsed: 0,
      uploadsToday: 0,
      lastCleanup: new Date()
    };

    if (config.debugAuth) {
      console.log('🗑️  All files cleared');
    }
  }

  /**
   * Start periodic cleanup of expired files
   */
  startPeriodicCleanup() {
    // Clean up expired files every hour
    setInterval(() => {
      try {
        this.clearExpiredFiles();
      } catch (error) {
        console.error('Periodic cleanup error:', error);
      }
    }, 60 * 60 * 1000); // 1 hour
  }
}

module.exports = new FileStore();
