-- TaktMate Database Schema
-- Azure SQL Database schema for user authentication and session management

-- Users table for storing user account information
CREATE TABLE Users (
    id INT IDENTITY(1,1) PRIMARY KEY,
    name NVARCHAR(100) NOT NULL,
    company NVARCHAR(100),
    role NVARCHAR(100),
    email NVARCHAR(255) NOT NULL UNIQUE,
    password_hash NVARCHAR(255), -- NULL for OAuth-only users
    email_verified BIT DEFAULT 0,
    email_verification_token NVARCHAR(255),
    email_verification_expires DATETIME2,
    password_reset_token NVARCHAR(255),
    password_reset_expires DATETIME2,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE(),
    last_login DATETIME2,
    is_active BIT DEFAULT 1
);

-- Sessions table for managing user sessions
CREATE TABLE Sessions (
    id INT IDENTITY(1,1) PRIMARY KEY,
    session_id NVARCHAR(255) NOT NULL UNIQUE,
    user_id INT NOT NULL,
    expires_at DATETIME2 NOT NULL,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    last_accessed DATETIME2 DEFAULT GETUTCDATE(),
    ip_address NVARCHAR(45), -- IPv6 compatible
    user_agent NVARCHAR(500),
    is_active BIT DEFAULT 1,
    FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
);

-- OAuth tokens table for storing OAuth authentication data
CREATE TABLE OAuthTokens (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL,
    provider NVARCHAR(50) NOT NULL, -- 'google', 'microsoft'
    provider_user_id NVARCHAR(255) NOT NULL, -- OAuth provider's user ID
    access_token NVARCHAR(2000), -- OAuth access token (encrypted)
    refresh_token NVARCHAR(2000), -- OAuth refresh token (encrypted)
    token_expires_at DATETIME2,
    scope NVARCHAR(500), -- OAuth scopes granted
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE(),
    FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
    UNIQUE(provider, provider_user_id) -- Prevent duplicate OAuth accounts
);

-- User data export requests for GDPR compliance
CREATE TABLE DataExportRequests (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL,
    request_date DATETIME2 DEFAULT GETUTCDATE(),
    status NVARCHAR(50) DEFAULT 'pending', -- 'pending', 'completed', 'failed'
    export_file_path NVARCHAR(500),
    completed_at DATETIME2,
    expires_at DATETIME2, -- When the export file expires
    FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
);

-- Audit log for GDPR compliance and security monitoring
CREATE TABLE AuditLog (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT,
    action NVARCHAR(100) NOT NULL, -- 'login', 'logout', 'data_export', 'data_delete', etc.
    resource NVARCHAR(100), -- What was accessed/modified
    ip_address NVARCHAR(45),
    user_agent NVARCHAR(500),
    details NVARCHAR(MAX), -- JSON string with additional details
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE SET NULL
);

-- Indexes for performance optimization
CREATE INDEX IX_Users_Email ON Users(email);
CREATE INDEX IX_Users_EmailVerificationToken ON Users(email_verification_token);
CREATE INDEX IX_Users_PasswordResetToken ON Users(password_reset_token);
CREATE INDEX IX_Sessions_SessionId ON Sessions(session_id);
CREATE INDEX IX_Sessions_UserId ON Sessions(user_id);
CREATE INDEX IX_Sessions_ExpiresAt ON Sessions(expires_at);
CREATE INDEX IX_OAuthTokens_UserId ON OAuthTokens(user_id);
CREATE INDEX IX_OAuthTokens_Provider ON OAuthTokens(provider, provider_user_id);
CREATE INDEX IX_DataExportRequests_UserId ON DataExportRequests(user_id);
CREATE INDEX IX_DataExportRequests_Status ON DataExportRequests(status);
CREATE INDEX IX_AuditLog_UserId ON AuditLog(user_id);
CREATE INDEX IX_AuditLog_Action ON AuditLog(action);
CREATE INDEX IX_AuditLog_CreatedAt ON AuditLog(created_at);

-- Triggers for updating updated_at timestamps
-- Trigger for Users table
CREATE TRIGGER TR_Users_UpdatedAt
ON Users
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE Users 
    SET updated_at = GETUTCDATE()
    FROM Users u
    INNER JOIN inserted i ON u.id = i.id;
END;

-- Trigger for OAuthTokens table
CREATE TRIGGER TR_OAuthTokens_UpdatedAt
ON OAuthTokens
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE OAuthTokens 
    SET updated_at = GETUTCDATE()
    FROM OAuthTokens o
    INNER JOIN inserted i ON o.id = i.id;
END;

-- Cleanup procedure for expired sessions
CREATE PROCEDURE CleanupExpiredSessions
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Delete expired sessions
    DELETE FROM Sessions 
    WHERE expires_at < GETUTCDATE() OR is_active = 0;
    
    -- Log cleanup action
    INSERT INTO AuditLog (action, details, created_at)
    VALUES ('session_cleanup', 
            CONCAT('{"deleted_sessions": ', @@ROWCOUNT, '}'), 
            GETUTCDATE());
END;

-- Cleanup procedure for expired data export requests
CREATE PROCEDURE CleanupExpiredDataExports
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Delete expired export requests
    DELETE FROM DataExportRequests 
    WHERE expires_at < GETUTCDATE() AND status = 'completed';
    
    -- Log cleanup action
    INSERT INTO AuditLog (action, details, created_at)
    VALUES ('data_export_cleanup', 
            CONCAT('{"deleted_exports": ', @@ROWCOUNT, '}'), 
            GETUTCDATE());
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
    COUNT(CASE WHEN created_at > DATEADD(day, -7, GETUTCDATE()) THEN 1 END) as new_users_last_7_days
FROM Users 
WHERE is_active = 1;
