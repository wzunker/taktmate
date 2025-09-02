-- Migration 003: Stored Procedures and Views
-- Created: 2024-01-01
-- Description: Add stored procedures for maintenance and views for monitoring

-- Cleanup procedure for expired sessions
CREATE PROCEDURE CleanupExpiredSessions
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @DeletedCount INT;
    
    -- Delete expired sessions
    DELETE FROM Sessions 
    WHERE expires_at < GETUTCDATE() OR is_active = 0;
    
    SET @DeletedCount = @@ROWCOUNT;
    
    -- Log cleanup action
    INSERT INTO AuditLog (action, details, created_at)
    VALUES ('session_cleanup', 
            CONCAT('{"deleted_sessions": ', @DeletedCount, '}'), 
            GETUTCDATE());
            
    -- Return count of deleted sessions
    SELECT @DeletedCount as deleted_sessions;
END;

-- Cleanup procedure for expired data export requests
CREATE PROCEDURE CleanupExpiredDataExports
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @DeletedCount INT;
    
    -- Delete expired export requests
    DELETE FROM DataExportRequests 
    WHERE expires_at < GETUTCDATE() AND status = 'completed';
    
    SET @DeletedCount = @@ROWCOUNT;
    
    -- Log cleanup action
    INSERT INTO AuditLog (action, details, created_at)
    VALUES ('data_export_cleanup', 
            CONCAT('{"deleted_exports": ', @DeletedCount, '}'), 
            GETUTCDATE());
            
    -- Return count of deleted exports
    SELECT @DeletedCount as deleted_exports;
END;

-- Procedure for comprehensive database maintenance
CREATE PROCEDURE DatabaseMaintenance
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @SessionsDeleted INT;
    DECLARE @ExportsDeleted INT;
    DECLARE @StartTime DATETIME2 = GETUTCDATE();
    
    -- Clean up expired sessions
    EXEC CleanupExpiredSessions;
    SET @SessionsDeleted = @@ROWCOUNT;
    
    -- Clean up expired data exports
    EXEC CleanupExpiredDataExports;
    SET @ExportsDeleted = @@ROWCOUNT;
    
    -- Log maintenance completion
    INSERT INTO AuditLog (action, details, created_at)
    VALUES ('database_maintenance', 
            CONCAT('{"sessions_deleted": ', @SessionsDeleted, ', "exports_deleted": ', @ExportsDeleted, ', "duration_ms": ', DATEDIFF(MILLISECOND, @StartTime, GETUTCDATE()), '}'), 
            GETUTCDATE());
    
    -- Return summary
    SELECT 
        @SessionsDeleted as sessions_deleted,
        @ExportsDeleted as exports_deleted,
        DATEDIFF(MILLISECOND, @StartTime, GETUTCDATE()) as duration_ms;
END;

-- View for active user sessions (useful for monitoring)
CREATE VIEW ActiveUserSessions AS
SELECT 
    u.id as user_id,
    u.name,
    u.email,
    s.session_id,
    s.created_at as session_start,
    s.last_accessed,
    s.expires_at,
    s.ip_address,
    DATEDIFF(MINUTE, s.last_accessed, GETUTCDATE()) as minutes_since_last_access
FROM Users u
INNER JOIN Sessions s ON u.id = s.user_id
WHERE s.expires_at > GETUTCDATE() 
  AND s.is_active = 1
  AND u.is_active = 1;

-- View for user statistics (useful for admin dashboard)
CREATE VIEW UserStatistics AS
SELECT 
    COUNT(*) as total_users,
    COUNT(CASE WHEN email_verified = 1 THEN 1 END) as verified_users,
    COUNT(CASE WHEN last_login > DATEADD(day, -30, GETUTCDATE()) THEN 1 END) as active_last_30_days,
    COUNT(CASE WHEN created_at > DATEADD(day, -7, GETUTCDATE()) THEN 1 END) as new_users_last_7_days,
    COUNT(CASE WHEN created_at > DATEADD(day, -1, GETUTCDATE()) THEN 1 END) as new_users_last_24_hours
FROM Users 
WHERE is_active = 1;

-- View for session statistics
CREATE VIEW SessionStatistics AS
SELECT 
    COUNT(*) as total_sessions,
    COUNT(CASE WHEN expires_at > GETUTCDATE() AND is_active = 1 THEN 1 END) as active_sessions,
    COUNT(CASE WHEN expires_at <= GETUTCDATE() THEN 1 END) as expired_sessions,
    COUNT(CASE WHEN is_active = 0 THEN 1 END) as inactive_sessions,
    COUNT(CASE WHEN created_at > DATEADD(day, -1, GETUTCDATE()) THEN 1 END) as sessions_last_24h,
    COUNT(CASE WHEN last_accessed > DATEADD(hour, -1, GETUTCDATE()) THEN 1 END) as sessions_last_hour,
    AVG(CAST(DATEDIFF(MINUTE, created_at, COALESCE(last_accessed, GETUTCDATE())) AS FLOAT)) as avg_session_duration_minutes
FROM Sessions;

-- View for audit log summary
CREATE VIEW AuditLogSummary AS
SELECT 
    action,
    COUNT(*) as event_count,
    COUNT(DISTINCT user_id) as unique_users,
    MIN(created_at) as first_occurrence,
    MAX(created_at) as last_occurrence
FROM AuditLog 
WHERE created_at > DATEADD(day, -30, GETUTCDATE())
GROUP BY action;

-- Record this migration
INSERT INTO MigrationHistory (migration_name, success, execution_time_ms) 
VALUES ('003_procedures_and_views', 1, 0);
