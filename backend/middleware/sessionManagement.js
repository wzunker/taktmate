// TaktMate Session Management and File Cleanup Service
// Comprehensive session tracking, expiration handling, and user-specific cleanup

const crypto = require('crypto');
const path = require('path');
const fs = require('fs').promises;

/**
 * Advanced Session Management Service
 * Handles session tracking, expiration, and automatic cleanup of user resources
 */
class SessionManagementService {
    constructor(fileStore, appInsights = null) {
        this.fileStore = fileStore;
        this.appInsights = appInsights;
        
        // Session configuration
        this.config = {
            // Session timeout settings
            sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours default
            inactivityTimeout: 2 * 60 * 60 * 1000, // 2 hours inactivity
            extendedTimeout: 7 * 24 * 60 * 60 * 1000, // 7 days for "remember me"
            
            // Cleanup settings
            cleanupInterval: 30 * 60 * 1000, // 30 minutes cleanup interval
            gracePeriod: 60 * 60 * 1000, // 1 hour grace period before cleanup
            batchSize: 50, // Process 50 expired sessions at a time
            
            // File retention settings
            fileRetentionPeriod: 30 * 24 * 60 * 60 * 1000, // 30 days file retention
            tempFileRetention: 24 * 60 * 60 * 1000, // 24 hours for temp files
            
            // Session tracking
            trackUserActivity: true,
            enableSessionExtension: true,
            requireExplicitLogout: false,
            
            // Cleanup policies
            cleanupPolicies: {
                files: true,           // Clean up user files
                sessions: true,        // Clean up session data
                cache: true,           // Clean up cached data
                tempFiles: true,       // Clean up temporary files
                userPreferences: false, // Keep user preferences
                auditLogs: false       // Keep audit logs
            }
        };
        
        // In-memory session store (in production, use Redis or database)
        this.activeSessions = new Map();
        this.expiredSessions = new Map();
        this.userSessions = new Map(); // userId -> Set of sessionIds
        
        // Cleanup queue for batch processing
        this.cleanupQueue = [];
        this.cleanupInProgress = false;
        
        // Statistics
        this.stats = {
            activeSessions: 0,
            expiredSessions: 0,
            cleanedUpSessions: 0,
            filesDeleted: 0,
            bytesFreed: 0,
            lastCleanup: null,
            cleanupErrors: 0
        };
        
        console.log('🗂️ Session Management Service initialized');
        console.log(`   Session Timeout: ${this.config.sessionTimeout / 1000 / 60 / 60} hours`);
        console.log(`   Inactivity Timeout: ${this.config.inactivityTimeout / 1000 / 60 / 60} hours`);
        console.log(`   File Retention: ${this.config.fileRetentionPeriod / 1000 / 60 / 60 / 24} days`);
        console.log(`   Cleanup Interval: ${this.config.cleanupInterval / 1000 / 60} minutes`);
    }
    
    /**
     * Create or update user session
     */
    createSession(userId, sessionData = {}) {
        const sessionId = this.generateSessionId();
        const now = Date.now();
        
        const session = {
            sessionId: sessionId,
            userId: userId,
            createdAt: now,
            lastActivity: now,
            expiresAt: now + this.config.sessionTimeout,
            isActive: true,
            userAgent: sessionData.userAgent || '',
            ipAddress: sessionData.ipAddress || '',
            loginMethod: sessionData.loginMethod || 'unknown',
            extendedSession: sessionData.rememberMe || false,
            activityCount: 1,
            metadata: {
                ...sessionData.metadata,
                creationTimestamp: now,
                sessionVersion: '1.0'
            }
        };
        
        // Extend session if "remember me" is enabled
        if (session.extendedSession) {
            session.expiresAt = now + this.config.extendedTimeout;
        }
        
        // Store session
        this.activeSessions.set(sessionId, session);
        
        // Track user sessions
        if (!this.userSessions.has(userId)) {
            this.userSessions.set(userId, new Set());
        }
        this.userSessions.get(userId).add(sessionId);
        
        // Update statistics
        this.stats.activeSessions = this.activeSessions.size;
        
        // Track session creation
        this.trackSessionEvent('session_created', session);
        
        console.log(`📝 Created session ${sessionId} for user ${userId} (expires: ${new Date(session.expiresAt).toISOString()})`);
        
        return {
            sessionId: sessionId,
            expiresAt: session.expiresAt,
            extendedSession: session.extendedSession
        };
    }
    
