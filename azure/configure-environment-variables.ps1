# TaktMate Environment Variables Configuration Script (PowerShell)
# Usage: .\configure-environment-variables.ps1 -Environment production -Action deploy -Validate
# Example: .\configure-environment-variables.ps1 -Environment staging -Action generate -Backup -Verbose

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("production", "staging", "development")]
    [string]$Environment,
    
    [Parameter(Mandatory=$true)]
    [ValidateSet("generate", "deploy", "validate", "sync", "backup", "restore", "compare")]
    [string]$Action,
    
    [switch]$Validate,
    [switch]$Backup,
    [switch]$Force,
    [switch]$DryRun,
    [switch]$Help
)

# Function to show usage
function Show-Usage {
    Write-Host "TaktMate Environment Variables Configuration (PowerShell)" -ForegroundColor Magenta
    Write-Host ""
    Write-Host "Usage: .\configure-environment-variables.ps1 -Environment <env> -Action <action> [options]"
    Write-Host ""
    Write-Host "Environments:" -ForegroundColor Yellow
    Write-Host "  production  - Production environment configuration"
    Write-Host "  staging     - Staging environment configuration"
    Write-Host "  development - Development environment configuration"
    Write-Host ""
    Write-Host "Actions:" -ForegroundColor Yellow
    Write-Host "  generate    - Generate environment configuration files"
    Write-Host "  deploy      - Deploy environment variables to Azure services"
    Write-Host "  validate    - Validate environment configuration"
    Write-Host "  sync        - Sync environment variables between services"
    Write-Host "  backup      - Backup current environment configuration"
    Write-Host "  restore     - Restore environment configuration from backup"
    Write-Host "  compare     - Compare configurations between environments"
    Write-Host ""
    Write-Host "Options:" -ForegroundColor Yellow
    Write-Host "  -Validate      Validate configuration before deployment"
    Write-Host "  -Backup        Create backup before making changes"
    Write-Host "  -Force         Force deployment even if validation fails"
    Write-Host "  -DryRun        Show what would be configured without executing"
    Write-Host "  -Verbose       Enable verbose output"
    Write-Host "  -Help          Show this help message"
    Write-Host ""
    Write-Host "Examples:" -ForegroundColor Yellow
    Write-Host "  .\configure-environment-variables.ps1 -Environment production -Action generate -Validate"
    Write-Host "  .\configure-environment-variables.ps1 -Environment staging -Action deploy -Backup -Validate"
    Write-Host "  .\configure-environment-variables.ps1 -Environment development -Action validate"
}

# Show help if requested
if ($Help) {
    Show-Usage
    exit 0
}

# Color functions
function Write-Header($message) {
    Write-Host "========================================" -ForegroundColor Magenta
    Write-Host $message -ForegroundColor Magenta
    Write-Host "========================================" -ForegroundColor Magenta
}

function Write-Status($message) {
    Write-Host "[INFO] $message" -ForegroundColor Blue
}

function Write-Success($message) {
    Write-Host "[SUCCESS] $message" -ForegroundColor Green
}

function Write-Warning($message) {
    Write-Host "[WARNING] $message" -ForegroundColor Yellow
}

function Write-Error($message) {
    Write-Host "[ERROR] $message" -ForegroundColor Red
}

function Write-Step($message) {
    Write-Host "[STEP] $message" -ForegroundColor Cyan
}

