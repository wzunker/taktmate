#!/bin/bash

# TaktMate Environment Variables Configuration Script
# Usage: ./configure-environment-variables.sh [environment] [action] [options]
# Example: ./configure-environment-variables.sh production deploy --validate

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

print_header() {
    echo -e "${MAGENTA}========================================${NC}"
    echo -e "${MAGENTA}$1${NC}"
    echo -e "${MAGENTA}========================================${NC}"
}

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_step() {
    echo -e "${CYAN}[STEP]${NC} $1"
}

# Function to show usage
show_usage() {
    echo "TaktMate Environment Variables Configuration"
    echo ""
    echo "Usage: $0 [environment] [action] [options]"
    echo ""
    echo "Environments:"
    echo "  production  - Production environment configuration"
    echo "  staging     - Staging environment configuration"
    echo "  development - Development environment configuration"
    echo ""
    echo "Actions:"
    echo "  generate    - Generate environment configuration files"
    echo "  deploy      - Deploy environment variables to Azure services"
    echo "  validate    - Validate environment configuration"
    echo "  sync        - Sync environment variables between services"
    echo "  backup      - Backup current environment configuration"
    echo "  restore     - Restore environment configuration from backup"
    echo "  compare     - Compare configurations between environments"
    echo ""
    echo "Options:"
    echo "  --validate      Validate configuration before deployment"
    echo "  --backup        Create backup before making changes"
    echo "  --force         Force deployment even if validation fails"
    echo "  --dry-run       Show what would be configured without executing"
    echo "  --verbose       Enable verbose output"
    echo "  --help          Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 production generate --validate"
    echo "  $0 staging deploy --backup --validate"
    echo "  $0 development validate"
    echo "  $0 production sync --dry-run"
}

# Parse arguments
ENVIRONMENT=""
ACTION=""
VALIDATE=false
BACKUP=false
FORCE=false
DRY_RUN=false
VERBOSE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        production|staging|development)
            ENVIRONMENT="$1"
            shift
            ;;
        generate|deploy|validate|sync|backup|restore|compare)
            ACTION="$1"
            shift
            ;;
        --validate)
            VALIDATE=true
            shift
            ;;
        --backup)
            BACKUP=true
            shift
            ;;
        --force)
            FORCE=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        --help)
            show_usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Validate arguments
if [[ ! "$ENVIRONMENT" =~ ^(production|staging|development)$ ]]; then
    print_error "Environment must be specified: production, staging, or development"
    show_usage
    exit 1
fi

if [[ ! "$ACTION" =~ ^(generate|deploy|validate|sync|backup|restore|compare)$ ]]; then
    print_error "Action must be specified: generate, deploy, validate, sync, backup, restore, or compare"
    show_usage
    exit 1
fi

# Set environment-specific variables
case "$ENVIRONMENT" in
    "production")
        RESOURCE_GROUP="taktmate-prod-rg"
        KEY_VAULT_NAME="taktmate-kv-prod"
        APP_SERVICE_NAME="taktmate-api-prod"
        STATIC_WEB_APP_NAME="taktmate-frontend-prod"
        FRONTEND_DOMAIN="app.taktmate.com"
        BACKEND_DOMAIN="api.taktmate.com"
        TENANT_NAME="taktmate"
        SKU_TIER="P1v3"
        INSTANCE_COUNT="2"
        AUTO_SCALE="true"
        ENABLE_MONITORING="true"
        LOG_LEVEL="warn"
        ;;
    "staging")
        RESOURCE_GROUP="taktmate-staging-rg"
        KEY_VAULT_NAME="taktmate-kv-staging"
        APP_SERVICE_NAME="taktmate-api-staging"
        STATIC_WEB_APP_NAME="taktmate-frontend-staging"
        FRONTEND_DOMAIN="staging.taktmate.com"
        BACKEND_DOMAIN="api-staging.taktmate.com"
        TENANT_NAME="taktmate-staging"
        SKU_TIER="B2"
        INSTANCE_COUNT="1"
        AUTO_SCALE="false"
        ENABLE_MONITORING="true"
        LOG_LEVEL="info"
        ;;
    "development")
        RESOURCE_GROUP="taktmate-dev-rg"
        KEY_VAULT_NAME="taktmate-kv-dev"
        APP_SERVICE_NAME="taktmate-api-dev"
        STATIC_WEB_APP_NAME="taktmate-frontend-dev"
        FRONTEND_DOMAIN="dev.taktmate.com"
        BACKEND_DOMAIN="api-dev.taktmate.com"
        TENANT_NAME="taktmate-dev"
        SKU_TIER="B1"
        INSTANCE_COUNT="1"
        AUTO_SCALE="false"
        ENABLE_MONITORING="false"
        LOG_LEVEL="debug"
        ;;