    /**
     * Update session activity
     */
    updateActivity(sessionId, activityData = {}) {
        const session = this.activeSessions.get(sessionId);
        if (!session) {
            return { success: false, reason: 'Session not found' };
        }
        
        const now = Date.now();
        
        // Check if session is expired
        if (now > session.expiresAt) {
            this.markSessionExpired(sessionId, 'timeout');
            return { success: false, reason: 'Session expired' };
        }
        
        // Update activity
        session.lastActivity = now;
        session.activityCount += 1;
        
        // Extend session if configured
        if (this.config.enableSessionExtension) {
            const inactivityPeriod = now - session.lastActivity;
            if (inactivityPeriod < this.config.inactivityTimeout) {
                // Extend session by resetting expiry
                session.expiresAt = now + this.config.sessionTimeout;
                if (session.extendedSession) {
                    session.expiresAt = now + this.config.extendedTimeout;
                }
            }
        }
        
        // Update metadata
        if (activityData.path) {
            session.metadata.lastPath = activityData.path;
        }
        if (activityData.action) {
            session.metadata.lastAction = activityData.action;
        }
        
        // Track activity
        this.trackSessionEvent('session_activity', session, activityData);
        
        return {
            success: true,
            expiresAt: session.expiresAt,
            activityCount: session.activityCount
        };
    }
    
    /**
     * Get session information
     */
    getSession(sessionId) {
        const session = this.activeSessions.get(sessionId);
        if (!session) {
            return null;
        }
        
        const now = Date.now();
        
        // Check if session is expired
        if (now > session.expiresAt) {
            this.markSessionExpired(sessionId, 'timeout');
            return null;
        }
        
        return {
            sessionId: session.sessionId,
            userId: session.userId,
            createdAt: session.createdAt,
            lastActivity: session.lastActivity,
            expiresAt: session.expiresAt,
            isActive: session.isActive,
            activityCount: session.activityCount,
            extendedSession: session.extendedSession,
            timeRemaining: session.expiresAt - now,
            metadata: session.metadata
        };
    }
    
    /**
     * Get all sessions for a user
     */
    getUserSessions(userId) {
        const userSessionIds = this.userSessions.get(userId);
        if (!userSessionIds) {
            return [];
        }
        
        const sessions = [];
        for (const sessionId of userSessionIds) {
            const session = this.getSession(sessionId);
            if (session) {
                sessions.push(session);
            }
        }
        
        return sessions;
    }
    
    /**
     * Terminate session explicitly
     */
    terminateSession(sessionId, reason = 'logout') {
        const session = this.activeSessions.get(sessionId);
        if (!session) {
            return { success: false, reason: 'Session not found' };
        }
        
        // Mark as expired and queue for cleanup
        this.markSessionExpired(sessionId, reason);
        
        // Add to cleanup queue for immediate processing
        this.queueSessionCleanup(sessionId, reason);
        
        console.log(`🔚 Terminated session ${sessionId} for user ${session.userId} (reason: ${reason})`);
        
        return { success: true };
    }
    
    /**
     * Terminate all sessions for a user
     */
    terminateUserSessions(userId, reason = 'user_logout', excludeSessionId = null) {
        const userSessionIds = this.userSessions.get(userId);
        if (!userSessionIds) {
            return { success: true, terminatedCount: 0 };
        }
        
        let terminatedCount = 0;
        for (const sessionId of userSessionIds) {
            if (sessionId !== excludeSessionId) {
                const result = this.terminateSession(sessionId, reason);
                if (result.success) {
                    terminatedCount++;
                }
            }
        }
        
        console.log(`🔚 Terminated ${terminatedCount} sessions for user ${userId} (reason: ${reason})`);
        
        return { success: true, terminatedCount };
    }
    