# Set environment-specific variables
switch ($Environment) {
    "production" {
        $ResourceGroup = "taktmate-prod-rg"
        $KeyVaultName = "taktmate-kv-prod"
        $AppServiceName = "taktmate-api-prod"
        $StaticWebAppName = "taktmate-frontend-prod"
        $FrontendDomain = "app.taktmate.com"
        $BackendDomain = "api.taktmate.com"
        $TenantName = "taktmate"
        $SkuTier = "P1v3"
        $InstanceCount = "2"
        $AutoScale = "true"
        $EnableMonitoring = "true"
        $LogLevel = "warn"
    }
    "staging" {
        $ResourceGroup = "taktmate-staging-rg"
        $KeyVaultName = "taktmate-kv-staging"
        $AppServiceName = "taktmate-api-staging"
        $StaticWebAppName = "taktmate-frontend-staging"
        $FrontendDomain = "staging.taktmate.com"
        $BackendDomain = "api-staging.taktmate.com"
        $TenantName = "taktmate-staging"
        $SkuTier = "B2"
        $InstanceCount = "1"
        $AutoScale = "false"
        $EnableMonitoring = "true"
        $LogLevel = "info"
    }
    "development" {
        $ResourceGroup = "taktmate-dev-rg"
        $KeyVaultName = "taktmate-kv-dev"
        $AppServiceName = "taktmate-api-dev"
        $StaticWebAppName = "taktmate-frontend-dev"
        $FrontendDomain = "dev.taktmate.com"
        $BackendDomain = "api-dev.taktmate.com"
        $TenantName = "taktmate-dev"
        $SkuTier = "B1"
        $InstanceCount = "1"
        $AutoScale = "false"
        $EnableMonitoring = "false"
        $LogLevel = "debug"
    }
}

# Get script directory and create config directories
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$ConfigDir = Join-Path $ScriptDir "config"
$BackupDir = Join-Path $ScriptDir "backups"

# Create directories if they don't exist
if (-not (Test-Path $ConfigDir)) {
    New-Item -ItemType Directory -Path $ConfigDir -Force | Out-Null
}
if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}

# Function to execute or simulate commands
function Invoke-Command($Command, $Description) {
    if ($DryRun) {
        Write-Status "[DRY-RUN] Would execute: $Description"
        if ($VerbosePreference -eq "Continue") {
            Write-Status "[DRY-RUN] Command: $Command"
        }
        return $true
    } else {
        Write-Step $Description
        if ($VerbosePreference -eq "Continue") {
            Write-Host "Executing: $Command"
        }
        try {
            Invoke-Expression $Command
            return $true
        } catch {
            Write-Error "Command failed: $_"
            return $false
        }
    }
}