esac

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CONFIG_DIR="$SCRIPT_DIR/config"
BACKUP_DIR="$SCRIPT_DIR/backups"

# Create directories if they don't exist
mkdir -p "$CONFIG_DIR"
mkdir -p "$BACKUP_DIR"

# Function to execute or simulate commands
execute_command() {
    local command="$1"
    local description="$2"
    
    if [ "$DRY_RUN" = true ]; then
        print_status "[DRY-RUN] Would execute: $description"
        if [ "$VERBOSE" = true ]; then
            print_status "[DRY-RUN] Command: $command"
        fi
        return 0
    else
        print_step "$description"
        if [ "$VERBOSE" = true ]; then
            echo "Executing: $command"
        fi
        eval "$command"
        return $?
    fi
}

# Function to generate backend environment configuration
generate_backend_config() {
    print_step "Generating backend environment configuration"
    
    local backend_env_file="$CONFIG_DIR/backend-${ENVIRONMENT}.env"
    
    cat > "$backend_env_file" << EOF
# TaktMate Backend Environment Configuration - ${ENVIRONMENT^^}
# Generated on $(date -u +%Y-%m-%dT%H:%M:%SZ)

# ============================================================================
# AZURE CONFIGURATION
# ============================================================================

# Azure Key Vault Configuration
AZURE_KEY_VAULT_NAME=${KEY_VAULT_NAME}
AZURE_KEY_VAULT_URL=https://${KEY_VAULT_NAME}.vault.azure.net/

# Azure Application Insights Configuration
APPINSIGHTS_CONNECTION_STRING=@Microsoft.KeyVault(VaultName=${KEY_VAULT_NAME};SecretName=AppInsights-ConnectionString)
APPINSIGHTS_INSTRUMENTATION_KEY=@Microsoft.KeyVault(VaultName=${KEY_VAULT_NAME};SecretName=AppInsights-InstrumentationKey)
APPLICATIONINSIGHTS_CONNECTION_STRING=@Microsoft.KeyVault(VaultName=${KEY_VAULT_NAME};SecretName=AppInsights-ConnectionString)

# ============================================================================
# AZURE AD B2C CONFIGURATION
# ============================================================================

# Azure AD B2C Tenant Configuration
AZURE_AD_B2C_TENANT_NAME=${TENANT_NAME}
AZURE_AD_B2C_TENANT_ID=@Microsoft.KeyVault(VaultName=${KEY_VAULT_NAME};SecretName=Azure-AD-B2C-Tenant-ID)
AZURE_AD_B2C_CLIENT_ID=@Microsoft.KeyVault(VaultName=${KEY_VAULT_NAME};SecretName=Azure-AD-B2C-Client-ID)
AZURE_AD_B2C_CLIENT_SECRET=@Microsoft.KeyVault(VaultName=${KEY_VAULT_NAME};SecretName=Azure-AD-B2C-Client-Secret)

# Azure AD B2C Endpoints
AZURE_AD_B2C_AUTHORITY=https://${TENANT_NAME}.b2clogin.com/${TENANT_NAME}.onmicrosoft.com/B2C_1_SignUpSignIn
AZURE_AD_B2C_KNOWN_AUTHORITY=${TENANT_NAME}.b2clogin.com
AZURE_AD_B2C_DISCOVERY_ENDPOINT=https://${TENANT_NAME}.b2clogin.com/${TENANT_NAME}.onmicrosoft.com/B2C_1_SignUpSignIn/v2.0/.well-known/openid_configuration

# Azure AD B2C Policies
AZURE_AD_B2C_SIGNUP_SIGNIN_POLICY=B2C_1_SignUpSignIn
AZURE_AD_B2C_EDIT_PROFILE_POLICY=B2C_1_EditProfile
AZURE_AD_B2C_RESET_PASSWORD_POLICY=B2C_1_ResetPassword

# Azure AD B2C Scopes
AZURE_AD_B2C_SCOPE=https://${TENANT_NAME}.onmicrosoft.com/api/read

# ============================================================================
# EXTERNAL SERVICE CONFIGURATION
# ============================================================================

# OpenAI Configuration
OPENAI_API_KEY=@Microsoft.KeyVault(VaultName=${KEY_VAULT_NAME};SecretName=OpenAI-API-Key)
OPENAI_MODEL=gpt-4
OPENAI_MAX_TOKENS=2048
OPENAI_TEMPERATURE=0.7
OPENAI_TIMEOUT=30000

# ============================================================================
# APPLICATION CONFIGURATION
# ============================================================================

# Server Configuration
NODE_ENV=${ENVIRONMENT}
PORT=3001
HOST=0.0.0.0

# CORS Configuration
CORS_ORIGIN=https://${FRONTEND_DOMAIN}
CORS_CREDENTIALS=true

# Security Configuration
JWT_SECRET=@Microsoft.KeyVault(VaultName=${KEY_VAULT_NAME};SecretName=JWT-Secret)
SESSION_SECRET=@Microsoft.KeyVault(VaultName=${KEY_VAULT_NAME};SecretName=Session-Secret)

# File Upload Configuration
MAX_FILE_SIZE=5242880
ALLOWED_FILE_TYPES=text/csv,application/vnd.ms-excel
UPLOAD_TIMEOUT=30000

# ============================================================================
# LOGGING AND MONITORING CONFIGURATION
# ============================================================================

# Logging Configuration
LOG_LEVEL=${LOG_LEVEL}
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
ENABLE_CUSTOM_TELEMETRY=${ENABLE_MONITORING}
ENABLE_CSV_TELEMETRY=${ENABLE_MONITORING}
ENABLE_PERFORMANCE_MONITORING=${ENABLE_MONITORING}
ENABLE_ERROR_TRACKING=${ENABLE_MONITORING}
ENABLE_RESOURCE_MONITORING=${ENABLE_MONITORING}

# Azure Monitor Configuration
AZURE_MONITOR_RESOURCE_GROUP=${RESOURCE_GROUP}
AZURE_MONITOR_RESOURCE_NAME=${APP_SERVICE_NAME}
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

EOF

    # Add environment-specific overrides
    if [ "$ENVIRONMENT" = "production" ]; then
        cat >> "$backend_env_file" << EOF
# Production-specific configuration
DEBUG=false
TRUST_PROXY=true
SECURE_COOKIES=true
HTTP_STRICT_TRANSPORT_SECURITY=true
CONTENT_SECURITY_POLICY=true

EOF
    elif [ "$ENVIRONMENT" = "staging" ]; then
        cat >> "$backend_env_file" << EOF
# Staging-specific configuration
DEBUG=false
TRUST_PROXY=true
SECURE_COOKIES=true

EOF
    else
        cat >> "$backend_env_file" << EOF
# Development-specific configuration
DEBUG=true
TRUST_PROXY=false
SECURE_COOKIES=false

EOF
    fi
    
    print_success "Backend configuration generated: $backend_env_file"
}

