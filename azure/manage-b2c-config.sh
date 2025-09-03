#!/bin/bash

# Manage Azure AD B2C Configuration across environments
# Usage: ./manage-b2c-config.sh [command] [environment] [options...]
# Commands: generate-env, update-secrets, validate, export, import
# Examples:
#   ./manage-b2c-config.sh generate-env production
#   ./manage-b2c-config.sh update-secrets staging
#   ./manage-b2c-config.sh validate production

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Function to show usage
show_usage() {
    echo "Usage: $0 [command] [environment] [options...]"
    echo ""
    echo "Commands:"
    echo "  generate-env    - Generate environment variables file"
    echo "  update-secrets  - Update Key Vault secrets with B2C configuration"
    echo "  validate        - Validate B2C configuration"
    echo "  export          - Export B2C configuration to file"
    echo "  import          - Import B2C configuration from file"
    echo ""
    echo "Environments: production, staging, development"
    echo ""
    echo "Examples:"
    echo "  $0 generate-env production"
    echo "  $0 update-secrets staging"
    echo "  $0 validate production"
    echo "  $0 export production b2c-config.json"
    echo "  $0 import staging b2c-config.json"
}

# Parse arguments
COMMAND=${1:-""}
ENVIRONMENT=${2:-""}
OPTION=${3:-""}

# Validate command
if [[ ! "$COMMAND" =~ ^(generate-env|update-secrets|validate|export|import)$ ]]; then
    print_error "Invalid command: $COMMAND"
    show_usage
    exit 1
fi

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(production|staging|development)$ ]]; then
    print_error "Invalid environment: $ENVIRONMENT"
    show_usage
    exit 1
fi

# Configuration based on environment
case "$ENVIRONMENT" in
    "production")
        TENANT_NAME="taktmate"
        FRONTEND_URL="https://app.taktmate.com"
        BACKEND_URL="https://api.taktmate.com"
        KEY_VAULT_NAME="taktmate-kv-prod"
        ;;
    "staging")
        TENANT_NAME="taktmate-staging"
        FRONTEND_URL="https://staging.taktmate.com"
        BACKEND_URL="https://api-staging.taktmate.com"
        KEY_VAULT_NAME="taktmate-kv-staging"
        ;;
    "development")
        TENANT_NAME="taktmate-dev"
        FRONTEND_URL="http://localhost:3000"
        BACKEND_URL="http://localhost:3001"
        KEY_VAULT_NAME="taktmate-kv-dev"
        ;;
esac