# Function to generate backend environment configuration
function New-BackendConfig {
    Write-Step "Generating backend environment configuration"
    
    $BackendEnvFile = Join-Path $ConfigDir "backend-$Environment.env"
    $Timestamp = Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ"
    
    $BackendConfig = @"
# TaktMate Backend Environment Configuration - $($Environment.ToUpper())
# Generated on $Timestamp

# ============================================================================
# AZURE CONFIGURATION
# ============================================================================

# Azure Key Vault Configuration
AZURE_KEY_VAULT_NAME=$KeyVaultName
AZURE_KEY_VAULT_URL=https://$KeyVaultName.vault.azure.net/

# Azure Application Insights Configuration
APPINSIGHTS_CONNECTION_STRING=@Microsoft.KeyVault(VaultName=$KeyVaultName;SecretName=AppInsights-ConnectionString)
APPINSIGHTS_INSTRUMENTATION_KEY=@Microsoft.KeyVault(VaultName=$KeyVaultName;SecretName=AppInsights-InstrumentationKey)
APPLICATIONINSIGHTS_CONNECTION_STRING=@Microsoft.KeyVault(VaultName=$KeyVaultName;SecretName=AppInsights-ConnectionString)

# ============================================================================
# AZURE AD B2C CONFIGURATION
# ============================================================================

# Azure AD B2C Tenant Configuration
AZURE_AD_B2C_TENANT_NAME=$TenantName
AZURE_AD_B2C_TENANT_ID=@Microsoft.KeyVault(VaultName=$KeyVaultName;SecretName=Azure-AD-B2C-Tenant-ID)
AZURE_AD_B2C_CLIENT_ID=@Microsoft.KeyVault(VaultName=$KeyVaultName;SecretName=Azure-AD-B2C-Client-ID)
AZURE_AD_B2C_CLIENT_SECRET=@Microsoft.KeyVault(VaultName=$KeyVaultName;SecretName=Azure-AD-B2C-Client-Secret)

# Azure AD B2C Endpoints
AZURE_AD_B2C_AUTHORITY=https://$TenantName.b2clogin.com/$TenantName.onmicrosoft.com/B2C_1_SignUpSignIn
AZURE_AD_B2C_KNOWN_AUTHORITY=$TenantName.b2clogin.com
AZURE_AD_B2C_DISCOVERY_ENDPOINT=https://$TenantName.b2clogin.com/$TenantName.onmicrosoft.com/B2C_1_SignUpSignIn/v2.0/.well-known/openid_configuration

# Azure AD B2C Policies
AZURE_AD_B2C_SIGNUP_SIGNIN_POLICY=B2C_1_SignUpSignIn
AZURE_AD_B2C_EDIT_PROFILE_POLICY=B2C_1_EditProfile
AZURE_AD_B2C_RESET_PASSWORD_POLICY=B2C_1_ResetPassword

# Azure AD B2C Scopes
AZURE_AD_B2C_SCOPE=https://$TenantName.onmicrosoft.com/api/read

# ============================================================================
# EXTERNAL SERVICE CONFIGURATION
# ============================================================================

# OpenAI Configuration
OPENAI_API_KEY=@Microsoft.KeyVault(VaultName=$KeyVaultName;SecretName=OpenAI-API-Key)
OPENAI_MODEL=gpt-4
OPENAI_MAX_TOKENS=2048
OPENAI_TEMPERATURE=0.7
OPENAI_TIMEOUT=30000

# ============================================================================
# APPLICATION CONFIGURATION
# ============================================================================

# Server Configuration
NODE_ENV=$Environment
PORT=3001
HOST=0.0.0.0

# CORS Configuration
CORS_ORIGIN=https://$FrontendDomain
CORS_CREDENTIALS=true

# Security Configuration
JWT_SECRET=@Microsoft.KeyVault(VaultName=$KeyVaultName;SecretName=JWT-Secret)
SESSION_SECRET=@Microsoft.KeyVault(VaultName=$KeyVaultName;SecretName=Session-Secret)

# File Upload Configuration
MAX_FILE_SIZE=5242880
ALLOWED_FILE_TYPES=text/csv,application/vnd.ms-excel
UPLOAD_TIMEOUT=30000

# ============================================================================
# LOGGING AND MONITORING CONFIGURATION
# ============================================================================

# Logging Configuration
LOG_LEVEL=$LogLevel
LOG_FORMAT=json
LOG_FILE_ENABLED=true
LOG_CONSOLE_ENABLED=true

# Application Insights Configuration
APPINSIGHTS_ENABLE_AUTO_COLLECT_CONSOLE=true
APPINSIGHTS_ENABLE_AUTO_COLLECT_EXCEPTIONS=true
APPINSIGHTS_ENABLE_AUTO_COLLECT_REQUESTS=true
APPINSIGHTS_ENABLE_AUTO_COLLECT_PERFORMANCE=true
APPINSIGHTS_ENABLE_AUTO_COLLECT_DEPENDENCIES=true
APPINSIGHTS_ENABLE_AUTO_COLLECT_HEARTBEAT=true
APPINSIGHTS_ENABLE_WEB_INSTRUMENTATION=false
APPINSIGHTS_ENABLE_LIVE_METRICS=true
APPINSIGHTS_ENABLE_DISK_CACHING=true
APPINSIGHTS_SAMPLING_PERCENTAGE=100

# Custom Telemetry Configuration
ENABLE_CUSTOM_TELEMETRY=$EnableMonitoring
ENABLE_CSV_TELEMETRY=$EnableMonitoring
ENABLE_PERFORMANCE_MONITORING=$EnableMonitoring
ENABLE_ERROR_TRACKING=$EnableMonitoring
ENABLE_RESOURCE_MONITORING=$EnableMonitoring

# Azure Monitor Configuration
AZURE_MONITOR_RESOURCE_GROUP=$ResourceGroup
AZURE_MONITOR_RESOURCE_NAME=$AppServiceName
AZURE_MONITOR_LOCATION=eastus

# ============================================================================
# PERFORMANCE AND SCALING CONFIGURATION
# ============================================================================

# Performance Configuration
REQUEST_TIMEOUT=30000
KEEP_ALIVE_TIMEOUT=5000
HEADERS_TIMEOUT=60000

# Rate Limiting Configuration
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100
RATE_LIMIT_SKIP_SUCCESS_REQUESTS=false

# Memory Management
NODE_OPTIONS=--max-old-space-size=1024

# ============================================================================
# FEATURE FLAGS
# ============================================================================

# Feature Toggle Configuration
FEATURE_ADVANCED_ANALYTICS=true
FEATURE_BULK_OPERATIONS=true
FEATURE_EXPORT_FUNCTIONALITY=true
FEATURE_REAL_TIME_COLLABORATION=false

# ============================================================================
# ENVIRONMENT SPECIFIC OVERRIDES
# ============================================================================

"@

    # Add environment-specific overrides
    switch ($Environment) {
        "production" {
            $BackendConfig += @"
# Production-specific configuration
DEBUG=false
TRUST_PROXY=true
SECURE_COOKIES=true
HTTP_STRICT_TRANSPORT_SECURITY=true
CONTENT_SECURITY_POLICY=true

"@
        }
        "staging" {
            $BackendConfig += @"
# Staging-specific configuration
DEBUG=false
TRUST_PROXY=true
SECURE_COOKIES=true

"@
        }
        "development" {
            $BackendConfig += @"
# Development-specific configuration
DEBUG=true
TRUST_PROXY=false
SECURE_COOKIES=false

"@
        }
    }
    
    $BackendConfig | Out-File -FilePath $BackendEnvFile -Encoding UTF8
    Write-Success "Backend configuration generated: $BackendEnvFile"
}