# Function to generate frontend environment configuration
generate_frontend_config() {
    print_step "Generating frontend environment configuration"
    
    local frontend_env_file="$CONFIG_DIR/frontend-${ENVIRONMENT}.env"
    
    cat > "$frontend_env_file" << EOF
# TaktMate Frontend Environment Configuration - ${ENVIRONMENT^^}
# Generated on $(date -u +%Y-%m-%dT%H:%M:%SZ)

# ============================================================================
# AZURE AD B2C CONFIGURATION
# ============================================================================

# Azure AD B2C Client Configuration
REACT_APP_AZURE_AD_B2C_CLIENT_ID=\${AZURE_AD_B2C_CLIENT_ID}
REACT_APP_AZURE_AD_B2C_AUTHORITY=https://${TENANT_NAME}.b2clogin.com/${TENANT_NAME}.onmicrosoft.com/B2C_1_SignUpSignIn
REACT_APP_AZURE_AD_B2C_KNOWN_AUTHORITY=${TENANT_NAME}.b2clogin.com
REACT_APP_AZURE_AD_B2C_TENANT_NAME=${TENANT_NAME}

# Azure AD B2C Policies
REACT_APP_AZURE_AD_B2C_SIGNUP_SIGNIN_POLICY=B2C_1_SignUpSignIn
REACT_APP_AZURE_AD_B2C_EDIT_PROFILE_POLICY=B2C_1_EditProfile
REACT_APP_AZURE_AD_B2C_RESET_PASSWORD_POLICY=B2C_1_ResetPassword

# Azure AD B2C Scopes
REACT_APP_AZURE_AD_B2C_SCOPE=https://${TENANT_NAME}.onmicrosoft.com/api/read

# ============================================================================
# API CONFIGURATION
# ============================================================================

# Backend API Configuration
REACT_APP_API_BASE_URL=https://${BACKEND_DOMAIN}
REACT_APP_API_TIMEOUT=30000
REACT_APP_API_RETRY_ATTEMPTS=3
REACT_APP_API_RETRY_DELAY=1000

# ============================================================================
# AUTHENTICATION CONFIGURATION
# ============================================================================

# Authentication URLs
REACT_APP_REDIRECT_URI=https://${FRONTEND_DOMAIN}/auth/callback
REACT_APP_POST_LOGOUT_REDIRECT_URI=https://${FRONTEND_DOMAIN}
REACT_APP_ERROR_REDIRECT_URI=https://${FRONTEND_DOMAIN}/auth/error

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
REACT_APP_BUILD_VERSION=\${GITHUB_SHA:-local}
REACT_APP_BUILD_DATE=\$(date -u +%Y-%m-%dT%H:%M:%SZ)

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
REACT_APP_APPINSIGHTS_CONNECTION_STRING=\${APPINSIGHTS_CONNECTION_STRING}
REACT_APP_ENABLE_TELEMETRY=${ENABLE_MONITORING}

# ============================================================================
# ENVIRONMENT SPECIFIC CONFIGURATION
# ============================================================================

EOF

    # Add environment-specific overrides
    if [ "$ENVIRONMENT" = "production" ]; then
        cat >> "$frontend_env_file" << EOF
# Production-specific configuration
REACT_APP_ENVIRONMENT=production
REACT_APP_DEBUG=false
REACT_APP_ENABLE_DEVTOOLS=false
GENERATE_SOURCEMAP=false

EOF
    elif [ "$ENVIRONMENT" = "staging" ]; then
        cat >> "$frontend_env_file" << EOF
# Staging-specific configuration
REACT_APP_ENVIRONMENT=staging
REACT_APP_DEBUG=true
REACT_APP_ENABLE_DEVTOOLS=true
GENERATE_SOURCEMAP=true

EOF
    else
        cat >> "$frontend_env_file" << EOF
# Development-specific configuration
REACT_APP_ENVIRONMENT=development
REACT_APP_DEBUG=true
REACT_APP_ENABLE_DEVTOOLS=true
GENERATE_SOURCEMAP=true
REACT_APP_API_BASE_URL=http://localhost:3001

EOF
    fi
    
    print_success "Frontend configuration generated: $frontend_env_file"
}