# Function to generate environment variables
generate_env() {
    print_status "Generating environment variables for $ENVIRONMENT environment"
    
    local env_file="b2c-env-${ENVIRONMENT}.env"
    
    cat > "$env_file" << EOF
# Azure AD B2C Configuration for $ENVIRONMENT Environment
# Generated on $(date)

# Tenant Configuration
AZURE_AD_B2C_TENANT_NAME=$TENANT_NAME.onmicrosoft.com
AZURE_AD_B2C_TENANT_ID=your-tenant-id-here

# Application Configuration
AZURE_AD_B2C_CLIENT_ID=your-client-id-here
AZURE_AD_B2C_CLIENT_SECRET=your-client-secret-here

# Policy Configuration
AZURE_AD_B2C_SIGNUP_SIGNIN_POLICY=B2C_1_signupsignin
AZURE_AD_B2C_EDIT_PROFILE_POLICY=B2C_1_profileediting
AZURE_AD_B2C_RESET_PASSWORD_POLICY=B2C_1_passwordreset

# URL Configuration
AZURE_AD_B2C_AUTHORITY=https://$TENANT_NAME.b2clogin.com/$TENANT_NAME.onmicrosoft.com/B2C_1_signupsignin
AZURE_AD_B2C_KNOWN_AUTHORITY=$TENANT_NAME.b2clogin.com

# Frontend Configuration
REACT_APP_AZURE_AD_B2C_CLIENT_ID=your-client-id-here
REACT_APP_AZURE_AD_B2C_AUTHORITY=https://$TENANT_NAME.b2clogin.com/$TENANT_NAME.onmicrosoft.com/B2C_1_signupsignin
REACT_APP_AZURE_AD_B2C_KNOWN_AUTHORITY=$TENANT_NAME.b2clogin.com
REACT_APP_AZURE_AD_B2C_TENANT_NAME=$TENANT_NAME.onmicrosoft.com
REACT_APP_AZURE_AD_B2C_SCOPE=openid profile
REACT_APP_AZURE_AD_B2C_SIGNUP_SIGNIN_POLICY=B2C_1_signupsignin
REACT_APP_AZURE_AD_B2C_EDIT_PROFILE_POLICY=B2C_1_profileediting
REACT_APP_AZURE_AD_B2C_RESET_PASSWORD_POLICY=B2C_1_passwordreset

# Redirect URLs
REACT_APP_REDIRECT_URI=$FRONTEND_URL/auth/callback
REACT_APP_POST_LOGOUT_REDIRECT_URI=$FRONTEND_URL

# API Configuration
REACT_APP_API_BASE_URL=$BACKEND_URL

# CORS Configuration for Backend
ALLOWED_ORIGINS=$FRONTEND_URL

# Key Vault Configuration
KEY_VAULT_URL=https://$KEY_VAULT_NAME.vault.azure.net/
EOF

    print_success "Environment variables generated: $env_file"
    
    # Generate frontend-specific env file
    local frontend_env_file="frontend-env-${ENVIRONMENT}.env"
    
    cat > "$frontend_env_file" << EOF
# Frontend Environment Variables for $ENVIRONMENT
# Place this content in frontend/.env.$ENVIRONMENT

REACT_APP_AZURE_AD_B2C_CLIENT_ID=your-client-id-here
REACT_APP_AZURE_AD_B2C_AUTHORITY=https://$TENANT_NAME.b2clogin.com/$TENANT_NAME.onmicrosoft.com/B2C_1_signupsignin
REACT_APP_AZURE_AD_B2C_KNOWN_AUTHORITY=$TENANT_NAME.b2clogin.com
REACT_APP_AZURE_AD_B2C_TENANT_NAME=$TENANT_NAME.onmicrosoft.com
REACT_APP_AZURE_AD_B2C_SCOPE=openid profile
REACT_APP_AZURE_AD_B2C_SIGNUP_SIGNIN_POLICY=B2C_1_signupsignin
REACT_APP_AZURE_AD_B2C_EDIT_PROFILE_POLICY=B2C_1_profileediting
REACT_APP_AZURE_AD_B2C_RESET_PASSWORD_POLICY=B2C_1_passwordreset
REACT_APP_REDIRECT_URI=$FRONTEND_URL/auth/callback
REACT_APP_POST_LOGOUT_REDIRECT_URI=$FRONTEND_URL
REACT_APP_API_BASE_URL=$BACKEND_URL
EOF

    print_success "Frontend environment variables generated: $frontend_env_file"
    
    print_status "Next steps:"
    echo "1. Update the placeholder values with actual B2C configuration"
    echo "2. Copy $frontend_env_file to frontend/.env.$ENVIRONMENT"
    echo "3. Update backend environment variables or Key Vault secrets"
    echo "4. Run validation: $0 validate $ENVIRONMENT"
}

