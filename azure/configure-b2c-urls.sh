#!/bin/bash

# Configure Azure AD B2C Redirect URLs for TaktMate
# Usage: ./configure-b2c-urls.sh [environment] [tenant-name] [app-id] [frontend-url] [backend-url]
# Example: ./configure-b2c-urls.sh production taktmate b2c-app-id https://app.taktmate.com https://api.taktmate.com

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
    echo "Usage: $0 [environment] [tenant-name] [app-id] [frontend-url] [backend-url]"
    echo ""
    echo "Parameters:"
    echo "  environment   - Environment (production, staging, development)"
    echo "  tenant-name   - Azure AD B2C tenant name (without .onmicrosoft.com)"
    echo "  app-id        - Application (client) ID"
    echo "  frontend-url  - Frontend application URL"
    echo "  backend-url   - Backend API URL"
    echo ""
    echo "Examples:"
    echo "  $0 production taktmate 12345678-1234-1234-1234-123456789012 https://app.taktmate.com https://api.taktmate.com"
    echo "  $0 staging taktmate-staging 87654321-4321-4321-4321-210987654321 https://staging.taktmate.com https://api-staging.taktmate.com"
    echo "  $0 development taktmate-dev 11111111-2222-3333-4444-555555555555 http://localhost:3000 http://localhost:3001"
}

# Parse arguments
ENVIRONMENT=${1:-""}
TENANT_NAME=${2:-""}
APP_ID=${3:-""}
FRONTEND_URL=${4:-""}
BACKEND_URL=${5:-""}

# Validate arguments
if [ -z "$ENVIRONMENT" ] || [ -z "$TENANT_NAME" ] || [ -z "$APP_ID" ] || [ -z "$FRONTEND_URL" ] || [ -z "$BACKEND_URL" ]; then
    print_error "All parameters are required"
    show_usage
    exit 1
fi

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(production|staging|development)$ ]]; then
    print_error "Invalid environment. Must be one of: production, staging, development"
    exit 1
fi

# Validate URLs
if [[ "$ENVIRONMENT" != "development" ]]; then
    if [[ ! "$FRONTEND_URL" =~ ^https:// ]] || [[ ! "$BACKEND_URL" =~ ^https:// ]]; then
        print_error "Production and staging environments must use HTTPS URLs"
        exit 1
    fi
fi

print_status "Configuring Azure AD B2C redirect URLs for $ENVIRONMENT environment"
print_status "Tenant: $TENANT_NAME.onmicrosoft.com"
print_status "App ID: $APP_ID"
print_status "Frontend URL: $FRONTEND_URL"
print_status "Backend URL: $BACKEND_URL"

# Check prerequisites
if ! command -v az &> /dev/null; then
    print_error "Azure CLI is not installed. Please install it first."
    exit 1
fi

if ! az account show &> /dev/null; then
    print_error "Not logged in to Azure CLI. Please run 'az login' first."
    exit 1
fi

# Check if we can access the B2C tenant
print_status "Checking B2C tenant access..."
if ! az ad app show --id "$APP_ID" &> /dev/null; then
    print_error "Cannot access application $APP_ID. Please check:"
    echo "  1. Application ID is correct"
    echo "  2. You have permissions to manage the application"
    echo "  3. You're connected to the correct tenant"
    exit 1
fi

# Define redirect URLs based on environment
declare -a REDIRECT_URLS
declare -a LOGOUT_URLS
declare -a WEB_ORIGINS

case "$ENVIRONMENT" in
    "production")
        REDIRECT_URLS=(
            "$FRONTEND_URL"
            "$FRONTEND_URL/"
            "$FRONTEND_URL/auth/callback"
            "$FRONTEND_URL/auth/redirect"
        )
        LOGOUT_URLS=(
            "$FRONTEND_URL"
            "$FRONTEND_URL/"
            "$FRONTEND_URL/auth/logout"
        )
        WEB_ORIGINS=(
            "$FRONTEND_URL"
            "$BACKEND_URL"
        )
        ;;
    "staging")
        REDIRECT_URLS=(
            "$FRONTEND_URL"
            "$FRONTEND_URL/"
            "$FRONTEND_URL/auth/callback"
            "$FRONTEND_URL/auth/redirect"
            "https://staging.taktmate.com"
            "https://staging.taktmate.com/"
            "https://staging.taktmate.com/auth/callback"
        )
        LOGOUT_URLS=(
            "$FRONTEND_URL"
            "$FRONTEND_URL/"
            "$FRONTEND_URL/auth/logout"
            "https://staging.taktmate.com"
            "https://staging.taktmate.com/"
        )
        WEB_ORIGINS=(
            "$FRONTEND_URL"
            "$BACKEND_URL"
            "https://staging.taktmate.com"
            "https://api-staging.taktmate.com"
        )
        ;;
    "development")
        REDIRECT_URLS=(
            "http://localhost:3000"
            "http://localhost:3000/"
            "http://localhost:3000/auth/callback"
            "http://localhost:3000/auth/redirect"
            "http://127.0.0.1:3000"
            "http://127.0.0.1:3000/"
            "http://127.0.0.1:3000/auth/callback"
            "$FRONTEND_URL"
            "$FRONTEND_URL/"
            "$FRONTEND_URL/auth/callback"
        )
        LOGOUT_URLS=(
            "http://localhost:3000"
            "http://localhost:3000/"
            "http://localhost:3000/auth/logout"
            "http://127.0.0.1:3000"
            "http://127.0.0.1:3000/"
            "$FRONTEND_URL"
            "$FRONTEND_URL/"
        )
        WEB_ORIGINS=(
            "http://localhost:3000"
            "http://localhost:3001"
            "http://127.0.0.1:3000"
            "http://127.0.0.1:3001"
            "$FRONTEND_URL"
            "$BACKEND_URL"
        )
        ;;