# Function to generate Azure App Service configuration
generate_app_service_config() {
    print_step "Generating App Service configuration"
    
    local app_service_config_file="$CONFIG_DIR/app-service-${ENVIRONMENT}.json"
    
    cat > "$app_service_config_file" << EOF
{
  "appServiceName": "${APP_SERVICE_NAME}",
  "resourceGroup": "${RESOURCE_GROUP}",
  "environment": "${ENVIRONMENT}",
  "configuration": {
    "appSettings": [
      {
        "name": "NODE_ENV",
        "value": "${ENVIRONMENT}"
      },
      {
        "name": "PORT",
        "value": "3001"
      },
      {
        "name": "AZURE_KEY_VAULT_NAME",
        "value": "${KEY_VAULT_NAME}"
      },
      {
        "name": "AZURE_KEY_VAULT_URL",
        "value": "https://${KEY_VAULT_NAME}.vault.azure.net/"
      },
      {
        "name": "APPINSIGHTS_CONNECTION_STRING",
        "value": "@Microsoft.KeyVault(VaultName=${KEY_VAULT_NAME};SecretName=AppInsights-ConnectionString)"
      },
      {
        "name": "APPLICATIONINSIGHTS_CONNECTION_STRING",
        "value": "@Microsoft.KeyVault(VaultName=${KEY_VAULT_NAME};SecretName=AppInsights-ConnectionString)"
      },
      {
        "name": "AZURE_AD_B2C_TENANT_NAME",
        "value": "${TENANT_NAME}"
      },
      {
        "name": "AZURE_AD_B2C_CLIENT_ID",
        "value": "@Microsoft.KeyVault(VaultName=${KEY_VAULT_NAME};SecretName=Azure-AD-B2C-Client-ID)"
      },
      {
        "name": "AZURE_AD_B2C_CLIENT_SECRET",
        "value": "@Microsoft.KeyVault(VaultName=${KEY_VAULT_NAME};SecretName=Azure-AD-B2C-Client-Secret)"
      },
      {
        "name": "OPENAI_API_KEY",
        "value": "@Microsoft.KeyVault(VaultName=${KEY_VAULT_NAME};SecretName=OpenAI-API-Key)"
      },
      {
        "name": "JWT_SECRET",
        "value": "@Microsoft.KeyVault(VaultName=${KEY_VAULT_NAME};SecretName=JWT-Secret)"
      },
      {
        "name": "SESSION_SECRET",
        "value": "@Microsoft.KeyVault(VaultName=${KEY_VAULT_NAME};SecretName=Session-Secret)"
      },
      {
        "name": "CORS_ORIGIN",
        "value": "https://${FRONTEND_DOMAIN}"
      },
      {
        "name": "LOG_LEVEL",
        "value": "${LOG_LEVEL}"
      },
      {
        "name": "ENABLE_CUSTOM_TELEMETRY",
        "value": "${ENABLE_MONITORING}"
      },
      {
        "name": "WEBSITE_NODE_DEFAULT_VERSION",
        "value": "18.19.0"
      },
      {
        "name": "WEBSITE_RUN_FROM_PACKAGE",
        "value": "1"
      },
      {
        "name": "SCM_DO_BUILD_DURING_DEPLOYMENT",
        "value": "false"
      }
    ],
    "connectionStrings": [],
    "metadata": [
      {
        "name": "CURRENT_STACK",
        "value": "node"
      }
    ]
  },
  "siteConfig": {
    "nodeVersion": "18.19.0",
    "appCommandLine": "npm start",
    "linuxFxVersion": "NODE|18-lts",
    "alwaysOn": $([ "$ENVIRONMENT" = "production" ] && echo "true" || echo "false"),
    "http20Enabled": true,
    "minTlsVersion": "1.2",
    "ftpsState": "Disabled",
    "healthCheckPath": "/api/health"
  }
}
EOF
    
    print_success "App Service configuration generated: $app_service_config_file"
}