    /**
     * Mark session as expired
     */
    markSessionExpired(sessionId, reason = 'timeout') {
        const session = this.activeSessions.get(sessionId);
        if (!session) {
            return;
        }
        
        // Move to expired sessions
        session.isActive = false;
        session.expiredAt = Date.now();
        session.expiredReason = reason;
        
        this.expiredSessions.set(sessionId, session);
        this.activeSessions.delete(sessionId);
        
        // Update user sessions tracking
        const userSessionIds = this.userSessions.get(session.userId);
        if (userSessionIds) {
            userSessionIds.delete(sessionId);
            if (userSessionIds.size === 0) {
                this.userSessions.delete(session.userId);
            }
        }
        
        // Update statistics
        this.stats.activeSessions = this.activeSessions.size;
        this.stats.expiredSessions = this.expiredSessions.size;
        
        // Track session expiration
        this.trackSessionEvent('session_expired', session, { reason });
        
        // Queue for cleanup
        this.queueSessionCleanup(sessionId, reason);
    }
    
    /**
     * Queue session for cleanup
     */
    queueSessionCleanup(sessionId, reason) {
        this.cleanupQueue.push({
            sessionId: sessionId,
            queuedAt: Date.now(),
            reason: reason
        });
        
        // Trigger cleanup if queue is getting large
        if (this.cleanupQueue.length >= this.config.batchSize && !this.cleanupInProgress) {
            setImmediate(() => this.processCleanupQueue());
        }
    }
    
