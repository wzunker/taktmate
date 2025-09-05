#!/bin/bash

# Configure environment variables for Azure Static Web App deployment
# Usage: ./configure-environment.sh [environment]
# Example: ./configure-environment.sh production

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

# Default values
ENVIRONMENT=${1:-"staging"}

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(production|staging|development)$ ]]; then
    print_error "Invalid environment. Must be one of: production, staging, development"
    exit 1
fi

print_status "Configuring environment variables for: $ENVIRONMENT"

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$(dirname "$SCRIPT_DIR")/frontend"

# Environment-specific configurations
case $ENVIRONMENT in
    "production")
        DOMAIN="app.taktmate.com"
        API_URL="https://taktmate-api-prod.azurewebsites.net"
        B2C_TENANT="taktmate"
        ;;
    "staging")
        DOMAIN="staging.taktmate.com"
        API_URL="https://taktmate-api-staging.azurewebsites.net"
        B2C_TENANT="taktmate-staging"
        ;;
    "development")
        DOMAIN="localhost:3000"
        API_URL="http://localhost:3001"
        B2C_TENANT="taktmate-dev"
        ;;
esac

# Create environment file
ENV_FILE="$FRONTEND_DIR/.env.$ENVIRONMENT"

print_status "Creating environment file: $ENV_FILE"

cat > "$ENV_FILE" << EOF
# TaktMate Frontend Environment Configuration
# Environment: $ENVIRONMENT
# Generated: $(date)

# Azure AD B2C Configuration
REACT_APP_AZURE_AD_B2C_CLIENT_ID=your-client-id-here
REACT_APP_AZURE_AD_B2C_AUTHORITY=https://$B2C_TENANT.b2clogin.com/$B2C_TENANT.onmicrosoft.com/B2C_1_signupsignin
REACT_APP_AZURE_AD_B2C_KNOWN_AUTHORITY=$B2C_TENANT.b2clogin.com
REACT_APP_AZURE_AD_B2C_TENANT_NAME=$B2C_TENANT.onmicrosoft.com
REACT_APP_AZURE_AD_B2C_SCOPE=https://$B2C_TENANT.onmicrosoft.com/taktmate-api/access_as_user

# Azure AD B2C Policies
REACT_APP_AZURE_AD_B2C_SIGNUP_SIGNIN_POLICY=B2C_1_signupsignin
REACT_APP_AZURE_AD_B2C_EDIT_PROFILE_POLICY=B2C_1_profileediting
REACT_APP_AZURE_AD_B2C_RESET_PASSWORD_POLICY=B2C_1_passwordreset

# API Configuration
REACT_APP_API_BASE_URL=$API_URL

# Redirect URIs
REACT_APP_REDIRECT_URI=https://$DOMAIN
REACT_APP_POST_LOGOUT_REDIRECT_URI=https://$DOMAIN

# Build Configuration
GENERATE_SOURCEMAP=false
REACT_APP_ENVIRONMENT=$ENVIRONMENT
EOF

print_success "Environment file created: $ENV_FILE"

# Create GitHub secrets template
SECRETS_FILE="$SCRIPT_DIR/github-secrets-$ENVIRONMENT.txt"

print_status "Creating GitHub secrets template: $SECRETS_FILE"

cat > "$SECRETS_FILE" << EOF
# GitHub Repository Secrets for $ENVIRONMENT Environment
# Add these secrets to your GitHub repository settings

# Azure Static Web Apps
AZURE_STATIC_WEB_APPS_API_TOKEN=<deployment-token-from-azure>

# Azure AD B2C Configuration
REACT_APP_AZURE_AD_B2C_CLIENT_ID=<your-client-id>
REACT_APP_AZURE_AD_B2C_AUTHORITY=https://$B2C_TENANT.b2clogin.com/$B2C_TENANT.onmicrosoft.com/B2C_1_signupsignin
REACT_APP_AZURE_AD_B2C_KNOWN_AUTHORITY=$B2C_TENANT.b2clogin.com
REACT_APP_AZURE_AD_B2C_TENANT_NAME=$B2C_TENANT.onmicrosoft.com
REACT_APP_AZURE_AD_B2C_SCOPE=https://$B2C_TENANT.onmicrosoft.com/taktmate-api/access_as_user
REACT_APP_AZURE_AD_B2C_SIGNUP_SIGNIN_POLICY=B2C_1_signupsignin
REACT_APP_AZURE_AD_B2C_EDIT_PROFILE_POLICY=B2C_1_profileediting
REACT_APP_AZURE_AD_B2C_RESET_PASSWORD_POLICY=B2C_1_passwordreset