# Function to generate Static Web App configuration
generate_static_web_app_config() {
    print_step "Generating Static Web App configuration"
    
    local swa_config_file="$CONFIG_DIR/static-web-app-${ENVIRONMENT}.json"
    
    cat > "$swa_config_file" << EOF
{
  "staticWebAppName": "${STATIC_WEB_APP_NAME}",
  "resourceGroup": "${RESOURCE_GROUP}",
  "environment": "${ENVIRONMENT}",
  "configuration": {
    "appSettings": [
      {
        "name": "REACT_APP_AZURE_AD_B2C_CLIENT_ID",
        "value": "\${AZURE_AD_B2C_CLIENT_ID}"
      },
      {
        "name": "REACT_APP_AZURE_AD_B2C_AUTHORITY",
        "value": "https://${TENANT_NAME}.b2clogin.com/${TENANT_NAME}.onmicrosoft.com/B2C_1_SignUpSignIn"
      },
      {
        "name": "REACT_APP_AZURE_AD_B2C_KNOWN_AUTHORITY",
        "value": "${TENANT_NAME}.b2clogin.com"
      },
      {
        "name": "REACT_APP_AZURE_AD_B2C_TENANT_NAME",
        "value": "${TENANT_NAME}"
      },
      {
        "name": "REACT_APP_API_BASE_URL",
        "value": "https://${BACKEND_DOMAIN}"
      },
      {
        "name": "REACT_APP_REDIRECT_URI",
        "value": "https://${FRONTEND_DOMAIN}/auth/callback"
      },
      {
        "name": "REACT_APP_POST_LOGOUT_REDIRECT_URI",
        "value": "https://${FRONTEND_DOMAIN}"
      },
      {
        "name": "REACT_APP_ENVIRONMENT",
        "value": "${ENVIRONMENT}"
      }
    ]
  }
}
EOF
    
    print_success "Static Web App configuration generated: $swa_config_file"
}

