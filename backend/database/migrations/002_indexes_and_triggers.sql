-- Migration 002: Indexes, Triggers, and Performance Optimizations
-- Created: 2024-01-01
-- Description: Add indexes for performance and triggers for automatic timestamp updates

-- Indexes for performance optimization
CREATE INDEX IX_Users_Email ON Users(email);
CREATE INDEX IX_Users_EmailVerificationToken ON Users(email_verification_token);
CREATE INDEX IX_Users_PasswordResetToken ON Users(password_reset_token);
CREATE INDEX IX_Users_IsActive ON Users(is_active);
CREATE INDEX IX_Users_CreatedAt ON Users(created_at);

CREATE INDEX IX_Sessions_SessionId ON Sessions(session_id);
CREATE INDEX IX_Sessions_UserId ON Sessions(user_id);
CREATE INDEX IX_Sessions_ExpiresAt ON Sessions(expires_at);
CREATE INDEX IX_Sessions_IsActive ON Sessions(is_active);
CREATE INDEX IX_Sessions_LastAccessed ON Sessions(last_accessed);

CREATE INDEX IX_OAuthTokens_UserId ON OAuthTokens(user_id);
CREATE INDEX IX_OAuthTokens_Provider ON OAuthTokens(provider, provider_user_id);
CREATE INDEX IX_OAuthTokens_TokenExpiresAt ON OAuthTokens(token_expires_at);

CREATE INDEX IX_DataExportRequests_UserId ON DataExportRequests(user_id);
CREATE INDEX IX_DataExportRequests_Status ON DataExportRequests(status);
CREATE INDEX IX_DataExportRequests_ExpiresAt ON DataExportRequests(expires_at);

CREATE INDEX IX_AuditLog_UserId ON AuditLog(user_id);
CREATE INDEX IX_AuditLog_Action ON AuditLog(action);
CREATE INDEX IX_AuditLog_CreatedAt ON AuditLog(created_at);
CREATE INDEX IX_AuditLog_Resource ON AuditLog(resource);

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

-- Record this migration
INSERT INTO MigrationHistory (migration_name, success, execution_time_ms) 
VALUES ('002_indexes_and_triggers', 1, 0);
