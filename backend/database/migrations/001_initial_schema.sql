-- Migration 001: Initial TaktMate Schema
-- Created: 2024-01-01
-- Description: Initial database schema with Users, Sessions, OAuth tokens, and GDPR compliance tables

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

-- Migration tracking table
CREATE TABLE MigrationHistory (
    id INT IDENTITY(1,1) PRIMARY KEY,
    migration_name NVARCHAR(255) NOT NULL UNIQUE,
    executed_at DATETIME2 DEFAULT GETUTCDATE(),
    success BIT DEFAULT 1,
    error_message NVARCHAR(MAX),
    execution_time_ms INT
);

-- Record this migration
INSERT INTO MigrationHistory (migration_name, success, execution_time_ms) 
VALUES ('001_initial_schema', 1, 0);