# Function to validate environment configuration
validate_configuration() {
    print_header "VALIDATING CONFIGURATION"
    
    local validation_failed=false
    
    # Check if configuration files exist
    local backend_env_file="$CONFIG_DIR/backend-${ENVIRONMENT}.env"
    local frontend_env_file="$CONFIG_DIR/frontend-${ENVIRONMENT}.env"
    local app_service_config_file="$CONFIG_DIR/app-service-${ENVIRONMENT}.json"
    local swa_config_file="$CONFIG_DIR/static-web-app-${ENVIRONMENT}.json"
    
    print_step "Checking configuration files"
    
    if [ ! -f "$backend_env_file" ]; then
        print_error "Backend configuration file not found: $backend_env_file"
        validation_failed=true
    else
        print_success "Backend configuration file exists"
    fi
    
    if [ ! -f "$frontend_env_file" ]; then
        print_error "Frontend configuration file not found: $frontend_env_file"
        validation_failed=true
    else
        print_success "Frontend configuration file exists"
    fi
    
    if [ ! -f "$app_service_config_file" ]; then
        print_error "App Service configuration file not found: $app_service_config_file"
        validation_failed=true
    else
        print_success "App Service configuration file exists"
        
        # Validate JSON syntax
        if jq empty "$app_service_config_file" &>/dev/null; then
            print_success "App Service configuration JSON is valid"
        else
            print_error "App Service configuration JSON is invalid"
            validation_failed=true
        fi
    fi
    
    if [ ! -f "$swa_config_file" ]; then
        print_error "Static Web App configuration file not found: $swa_config_file"
        validation_failed=true
    else
        print_success "Static Web App configuration file exists"
        
        # Validate JSON syntax
        if jq empty "$swa_config_file" &>/dev/null; then
            print_success "Static Web App configuration JSON is valid"
        else
            print_error "Static Web App configuration JSON is invalid"
            validation_failed=true
        fi
    fi
    
    # Validate Azure CLI login
    print_step "Validating Azure CLI authentication"
    if [ "$DRY_RUN" = false ]; then
        if az account show &>/dev/null; then
            local subscription=$(az account show --query "name" -o tsv)
            print_success "Azure CLI authenticated - Subscription: $subscription"
        else
            print_error "Azure CLI not authenticated. Please run 'az login'"
            validation_failed=true
        fi
    fi
    
    # Validate Azure resources exist
    print_step "Validating Azure resources"
    if [ "$DRY_RUN" = false ]; then
        if az group show --name "$RESOURCE_GROUP" &>/dev/null; then
            print_success "Resource group exists: $RESOURCE_GROUP"
        else
            print_warning "Resource group does not exist: $RESOURCE_GROUP"
        fi
        
        if az keyvault show --name "$KEY_VAULT_NAME" &>/dev/null; then
            print_success "Key Vault exists: $KEY_VAULT_NAME"
        else
            print_warning "Key Vault does not exist: $KEY_VAULT_NAME"
        fi
        
        if az webapp show --name "$APP_SERVICE_NAME" --resource-group "$RESOURCE_GROUP" &>/dev/null; then
            print_success "App Service exists: $APP_SERVICE_NAME"
        else
            print_warning "App Service does not exist: $APP_SERVICE_NAME"
        fi
    fi
    
    if [ "$validation_failed" = true ]; then
        print_error "Configuration validation failed"
        return 1
    else
        print_success "Configuration validation passed"
        return 0
    fi
}