# Function to update Key Vault secrets
update_secrets() {
    print_status "Updating Key Vault secrets for $ENVIRONMENT environment"
    
    if ! command -v az &> /dev/null; then
        print_error "Azure CLI is not installed"
        exit 1
    fi
    
    if ! az account show &> /dev/null; then
        print_error "Not logged in to Azure CLI"
        exit 1
    fi
    
    # Check if Key Vault exists
    if ! az keyvault show --name "$KEY_VAULT_NAME" &> /dev/null; then
        print_error "Key Vault '$KEY_VAULT_NAME' not found"
        exit 1
    fi
    
    print_status "Updating B2C-related secrets in Key Vault: $KEY_VAULT_NAME"
    
    # Update tenant name
    if az keyvault secret set \
        --vault-name "$KEY_VAULT_NAME" \
        --name "Azure-AD-B2C-Tenant-Name" \
        --value "$TENANT_NAME.onmicrosoft.com" \
        --output none; then
        print_success "Updated Azure-AD-B2C-Tenant-Name"
    else
        print_error "Failed to update Azure-AD-B2C-Tenant-Name"
    fi
    
    # Update authority URL
    local authority_url="https://$TENANT_NAME.b2clogin.com/$TENANT_NAME.onmicrosoft.com/B2C_1_signupsignin"
    if az keyvault secret set \
        --vault-name "$KEY_VAULT_NAME" \
        --name "Azure-AD-B2C-Authority" \
        --value "$authority_url" \
        --output none; then
        print_success "Updated Azure-AD-B2C-Authority"
    else
        print_error "Failed to update Azure-AD-B2C-Authority"
    fi
    
    # Update redirect URI
    local redirect_uri="$FRONTEND_URL/auth/callback"
    if az keyvault secret set \
        --vault-name "$KEY_VAULT_NAME" \
        --name "Azure-AD-B2C-Redirect-URI" \
        --value "$redirect_uri" \
        --output none; then
        print_success "Updated Azure-AD-B2C-Redirect-URI"
    else
        print_error "Failed to update Azure-AD-B2C-Redirect-URI"
    fi
    
    # Update logout redirect URI
    if az keyvault secret set \
        --vault-name "$KEY_VAULT_NAME" \
        --name "Azure-AD-B2C-Logout-URI" \
        --value "$FRONTEND_URL" \
        --output none; then
        print_success "Updated Azure-AD-B2C-Logout-URI"
    else
        print_error "Failed to update Azure-AD-B2C-Logout-URI"
    fi
    
    print_warning "Note: You still need to manually update:"
    echo "  - Azure-AD-B2C-Client-ID (from Azure portal)"
    echo "  - Azure-AD-B2C-Client-Secret (from Azure portal)"
    echo ""
    echo "Use these commands:"
    echo "  az keyvault secret set --vault-name $KEY_VAULT_NAME --name 'Azure-AD-B2C-Client-ID' --value 'your-client-id'"
    echo "  az keyvault secret set --vault-name $KEY_VAULT_NAME --name 'Azure-AD-B2C-Client-Secret' --value 'your-client-secret'"
}

# Function to validate configuration
validate_config() {
    print_status "Validating B2C configuration for $ENVIRONMENT environment"
    
    local validation_passed=0
    local validation_failed=0
    
    # Test 1: Check Key Vault access
    if command -v az &> /dev/null && az account show &> /dev/null; then
        if az keyvault show --name "$KEY_VAULT_NAME" &> /dev/null; then
            print_success "Key Vault accessible: $KEY_VAULT_NAME"
            ((validation_passed++))
        else
            print_error "Key Vault not accessible: $KEY_VAULT_NAME"
            ((validation_failed++))
        fi
    else
        print_warning "Cannot validate Key Vault (Azure CLI not available or not logged in)"
    fi
    
    # Test 2: Check required secrets in Key Vault
    if command -v az &> /dev/null && az account show &> /dev/null; then
        local required_secrets=(
            "Azure-AD-B2C-Client-ID"
            "Azure-AD-B2C-Client-Secret"
            "Azure-AD-B2C-Tenant-Name"
        )
        
        for secret in "${required_secrets[@]}"; do
            if az keyvault secret show --vault-name "$KEY_VAULT_NAME" --name "$secret" --output none 2>/dev/null; then
                print_success "Secret exists: $secret"
                ((validation_passed++))
            else
                print_error "Secret missing: $secret"
                ((validation_failed++))
            fi
        done
    fi
    
    # Test 3: Check URL accessibility
    if command -v curl &> /dev/null; then
        if curl -s -I "$FRONTEND_URL" | grep -q "200\|301\|302"; then
            print_success "Frontend URL accessible: $FRONTEND_URL"
            ((validation_passed++))
        else
            print_warning "Frontend URL not accessible: $FRONTEND_URL (may not be deployed yet)"
        fi
        
        if curl -s -I "$BACKEND_URL" | grep -q "200\|404"; then # 404 is OK for API root
            print_success "Backend URL accessible: $BACKEND_URL"
            ((validation_passed++))
        else
            print_warning "Backend URL not accessible: $BACKEND_URL (may not be deployed yet)"
        fi
    fi
    
    # Test 4: Check B2C discovery endpoint
    if command -v curl &> /dev/null; then
        local discovery_url="https://$TENANT_NAME.b2clogin.com/$TENANT_NAME.onmicrosoft.com/B2C_1_signupsignin/v2.0/.well-known/openid_configuration"
        if curl -s -f "$discovery_url" > /dev/null; then
            print_success "B2C discovery endpoint accessible"
            ((validation_passed++))
        else
            print_warning "B2C discovery endpoint not accessible (check tenant name and policy)"
            ((validation_failed++))
        fi
    fi
    
    # Summary
    echo ""
    print_status "Validation Summary:"
    print_success "Checks passed: $validation_passed"
    if [ $validation_failed -gt 0 ]; then
        print_error "Checks failed: $validation_failed"
        return 1
    else
        print_success "Checks failed: $validation_failed"
        return 0
    fi
}