    /**
     * Process cleanup queue
     */
    async processCleanupQueue() {
        if (this.cleanupInProgress || this.cleanupQueue.length === 0) {
            return;
        }
        
        this.cleanupInProgress = true;
        const startTime = Date.now();
        
        console.log(`🧹 Processing cleanup queue (${this.cleanupQueue.length} items)`);
        
        try {
            // Process in batches
            const batch = this.cleanupQueue.splice(0, this.config.batchSize);
            const cleanupPromises = batch.map(item => this.cleanupSession(item.sessionId, item.reason));
            
            const results = await Promise.allSettled(cleanupPromises);
            
            let successCount = 0;
            let errorCount = 0;
            
            results.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                    successCount++;
                } else {
                    errorCount++;
                    console.error(`❌ Cleanup failed for session ${batch[index].sessionId}:`, result.reason);
                }
            });
            
            this.stats.cleanedUpSessions += successCount;
            this.stats.cleanupErrors += errorCount;
            this.stats.lastCleanup = Date.now();
            
            const duration = Date.now() - startTime;
            console.log(`✅ Cleanup batch completed: ${successCount} success, ${errorCount} errors (${duration}ms)`);
            
            // Track cleanup batch
            if (this.appInsights) {
                this.appInsights.telemetry.trackEvent('Session_Cleanup_Batch', {
                    batchSize: batch.length,
                    successCount: successCount,
                    errorCount: errorCount,
                    duration: duration
                });
            }
            
        } catch (error) {
            console.error('❌ Cleanup queue processing failed:', error.message);
            this.stats.cleanupErrors++;
        } finally {
            this.cleanupInProgress = false;
            
            // Continue processing if there are more items in queue
            if (this.cleanupQueue.length > 0) {
                setTimeout(() => this.processCleanupQueue(), 5000); // Wait 5 seconds before next batch
            }
        }
    }
    
    /**
     * Clean up resources for expired session
     */
    async cleanupSession(sessionId, reason) {
        const session = this.expiredSessions.get(sessionId);
        if (!session) {
            console.warn(`⚠️ Session ${sessionId} not found for cleanup`);
            return;
        }
        
        const userId = session.userId;
        const startTime = Date.now();
        
        console.log(`🧹 Cleaning up session ${sessionId} for user ${userId} (reason: ${reason})`);
        
        try {
            let filesDeleted = 0;
            let bytesFreed = 0;
            
            // Clean up user files if configured
            if (this.config.cleanupPolicies.files) {
                const fileCleanupResult = await this.cleanupUserFiles(userId, session);
                filesDeleted += fileCleanupResult.filesDeleted;
                bytesFreed += fileCleanupResult.bytesFreed;
            }
            
            // Clean up temporary files if configured
            if (this.config.cleanupPolicies.tempFiles) {
                const tempCleanupResult = await this.cleanupTempFiles(userId, session);
                filesDeleted += tempCleanupResult.filesDeleted;
                bytesFreed += tempCleanupResult.bytesFreed;
            }
            
            // Clean up cached data if configured
            if (this.config.cleanupPolicies.cache) {
                await this.cleanupCachedData(userId, session);
            }
            
            // Update statistics
            this.stats.filesDeleted += filesDeleted;
            this.stats.bytesFreed += bytesFreed;
            
            // Remove from expired sessions
            this.expiredSessions.delete(sessionId);
            this.stats.expiredSessions = this.expiredSessions.size;
            
            const duration = Date.now() - startTime;
            
            // Track successful cleanup
            this.trackSessionEvent('session_cleanup_completed', session, {
                reason: reason,
                filesDeleted: filesDeleted,
                bytesFreed: bytesFreed,
                duration: duration
            });
            
            console.log(`✅ Session cleanup completed: ${filesDeleted} files deleted, ${Math.round(bytesFreed / 1024)}KB freed (${duration}ms)`);
            
        } catch (error) {
            console.error(`❌ Session cleanup failed for ${sessionId}:`, error.message);
            
            // Track cleanup failure
            this.trackSessionEvent('session_cleanup_failed', session, {
                reason: reason,
                error: error.message
            });
            
            throw error;
        }
    }
    
    /**
     * Clean up user files
     */
    async cleanupUserFiles(userId, session) {
        let filesDeleted = 0;
        let bytesFreed = 0;
        
        try {
            // Get user files from file store
            const userFiles = this.fileStore.getUserFiles(userId);
            
            if (!userFiles || userFiles.length === 0) {
                return { filesDeleted, bytesFreed };
            }
            
            const now = Date.now();
            const filesToDelete = [];
            
            // Determine which files to delete based on retention policy
            userFiles.forEach(file => {
                const fileAge = now - file.uploadedAt;
                const sessionAge = now - session.createdAt;
                
                // Delete files if:
                // 1. Session expired due to inactivity and files are older than retention period
                // 2. User explicitly logged out and files are temporary
                // 3. Files exceed maximum retention period
                
                let shouldDelete = false;
                
                if (session.expiredReason === 'logout' && file.isTemporary) {
                    shouldDelete = true; // Delete temp files on explicit logout
                } else if (session.expiredReason === 'timeout' && fileAge > this.config.fileRetentionPeriod) {
                    shouldDelete = true; // Delete old files on session timeout
                } else if (fileAge > this.config.fileRetentionPeriod) {
                    shouldDelete = true; // Delete files exceeding retention period
                }
                
                if (shouldDelete) {
                    filesToDelete.push(file);
                }
            });
            
            // Delete files
            for (const file of filesToDelete) {
                try {
                    const deleteResult = this.fileStore.deleteFile(file.id, userId);
                    if (deleteResult.success) {
                        filesDeleted++;
                        bytesFreed += file.size || 0;
                        
                        console.log(`🗑️ Deleted file ${file.filename} (${Math.round((file.size || 0) / 1024)}KB) for user ${userId}`);
                    }
                } catch (fileError) {
                    console.error(`❌ Failed to delete file ${file.id}:`, fileError.message);
                }
            }
            
        } catch (error) {
            console.error(`❌ User file cleanup failed for ${userId}:`, error.message);
        }
        
        return { filesDeleted, bytesFreed };
    }
    
    /**
     * Clean up temporary files
     */
    async cleanupTempFiles(userId, session) {
        let filesDeleted = 0;
        let bytesFreed = 0;
        
        try {
            // Clean up any temporary files in the system temp directory
            const tempDir = path.join(process.cwd(), 'temp', userId);
            
            try {
                const tempFiles = await fs.readdir(tempDir);
                const now = Date.now();
                
                for (const filename of tempFiles) {
                    const filePath = path.join(tempDir, filename);
                    
                    try {
                        const stats = await fs.stat(filePath);
                        const fileAge = now - stats.mtime.getTime();
                        
                        // Delete temp files older than retention period
                        if (fileAge > this.config.tempFileRetention) {
                            await fs.unlink(filePath);
                            filesDeleted++;
                            bytesFreed += stats.size;
                            
                            console.log(`🗑️ Deleted temp file ${filename} (${Math.round(stats.size / 1024)}KB) for user ${userId}`);
                        }
                    } catch (fileError) {
                        console.error(`❌ Failed to process temp file ${filename}:`, fileError.message);
                    }
                }
                
                // Remove temp directory if empty
                try {
                    const remainingFiles = await fs.readdir(tempDir);
                    if (remainingFiles.length === 0) {
                        await fs.rmdir(tempDir);
                        console.log(`🗑️ Removed empty temp directory for user ${userId}`);
                    }
                } catch (dirError) {
                    // Directory not empty or doesn't exist, ignore
                }
                
            } catch (dirError) {
                // Temp directory doesn't exist, ignore
            }
            
        } catch (error) {
            console.error(`❌ Temp file cleanup failed for ${userId}:`, error.message);
        }
        
        return { filesDeleted, bytesFreed };
    }
    
    /**
     * Clean up cached data
     */
    async cleanupCachedData(userId, session) {
        try {
            // Clean up any user-specific cached data
            // This could include API response caches, computed results, etc.
            
            // Example: Clear user-specific cache entries
            if (global.userCache) {
                delete global.userCache[userId];
            }
            
            console.log(`🧹 Cleared cached data for user ${userId}`);
            
        } catch (error) {
            console.error(`❌ Cache cleanup failed for ${userId}:`, error.message);
        }
    }
    
    /**
     * Generate unique session ID
     */
    generateSessionId() {
        return crypto.randomBytes(32).toString('hex');
    }
    
    /**
     * Periodic cleanup of expired sessions
     */
    async performPeriodicCleanup() {
        const startTime = Date.now();
        const now = Date.now();
        
        console.log('🔍 Performing periodic session cleanup...');
        
        try {
            let expiredCount = 0;
            
            // Check for expired active sessions
            for (const [sessionId, session] of this.activeSessions) {
                if (now > session.expiresAt + this.config.gracePeriod) {
                    this.markSessionExpired(sessionId, 'timeout');
                    expiredCount++;
                }
            }
            
            // Process cleanup queue
            if (this.cleanupQueue.length > 0) {
                await this.processCleanupQueue();
            }
            
            // Clean up very old expired sessions (prevent memory leak)
            const oldExpiredSessions = [];
            for (const [sessionId, session] of this.expiredSessions) {
                const expiredAge = now - (session.expiredAt || session.expiresAt);
                if (expiredAge > 24 * 60 * 60 * 1000) { // 24 hours old
                    oldExpiredSessions.push(sessionId);
                }
            }
            
            oldExpiredSessions.forEach(sessionId => {
                this.expiredSessions.delete(sessionId);
            });
            
            const duration = Date.now() - startTime;
            
            console.log(`✅ Periodic cleanup completed: ${expiredCount} sessions expired, ${oldExpiredSessions.length} old sessions removed (${duration}ms)`);
            
            // Track periodic cleanup
            if (this.appInsights) {
                this.appInsights.telemetry.trackEvent('Periodic_Session_Cleanup', {
                    expiredCount: expiredCount,
                    oldSessionsRemoved: oldExpiredSessions.length,
                    duration: duration,
                    activeSessionsCount: this.activeSessions.size,
                    expiredSessionsCount: this.expiredSessions.size,
                    cleanupQueueSize: this.cleanupQueue.length
                });
            }
            
        } catch (error) {
            console.error('❌ Periodic cleanup failed:', error.message);
            
            if (this.appInsights) {
                this.appInsights.telemetry.trackEvent('Periodic_Cleanup_Failed', {
                    error: error.message,
                    duration: Date.now() - startTime
                });
            }
        }
    }
    
    /**
     * Track session events
     */
    trackSessionEvent(eventType, session, additionalData = {}) {
        if (this.appInsights) {
            this.appInsights.telemetry.trackEvent(`Session_${eventType}`, {
                sessionId: session.sessionId,
                userId: session.userId,
                sessionAge: Date.now() - session.createdAt,
                activityCount: session.activityCount,
                extendedSession: session.extendedSession,
                loginMethod: session.loginMethod,
                userAgent: session.userAgent,
                ipAddress: session.ipAddress,
                ...additionalData
            });
        }
    }
    
    /**
     * Get session management statistics
     */
    getStatistics() {
        return {
            ...this.stats,
            activeSessions: this.activeSessions.size,
            expiredSessions: this.expiredSessions.size,
            cleanupQueueSize: this.cleanupQueue.length,
            userSessionsCount: this.userSessions.size,
            cleanupInProgress: this.cleanupInProgress,
            configuration: {
                sessionTimeout: this.config.sessionTimeout / 1000 / 60 / 60 + ' hours',
                inactivityTimeout: this.config.inactivityTimeout / 1000 / 60 / 60 + ' hours',
                fileRetentionPeriod: this.config.fileRetentionPeriod / 1000 / 60 / 60 / 24 + ' days',
                cleanupInterval: this.config.cleanupInterval / 1000 / 60 + ' minutes',
                cleanupPolicies: this.config.cleanupPolicies
            }
        };
    }
    
    /**
     * Express middleware for session tracking
     */
    createSessionMiddleware() {
        return (req, res, next) => {
            // Extract session information from JWT or session cookie
            let sessionId = null;
            let userId = null;
            
            // Try to get session from JWT token
            if (req.user && req.user.id) {
                userId = req.user.id;
                sessionId = req.user.sessionId || req.sessionID || this.generateSessionId();
            }
            
            // Try to get session from session cookie
            if (!sessionId && req.sessionID) {
                sessionId = req.sessionID;
            }
            
            // Create session if user is authenticated but no session exists
            if (userId && !this.activeSessions.has(sessionId)) {
                const sessionData = {
                    userAgent: req.get('User-Agent'),
                    ipAddress: req.ip,
                    loginMethod: req.user?.loginMethod || 'jwt',
                    rememberMe: req.user?.rememberMe || false,
                    metadata: {
                        initialPath: req.path,
                        initialMethod: req.method
                    }
                };
                
                const newSession = this.createSession(userId, sessionData);
                sessionId = newSession.sessionId;
                
                // Attach session to request
                req.sessionId = sessionId;
                req.sessionData = this.getSession(sessionId);
            } else if (sessionId && this.activeSessions.has(sessionId)) {
                // Update existing session activity
                const activityData = {
                    path: req.path,
                    method: req.method,
                    action: req.body?.action || req.query?.action
                };
                
                const updateResult = this.updateActivity(sessionId, activityData);
                
                if (updateResult.success) {
                    req.sessionId = sessionId;
                    req.sessionData = this.getSession(sessionId);
                } else {
                    // Session expired or invalid
                    req.sessionExpired = true;
                    req.sessionExpiredReason = updateResult.reason;
                }
            }
            
            next();
        };
    }
}

module.exports = {
    SessionManagementService
};