esac

# Get current application configuration
print_status "Getting current application configuration..."
CURRENT_CONFIG=$(az ad app show --id "$APP_ID" --output json)

if [ $? -ne 0 ]; then
    print_error "Failed to get current application configuration"
    exit 1
fi

# Extract current redirect URIs
CURRENT_REDIRECT_URIS=$(echo "$CURRENT_CONFIG" | jq -r '.web.redirectUris[]?' 2>/dev/null | sort | uniq)
CURRENT_LOGOUT_URIS=$(echo "$CURRENT_CONFIG" | jq -r '.web.logoutUrl?' 2>/dev/null)

print_status "Current redirect URIs:"
if [ ! -z "$CURRENT_REDIRECT_URIS" ]; then
    echo "$CURRENT_REDIRECT_URIS" | while read -r uri; do
        echo "  - $uri"
    done
else
    echo "  - None configured"
fi

# Prepare new redirect URIs (combine current + new, remove duplicates)
ALL_REDIRECT_URIS=()
if [ ! -z "$CURRENT_REDIRECT_URIS" ]; then
    while IFS= read -r uri; do
        if [ ! -z "$uri" ]; then
            ALL_REDIRECT_URIS+=("$uri")
        fi
    done <<< "$CURRENT_REDIRECT_URIS"
fi

# Add new URIs
for uri in "${REDIRECT_URLS[@]}"; do
    ALL_REDIRECT_URIS+=("$uri")
done

# Remove duplicates and sort
IFS=$'\n' UNIQUE_REDIRECT_URIS=($(printf '%s\n' "${ALL_REDIRECT_URIS[@]}" | sort -u))

# Prepare JSON for redirect URIs
REDIRECT_URIS_JSON=$(printf '%s\n' "${UNIQUE_REDIRECT_URIS[@]}" | jq -R . | jq -s .)

# Prepare JSON for logout URL (use the first logout URL)
LOGOUT_URL_JSON=$(echo "${LOGOUT_URLS[0]}" | jq -R .)

# Prepare JSON for web origins
WEB_ORIGINS_JSON=$(printf '%s\n' "${WEB_ORIGINS[@]}" | jq -R . | jq -s .)

print_status "New redirect URIs to be configured:"
printf '%s\n' "${UNIQUE_REDIRECT_URIS[@]}" | while read -r uri; do
    echo "  - $uri"
done

print_status "Logout URL to be configured: ${LOGOUT_URLS[0]}"

# Create the web configuration JSON
WEB_CONFIG=$(jq -n \
    --argjson redirectUris "$REDIRECT_URIS_JSON" \
    --argjson logoutUrl "$LOGOUT_URL_JSON" \
    --argjson origins "$WEB_ORIGINS_JSON" \
    '{
        redirectUris: $redirectUris,
        logoutUrl: $logoutUrl,
        implicitGrantSettings: {
            enableIdTokenIssuance: true,
            enableAccessTokenIssuance: false
        }
    }')