# Function to generate frontend environment configuration
function New-FrontendConfig {
    Write-Step "Generating frontend environment configuration"
    
    $FrontendEnvFile = Join-Path $ConfigDir "frontend-$Environment.env"
    $Timestamp = Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ"
    
    $FrontendConfig = @"
# TaktMate Frontend Environment Configuration - $($Environment.ToUpper())
# Generated on $Timestamp

# ============================================================================
# AZURE AD B2C CONFIGURATION
# ============================================================================

# Azure AD B2C Client Configuration
REACT_APP_AZURE_AD_B2C_CLIENT_ID=`${AZURE_AD_B2C_CLIENT_ID}
REACT_APP_AZURE_AD_B2C_AUTHORITY=https://$TenantName.b2clogin.com/$TenantName.onmicrosoft.com/B2C_1_SignUpSignIn
REACT_APP_AZURE_AD_B2C_KNOWN_AUTHORITY=$TenantName.b2clogin.com
REACT_APP_AZURE_AD_B2C_TENANT_NAME=$TenantName

# Azure AD B2C Policies
REACT_APP_AZURE_AD_B2C_SIGNUP_SIGNIN_POLICY=B2C_1_SignUpSignIn
REACT_APP_AZURE_AD_B2C_EDIT_PROFILE_POLICY=B2C_1_EditProfile
REACT_APP_AZURE_AD_B2C_RESET_PASSWORD_POLICY=B2C_1_ResetPassword

# Azure AD B2C Scopes
REACT_APP_AZURE_AD_B2C_SCOPE=https://$TenantName.onmicrosoft.com/api/read

# ============================================================================
# API CONFIGURATION
# ============================================================================

# Backend API Configuration
REACT_APP_API_BASE_URL=https://$BackendDomain
REACT_APP_API_TIMEOUT=30000
REACT_APP_API_RETRY_ATTEMPTS=3
REACT_APP_API_RETRY_DELAY=1000

# ============================================================================
# AUTHENTICATION CONFIGURATION
# ============================================================================

# Authentication URLs
REACT_APP_REDIRECT_URI=https://$FrontendDomain/auth/callback
REACT_APP_POST_LOGOUT_REDIRECT_URI=https://$FrontendDomain
REACT_APP_ERROR_REDIRECT_URI=https://$FrontendDomain/auth/error

# Authentication Settings
REACT_APP_AUTH_CACHE_LOCATION=localStorage
REACT_APP_AUTH_STORE_AUTH_STATE_IN_COOKIE=false
REACT_APP_AUTH_NAVIGATE_TO_LOGIN_REQUEST_URL=true

# ============================================================================
# APPLICATION CONFIGURATION
# ============================================================================

# Application Settings
REACT_APP_APP_NAME=TaktMate
REACT_APP_APP_VERSION=1.0.0
REACT_APP_APP_DESCRIPTION=AI-Powered CSV Data Analysis Platform

# Build Configuration
REACT_APP_BUILD_VERSION=`${GITHUB_SHA:-local}
REACT_APP_BUILD_DATE=$Timestamp

# ============================================================================
# FEATURE FLAGS
# ============================================================================

# Feature Toggle Configuration
REACT_APP_FEATURE_DARK_MODE=true
REACT_APP_FEATURE_EXPORT_DATA=true
REACT_APP_FEATURE_SHARE_RESULTS=true
REACT_APP_FEATURE_ADVANCED_FILTERS=true
REACT_APP_FEATURE_REAL_TIME_UPDATES=false

# ============================================================================
# MONITORING AND ANALYTICS
# ============================================================================

# Application Insights Configuration
REACT_APP_APPINSIGHTS_CONNECTION_STRING=`${APPINSIGHTS_CONNECTION_STRING}
REACT_APP_ENABLE_TELEMETRY=$EnableMonitoring

# ============================================================================
# ENVIRONMENT SPECIFIC CONFIGURATION
# ============================================================================

"@

    # Add environment-specific overrides
    switch ($Environment) {
        "production" {
            $FrontendConfig += @"
# Production-specific configuration
REACT_APP_ENVIRONMENT=production
REACT_APP_DEBUG=false
REACT_APP_ENABLE_DEVTOOLS=false
GENERATE_SOURCEMAP=false

"@
        }
        "staging" {
            $FrontendConfig += @"
# Staging-specific configuration
REACT_APP_ENVIRONMENT=staging
REACT_APP_DEBUG=true
REACT_APP_ENABLE_DEVTOOLS=true
GENERATE_SOURCEMAP=true

"@
        }
        "development" {
            $FrontendConfig += @"
# Development-specific configuration
REACT_APP_ENVIRONMENT=development
REACT_APP_DEBUG=true
REACT_APP_ENABLE_DEVTOOLS=true
GENERATE_SOURCEMAP=true
REACT_APP_API_BASE_URL=http://localhost:3001

"@
        }
    }
    
    $FrontendConfig | Out-File -FilePath $FrontendEnvFile -Encoding UTF8
    Write-Success "Frontend configuration generated: $FrontendEnvFile"
}

# Function to validate configuration
function Test-Configuration {
    Write-Header "VALIDATING CONFIGURATION"
    
    $ValidationFailed = $false
    
    # Check configuration files
    $BackendEnvFile = Join-Path $ConfigDir "backend-$Environment.env"
    $FrontendEnvFile = Join-Path $ConfigDir "frontend-$Environment.env"
    
    Write-Step "Checking configuration files"
    
    if (-not (Test-Path $BackendEnvFile)) {
        Write-Error "Backend configuration file not found: $BackendEnvFile"
        $ValidationFailed = $true
    } else {
        Write-Success "Backend configuration file exists"
    }
    
    if (-not (Test-Path $FrontendEnvFile)) {
        Write-Error "Frontend configuration file not found: $FrontendEnvFile"
        $ValidationFailed = $true
    } else {
        Write-Success "Frontend configuration file exists"
    }
    
    # Validate Azure CLI
    Write-Step "Validating Azure CLI authentication"
    if (-not $DryRun) {
        try {
            $Account = az account show --query "name" -o tsv 2>$null
            if ($Account) {
                Write-Success "Azure CLI authenticated - Subscription: $Account"
            } else {
                Write-Error "Azure CLI not authenticated. Please run 'az login'"
                $ValidationFailed = $true
            }
        } catch {
            Write-Error "Azure CLI not available or not authenticated"
            $ValidationFailed = $true
        }
    }
    
    return -not $ValidationFailed
}

# Function to deploy configuration
function Deploy-Configuration {
    Write-Header "DEPLOYING CONFIGURATION"
    
    Write-Step "Deploying App Service configuration"
    
    if (-not $DryRun) {
        try {
            # Deploy key environment variables to App Service
            $AppSettings = @(
                "NODE_ENV=$Environment",
                "AZURE_KEY_VAULT_NAME=$KeyVaultName",
                "AZURE_KEY_VAULT_URL=https://$KeyVaultName.vault.azure.net/",
                "CORS_ORIGIN=https://$FrontendDomain",
                "LOG_LEVEL=$LogLevel",
                "ENABLE_CUSTOM_TELEMETRY=$EnableMonitoring"
            )
            
            $SettingsString = $AppSettings -join " "
            az webapp config appsettings set --name $AppServiceName --resource-group $ResourceGroup --settings $SettingsString | Out-Null
            
            Write-Success "App Service configuration deployed"
        } catch {
            Write-Error "Failed to deploy App Service configuration: $_"
            return $false
        }
    } else {
        Write-Status "[DRY-RUN] Would deploy App Service configuration"
    }
    
    return $true
}

# Function to backup configuration
function Backup-Configuration {
    Write-Step "Backing up current configuration"
    
    $BackupTimestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $BackupFile = Join-Path $BackupDir "config-$Environment-$BackupTimestamp.zip"
    
    if (-not $DryRun) {
        if (Test-Path $ConfigDir) {
            try {
                Compress-Archive -Path "$ConfigDir\*" -DestinationPath $BackupFile -Force
                Write-Success "Configuration backed up to: $BackupFile"
            } catch {
                Write-Warning "Failed to create backup: $_"
            }
        } else {
            Write-Warning "No configuration directory to backup"
        }
    } else {
        Write-Status "[DRY-RUN] Would backup configuration to: $BackupFile"
    }
}

# Main execution
Write-Header "TAKTMATE ENVIRONMENT CONFIGURATION (POWERSHELL)"
Write-Status "Environment: $Environment"
Write-Status "Action: $Action"
Write-Status "Dry Run: $DryRun"
Write-Host ""

switch ($Action) {
    "generate" {
        if ($Backup) { Backup-Configuration }
        New-BackendConfig
        New-FrontendConfig
        if ($Validate) { Test-Configuration | Out-Null }
    }
    "deploy" {
        if ($Validate) {
            if (-not (Test-Configuration)) {
                if (-not $Force) {
                    Write-Error "Validation failed. Use -Force to deploy anyway"
                    exit 1
                } else {
                    Write-Warning "Validation failed but continuing due to -Force flag"
                }
            }
        }
        if ($Backup) { Backup-Configuration }
        Deploy-Configuration | Out-Null
    }
    "validate" {
        Test-Configuration | Out-Null
    }
    "sync" {
        Write-Header "SYNCING CONFIGURATION"
        Write-Warning "Sync functionality not yet implemented"
    }
    "backup" {
        Backup-Configuration
    }
    "restore" {
        Write-Header "RESTORING CONFIGURATION"
        Write-Warning "Restore functionality not yet implemented"
    }
    "compare" {
        Write-Header "COMPARING CONFIGURATIONS"
        Write-Warning "Compare functionality not yet implemented"
    }
}

Write-Header "CONFIGURATION $($Action.ToUpper()) COMPLETED! 🎉"