# API Configuration
REACT_APP_API_BASE_URL=$API_URL

# Redirect URIs
REACT_APP_REDIRECT_URI=https://$DOMAIN
REACT_APP_POST_LOGOUT_REDIRECT_URI=https://$DOMAIN
EOF

print_success "GitHub secrets template created: $SECRETS_FILE"

# Create Azure CLI commands for setting environment variables
AZURE_COMMANDS_FILE="$SCRIPT_DIR/azure-env-commands-$ENVIRONMENT.sh"

print_status "Creating Azure CLI commands file: $AZURE_COMMANDS_FILE"

cat > "$AZURE_COMMANDS_FILE" << 'EOF'
#!/bin/bash

# Azure CLI commands to set environment variables for Static Web App
# Usage: ./azure-env-commands-[environment].sh [static-web-app-name]

STATIC_WEB_APP_NAME=${1:-"taktmate-frontend-prod"}

echo "Setting environment variables for Static Web App: $STATIC_WEB_APP_NAME"

# Note: Azure Static Web Apps environment variables are configured through the Azure portal
# or using the Azure REST API. Azure CLI doesn't have direct commands for this yet.

echo "Please configure these environment variables in the Azure portal:"
echo "1. Go to Azure Portal > Static Web Apps > $STATIC_WEB_APP_NAME"
echo "2. Navigate to Configuration > Environment variables"
echo "3. Add the following variables:"

echo ""
echo "REACT_APP_AZURE_AD_B2C_CLIENT_ID=your-client-id"
echo "REACT_APP_AZURE_AD_B2C_AUTHORITY=https://your-tenant.b2clogin.com/..."
echo "REACT_APP_AZURE_AD_B2C_KNOWN_AUTHORITY=your-tenant.b2clogin.com"
echo "REACT_APP_AZURE_AD_B2C_TENANT_NAME=your-tenant.onmicrosoft.com"
echo "REACT_APP_AZURE_AD_B2C_SCOPE=https://your-tenant.onmicrosoft.com/..."
echo "REACT_APP_AZURE_AD_B2C_SIGNUP_SIGNIN_POLICY=B2C_1_signupsignin"
echo "REACT_APP_AZURE_AD_B2C_EDIT_PROFILE_POLICY=B2C_1_profileediting"
echo "REACT_APP_AZURE_AD_B2C_RESET_PASSWORD_POLICY=B2C_1_passwordreset"
echo "REACT_APP_API_BASE_URL=https://your-api.azurewebsites.net"
echo "REACT_APP_REDIRECT_URI=https://your-domain.com"
echo "REACT_APP_POST_LOGOUT_REDIRECT_URI=https://your-domain.com"
EOF

chmod +x "$AZURE_COMMANDS_FILE"

print_success "Azure CLI commands file created: $AZURE_COMMANDS_FILE"

# Display summary
echo ""
print_success "Environment configuration completed for: $ENVIRONMENT"
echo ""
print_status "Files created:"
echo "  1. Frontend environment file: $ENV_FILE"
echo "  2. GitHub secrets template: $SECRETS_FILE"
echo "  3. Azure CLI commands: $AZURE_COMMANDS_FILE"
echo ""
print_status "Next steps:"
echo "  1. Review and update the environment file with actual values"
echo "  2. Add secrets to your GitHub repository using the template"
echo "  3. Configure environment variables in Azure portal"
echo "  4. Update Azure AD B2C redirect URLs"
echo ""
print_warning "Remember to:"
echo "  - Never commit .env files to git"
echo "  - Keep your secrets secure"
echo "  - Use different Azure AD B2C tenants for different environments"