# Function to export configuration
export_config() {
    local export_file=${OPTION:-"b2c-config-${ENVIRONMENT}.json"}
    
    print_status "Exporting B2C configuration to: $export_file"
    
    cat > "$export_file" << EOF
{
  "environment": "$ENVIRONMENT",
  "tenantName": "$TENANT_NAME",
  "tenantDomain": "$TENANT_NAME.onmicrosoft.com",
  "frontendUrl": "$FRONTEND_URL",
  "backendUrl": "$BACKEND_URL",
  "keyVaultName": "$KEY_VAULT_NAME",
  "policies": {
    "signUpSignIn": "B2C_1_signupsignin",
    "editProfile": "B2C_1_profileediting",
    "resetPassword": "B2C_1_passwordreset"
  },
  "urls": {
    "authority": "https://$TENANT_NAME.b2clogin.com/$TENANT_NAME.onmicrosoft.com/B2C_1_signupsignin",
    "knownAuthority": "$TENANT_NAME.b2clogin.com",
    "redirectUri": "$FRONTEND_URL/auth/callback",
    "postLogoutRedirectUri": "$FRONTEND_URL"
  },
  "scopes": [
    "openid",
    "profile"
  ],
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
    
    print_success "Configuration exported to: $export_file"
}

# Function to import configuration
import_config() {
    local import_file=${OPTION:-""}
    
    if [ -z "$import_file" ] || [ ! -f "$import_file" ]; then
        print_error "Import file required and must exist"
        echo "Usage: $0 import $ENVIRONMENT <config-file>"
        exit 1
    fi
    
    print_status "Importing B2C configuration from: $import_file"
    
    if ! command -v jq &> /dev/null; then
        print_error "jq is required for import functionality"
        exit 1
    fi
    
    # Read and validate JSON
    if ! jq . "$import_file" > /dev/null 2>&1; then
        print_error "Invalid JSON in import file"
        exit 1
    fi
    
    # Extract values
    local imported_tenant=$(jq -r '.tenantName' "$import_file")
    local imported_frontend=$(jq -r '.frontendUrl' "$import_file")
    local imported_backend=$(jq -r '.backendUrl' "$import_file")
    
    print_status "Imported configuration:"
    echo "  Tenant: $imported_tenant"
    echo "  Frontend: $imported_frontend"
    echo "  Backend: $imported_backend"
    
    # Generate updated environment file
    TENANT_NAME="$imported_tenant"
    FRONTEND_URL="$imported_frontend"
    BACKEND_URL="$imported_backend"
    
    generate_env
    
    print_success "Configuration imported and environment files generated"
}

# Execute command
case "$COMMAND" in
    "generate-env")
        generate_env
        ;;
    "update-secrets")
        update_secrets
        ;;
    "validate")
        validate_config
        ;;
    "export")
        export_config
        ;;
    "import")
        import_config
        ;;
    *)
        print_error "Unknown command: $COMMAND"
        show_usage
        exit 1
        ;;
esac