# Update the application
print_status "Updating Azure AD B2C application configuration..."

if az ad app update --id "$APP_ID" --web "$WEB_CONFIG" --output none; then
    print_success "Application redirect URLs updated successfully!"
else
    print_error "Failed to update application configuration"
    exit 1
fi

# Verify the update
print_status "Verifying configuration update..."
UPDATED_CONFIG=$(az ad app show --id "$APP_ID" --output json)
UPDATED_REDIRECT_URIS=$(echo "$UPDATED_CONFIG" | jq -r '.web.redirectUris[]?' 2>/dev/null | sort)
UPDATED_LOGOUT_URL=$(echo "$UPDATED_CONFIG" | jq -r '.web.logoutUrl?' 2>/dev/null)

print_success "Verification complete!"
print_status "Updated redirect URIs:"
echo "$UPDATED_REDIRECT_URIS" | while read -r uri; do
    echo "  - $uri"
done

print_status "Updated logout URL: $UPDATED_LOGOUT_URL"

# Check for CORS configuration
print_status "Checking CORS configuration recommendations..."

case "$ENVIRONMENT" in
    "production")
        print_status "For production, configure CORS in your backend to allow:"
        echo "  - $FRONTEND_URL"
        ;;
    "staging")
        print_status "For staging, configure CORS in your backend to allow:"
        echo "  - $FRONTEND_URL"
        echo "  - https://staging.taktmate.com"
        ;;
    "development")
        print_status "For development, configure CORS in your backend to allow:"
        echo "  - http://localhost:3000"
        echo "  - http://127.0.0.1:3000"
        echo "  - $FRONTEND_URL"
        ;;
esac

# Save configuration for reference
CONFIG_FILE="b2c-config-${ENVIRONMENT}-$(date +%Y%m%d-%H%M%S).json"
cat > "$CONFIG_FILE" << EOF
{
  "environment": "$ENVIRONMENT",
  "tenantName": "$TENANT_NAME",
  "appId": "$APP_ID",
  "frontendUrl": "$FRONTEND_URL",
  "backendUrl": "$BACKEND_URL",
  "redirectUris": $(echo "$UPDATED_REDIRECT_URIS" | jq -R . | jq -s .),
  "logoutUrl": "$UPDATED_LOGOUT_URL",
  "webOrigins": $WEB_ORIGINS_JSON,
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

print_success "Configuration saved to: $CONFIG_FILE"

# Next steps
print_status "Next Steps:"
echo "1. Update your frontend environment variables:"
echo "   REACT_APP_REDIRECT_URI=$FRONTEND_URL/auth/callback"
echo "   REACT_APP_POST_LOGOUT_REDIRECT_URI=$FRONTEND_URL"
echo ""
echo "2. Update your backend CORS configuration to allow:"
printf '%s\n' "${WEB_ORIGINS[@]}" | while read -r origin; do
    echo "   - $origin"
done
echo ""
echo "3. Test the authentication flow:"
echo "   - Navigate to $FRONTEND_URL"
echo "   - Click 'Sign In' and verify redirect works"
echo "   - Complete authentication and verify callback works"
echo "   - Test sign out and verify logout redirect works"
echo ""
echo "4. Update Key Vault secrets if needed:"
echo "   az keyvault secret set --vault-name taktmate-kv-$ENVIRONMENT --name 'Azure-AD-B2C-Redirect-URI' --value '$FRONTEND_URL/auth/callback'"
echo ""

# Environment-specific recommendations
case "$ENVIRONMENT" in
    "production")
        echo "5. Production-specific recommendations:"
        echo "   - Verify SSL certificates are valid"
        echo "   - Test from different browsers and devices"
        echo "   - Monitor authentication logs in Azure AD B2C"
        echo "   - Set up alerts for authentication failures"
        ;;
    "staging")
        echo "5. Staging-specific recommendations:"
        echo "   - Test with production-like data"
        echo "   - Verify staging environment isolation"
        echo "   - Test user flows and custom policies"
        ;;
    "development")
        echo "5. Development-specific recommendations:"
        echo "   - Test with localhost and 127.0.0.1"
        echo "   - Verify hot reload doesn't break auth"
        echo "   - Test with different ports if needed"
        ;;
esac

print_success "Azure AD B2C redirect URL configuration completed for $ENVIRONMENT environment!"