# Function to deploy configuration to Azure services
deploy_configuration() {
    print_header "DEPLOYING CONFIGURATION"
    
    # Deploy App Service configuration
    print_step "Deploying App Service configuration"
    local app_service_config_file="$CONFIG_DIR/app-service-${ENVIRONMENT}.json"
    
    if [ "$DRY_RUN" = false ]; then
        # Extract app settings from JSON and deploy
        local app_settings=$(jq -r '.configuration.appSettings[] | "\(.name)=\(.value)"' "$app_service_config_file" | tr '\n' ' ')
        
        if az webapp config appsettings set \
            --name "$APP_SERVICE_NAME" \
            --resource-group "$RESOURCE_GROUP" \
            --settings $app_settings &>/dev/null; then
            print_success "App Service configuration deployed"
        else
            print_error "Failed to deploy App Service configuration"
            return 1
        fi
        
        # Update site configuration
        local node_version=$(jq -r '.siteConfig.nodeVersion' "$app_service_config_file")
        local always_on=$(jq -r '.siteConfig.alwaysOn' "$app_service_config_file")
        local health_check_path=$(jq -r '.siteConfig.healthCheckPath' "$app_service_config_file")
        
        az webapp config set \
            --name "$APP_SERVICE_NAME" \
            --resource-group "$RESOURCE_GROUP" \
            --linux-fx-version "NODE|${node_version}" \
            --always-on "$always_on" \
            --health-check-path "$health_check_path" \
            --http20-enabled true \
            --min-tls-version "1.2" \
            --ftps-state "Disabled" &>/dev/null
            
        print_success "App Service site configuration updated"
    else
        print_status "[DRY-RUN] Would deploy App Service configuration from: $app_service_config_file"
    fi
    
    # Deploy Static Web App configuration
    print_step "Deploying Static Web App configuration"
    local swa_config_file="$CONFIG_DIR/static-web-app-${ENVIRONMENT}.json"
    
    if [ "$DRY_RUN" = false ]; then
        # Note: Static Web App settings are typically managed through GitHub Actions
        # or Azure DevOps pipelines. This would be implemented based on specific needs.
        print_warning "Static Web App configuration deployment requires manual setup or CI/CD pipeline integration"
    else
        print_status "[DRY-RUN] Would deploy Static Web App configuration from: $swa_config_file"
    fi
    
    print_success "Configuration deployment completed"
}

# Function to backup current configuration
backup_configuration() {
    print_step "Backing up current configuration"
    
    local backup_timestamp=$(date +%Y%m%d-%H%M%S)
    local backup_file="$BACKUP_DIR/config-${ENVIRONMENT}-${backup_timestamp}.tar.gz"
    
    if [ "$DRY_RUN" = false ]; then
        # Create backup of current configuration files
        if [ -d "$CONFIG_DIR" ]; then
            tar -czf "$backup_file" -C "$CONFIG_DIR" . &>/dev/null
            print_success "Configuration backed up to: $backup_file"
        else
            print_warning "No configuration directory to backup"
        fi
        
        # Backup Azure service configurations
        if az account show &>/dev/null; then
            local azure_backup_file="$BACKUP_DIR/azure-config-${ENVIRONMENT}-${backup_timestamp}.json"
            
            # Backup App Service settings
            if az webapp show --name "$APP_SERVICE_NAME" --resource-group "$RESOURCE_GROUP" &>/dev/null; then
                az webapp config appsettings list \
                    --name "$APP_SERVICE_NAME" \
                    --resource-group "$RESOURCE_GROUP" \
                    --output json > "$azure_backup_file" 2>/dev/null
                print_success "Azure configuration backed up to: $azure_backup_file"
            fi
        fi
    else
        print_status "[DRY-RUN] Would backup configuration to: $backup_file"
    fi
}

# Main function to execute the specified action
main() {
    print_header "TAKTMATE ENVIRONMENT CONFIGURATION"
    print_status "Environment: $ENVIRONMENT"
    print_status "Action: $ACTION"
    print_status "Dry Run: $DRY_RUN"
    echo ""
    
    case "$ACTION" in
        "generate")
            if [ "$BACKUP" = true ]; then
                backup_configuration
            fi
            generate_backend_config
            generate_frontend_config
            generate_app_service_config
            generate_static_web_app_config
            if [ "$VALIDATE" = true ]; then
                validate_configuration
            fi
            ;;
        "deploy")
            if [ "$VALIDATE" = true ]; then
                if ! validate_configuration; then
                    if [ "$FORCE" = false ]; then
                        print_error "Validation failed. Use --force to deploy anyway"
                        exit 1
                    else
                        print_warning "Validation failed but continuing due to --force flag"
                    fi
                fi
            fi
            if [ "$BACKUP" = true ]; then
                backup_configuration
            fi
            deploy_configuration
            ;;
        "validate")
            validate_configuration
            ;;
        "sync")
            print_header "SYNCING CONFIGURATION"
            print_warning "Sync functionality not yet implemented"
            ;;
        "backup")
            backup_configuration
            ;;
        "restore")
            print_header "RESTORING CONFIGURATION"
            print_warning "Restore functionality not yet implemented"
            ;;
        "compare")
            print_header "COMPARING CONFIGURATIONS"
            print_warning "Compare functionality not yet implemented"
            ;;
    esac
    
    print_header "CONFIGURATION ${ACTION^^} COMPLETED! 🎉"
}

# Execute main function
main "$@"
