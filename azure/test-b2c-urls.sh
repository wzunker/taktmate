#!/bin/bash

# Test Azure AD B2C Redirect URL Configuration
# Usage: ./test-b2c-urls.sh [environment] [tenant-name] [app-id] [frontend-url]
# Example: ./test-b2c-urls.sh production taktmate 12345678-1234-1234-1234-123456789012 https://app.taktmate.com

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
TENANT_NAME=${2:-""}
APP_ID=${3:-""}
FRONTEND_URL=${4:-""}

# Function to show usage
show_usage() {
    echo "Usage: $0 [environment] [tenant-name] [app-id] [frontend-url]"
    echo ""
    echo "Parameters:"
    echo "  environment   - Environment (production, staging, development)"
    echo "  tenant-name   - Azure AD B2C tenant name (without .onmicrosoft.com)"
    echo "  app-id        - Application (client) ID"
    echo "  frontend-url  - Frontend application URL"
    echo ""
    echo "Examples:"
    echo "  $0 production taktmate 12345678-1234-1234-1234-123456789012 https://app.taktmate.com"
    echo "  $0 staging taktmate-staging 87654321-4321-4321-4321-210987654321 https://staging.taktmate.com"
    echo "  $0 development taktmate-dev 11111111-2222-3333-4444-555555555555 http://localhost:3000"
}

# Validate arguments
if [ -z "$TENANT_NAME" ] || [ -z "$APP_ID" ] || [ -z "$FRONTEND_URL" ]; then
    print_error "Missing required parameters"
    show_usage
    exit 1
fi

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(production|staging|development)$ ]]; then
    print_error "Invalid environment. Must be one of: production, staging, development"
    exit 1
fi

print_status "Testing Azure AD B2C configuration for $ENVIRONMENT environment"
print_status "Tenant: $TENANT_NAME.onmicrosoft.com"
print_status "App ID: $APP_ID"
print_status "Frontend URL: $FRONTEND_URL"

# Test results
TESTS_PASSED=0
TESTS_FAILED=0
FAILED_TESTS=()

# Function to run test
run_test() {
    local test_name="$1"
    local test_command="$2"
    local expected_result="$3"
    
    print_status "Running test: $test_name"
    
    if eval "$test_command"; then
        if [ ! -z "$expected_result" ]; then
            print_success "$test_name - $expected_result"
        else
            print_success "$test_name - PASSED"
        fi
        ((TESTS_PASSED++))
    else
        print_error "$test_name - FAILED"
        FAILED_TESTS+=("$test_name")
        ((TESTS_FAILED++))
    fi
    echo ""
}

# Check prerequisites
print_status "Checking prerequisites..."

if ! command -v az &> /dev/null; then
    print_error "Azure CLI is not installed"
    exit 1
fi

if ! command -v jq &> /dev/null; then
    print_error "jq is not installed"
    exit 1
fi

if ! az account show &> /dev/null; then
    print_error "Not logged in to Azure CLI"
    exit 1
fi

# Test 1: Application exists
run_test "Application Existence" \
    "az ad app show --id '$APP_ID' --output none 2>/dev/null" \
    "Application exists and is accessible"

# Test 2: Get application configuration
print_status "Getting application configuration..."
APP_CONFIG=$(az ad app show --id "$APP_ID" --output json 2>/dev/null)
if [ $? -eq 0 ]; then
    print_success "Successfully retrieved application configuration"
    ((TESTS_PASSED++))
else
    print_error "Failed to retrieve application configuration"
    FAILED_TESTS+=("Application Configuration")
    ((TESTS_FAILED++))
    APP_CONFIG="{}"
fi

# Test 3: Check redirect URIs
print_status "Checking redirect URIs..."
REDIRECT_URIS=$(echo "$APP_CONFIG" | jq -r '.web.redirectUris[]?' 2>/dev/null | sort)

if [ ! -z "$REDIRECT_URIS" ]; then
    print_success "Redirect URIs are configured:"
    echo "$REDIRECT_URIS" | while read -r uri; do
        echo "  - $uri"
    done
    ((TESTS_PASSED++))
else
    print_error "No redirect URIs configured"
    FAILED_TESTS+=("Redirect URIs")
    ((TESTS_FAILED++))
fi

# Test 4: Check for required redirect URIs
print_status "Checking for required redirect URIs..."
REQUIRED_URIS=()

case "$ENVIRONMENT" in
    "production")
        REQUIRED_URIS=(
            "$FRONTEND_URL"
            "$FRONTEND_URL/auth/callback"
        )
        ;;
    "staging")
        REQUIRED_URIS=(
            "$FRONTEND_URL"
            "$FRONTEND_URL/auth/callback"
        )
        ;;
    "development")
        REQUIRED_URIS=(
            "http://localhost:3000"
            "http://localhost:3000/auth/callback"
        )
        ;;
esac

MISSING_URIS=()
for required_uri in "${REQUIRED_URIS[@]}"; do
    if echo "$REDIRECT_URIS" | grep -q "^$required_uri$"; then
        print_success "Required URI found: $required_uri"
        ((TESTS_PASSED++))
    else
        print_warning "Required URI missing: $required_uri"
        MISSING_URIS+=("$required_uri")
        FAILED_TESTS+=("Required URI: $required_uri")
        ((TESTS_FAILED++))
    fi
done

# Test 5: Check logout URL
print_status "Checking logout URL..."
LOGOUT_URL=$(echo "$APP_CONFIG" | jq -r '.web.logoutUrl?' 2>/dev/null)

if [ ! -z "$LOGOUT_URL" ] && [ "$LOGOUT_URL" != "null" ]; then
    print_success "Logout URL configured: $LOGOUT_URL"
    ((TESTS_PASSED++))
else
    print_warning "No logout URL configured"
    FAILED_TESTS+=("Logout URL")
    ((TESTS_FAILED++))
fi

# Test 6: Check implicit grant settings
print_status "Checking implicit grant settings..."
ID_TOKEN_ENABLED=$(echo "$APP_CONFIG" | jq -r '.web.implicitGrantSettings.enableIdTokenIssuance?' 2>/dev/null)
ACCESS_TOKEN_ENABLED=$(echo "$APP_CONFIG" | jq -r '.web.implicitGrantSettings.enableAccessTokenIssuance?' 2>/dev/null)

if [ "$ID_TOKEN_ENABLED" = "true" ]; then
    print_success "ID token issuance enabled"
    ((TESTS_PASSED++))
else
    print_error "ID token issuance not enabled"
    FAILED_TESTS+=("ID Token Issuance")
    ((TESTS_FAILED++))
fi

if [ "$ACCESS_TOKEN_ENABLED" = "false" ] || [ "$ACCESS_TOKEN_ENABLED" = "null" ]; then
    print_success "Access token issuance properly disabled"
    ((TESTS_PASSED++))
else
    print_warning "Access token issuance is enabled (may not be needed)"
    FAILED_TESTS+=("Access Token Issuance")
    ((TESTS_FAILED++))
fi

# Test 7: Check for HTTPS URLs in production/staging
if [[ "$ENVIRONMENT" != "development" ]]; then
    print_status "Checking HTTPS requirement for $ENVIRONMENT..."
    
    NON_HTTPS_URIS=()
    echo "$REDIRECT_URIS" | while read -r uri; do
        if [[ ! "$uri" =~ ^https:// ]] && [[ ! -z "$uri" ]]; then
            NON_HTTPS_URIS+=("$uri")
        fi
    done
    
    if [ ${#NON_HTTPS_URIS[@]} -eq 0 ]; then
        print_success "All redirect URIs use HTTPS"
        ((TESTS_PASSED++))
    else
        print_error "Non-HTTPS URIs found in $ENVIRONMENT environment:"
        for uri in "${NON_HTTPS_URIS[@]}"; do
            echo "  - $uri"
        done
        FAILED_TESTS+=("HTTPS Requirement")
        ((TESTS_FAILED++))
    fi
fi

# Test 8: Test B2C discovery endpoint
print_status "Testing B2C discovery endpoint..."
DISCOVERY_URL="https://$TENANT_NAME.b2clogin.com/$TENANT_NAME.onmicrosoft.com/B2C_1_signupsignin/v2.0/.well-known/openid_configuration"

if curl -s -f "$DISCOVERY_URL" > /dev/null; then
    print_success "B2C discovery endpoint accessible"
    ((TESTS_PASSED++))
else
    print_warning "B2C discovery endpoint not accessible (may be policy name issue)"
    FAILED_TESTS+=("B2C Discovery Endpoint")
    ((TESTS_FAILED++))
fi

# Test 9: Test frontend URL accessibility
print_status "Testing frontend URL accessibility..."
if curl -s -I "$FRONTEND_URL" | grep -q "200\|301\|302"; then
    print_success "Frontend URL is accessible"
    ((TESTS_PASSED++))
else
    print_warning "Frontend URL not accessible (may not be deployed yet)"
    FAILED_TESTS+=("Frontend Accessibility")
    ((TESTS_FAILED++))
fi

# Test 10: Check for common redirect URI patterns
print_status "Checking for common redirect URI patterns..."
PATTERN_TESTS=(
    "Base URL:$FRONTEND_URL"
    "Auth callback:$FRONTEND_URL/auth/callback"
    "Root with slash:$FRONTEND_URL/"
)

for pattern in "${PATTERN_TESTS[@]}"; do
    pattern_name=$(echo "$pattern" | cut -d: -f1)
    pattern_url=$(echo "$pattern" | cut -d: -f2-)
    
    if echo "$REDIRECT_URIS" | grep -q "^$pattern_url$"; then
        print_success "Pattern found: $pattern_name"
        ((TESTS_PASSED++))
    else
        print_warning "Pattern missing: $pattern_name ($pattern_url)"
        # Don't count as failure since these are optional
    fi
done

# Test 11: Validate tenant configuration
print_status "Validating tenant configuration..."
TENANT_INFO=$(az ad tenant list --query "[?contains(domains[0], '$TENANT_NAME')]" --output json 2>/dev/null)

if [ ! -z "$TENANT_INFO" ] && [ "$TENANT_INFO" != "[]" ]; then
    TENANT_ID=$(echo "$TENANT_INFO" | jq -r '.[0].tenantId' 2>/dev/null)
    print_success "Tenant found: $TENANT_ID"
    ((TESTS_PASSED++))
else
    print_warning "Could not validate tenant (may be permissions issue)"
    FAILED_TESTS+=("Tenant Validation")
    ((TESTS_FAILED++))
fi

# Test 12: Check application type
print_status "Checking application type..."
APP_TYPE=$(echo "$APP_CONFIG" | jq -r '.signInAudience?' 2>/dev/null)

if [[ "$APP_TYPE" =~ ^(AzureADandPersonalMicrosoftAccount|PersonalMicrosoftAccount|AzureADMyOrg)$ ]]; then
    print_success "Application type: $APP_TYPE"
    ((TESTS_PASSED++))
else
    print_warning "Unusual application type: $APP_TYPE"
    FAILED_TESTS+=("Application Type")
    ((TESTS_FAILED++))
fi

# Summary
echo ""
echo "=================================================="
print_status "TEST SUMMARY"
echo "=================================================="
print_success "Tests Passed: $TESTS_PASSED"
if [ $TESTS_FAILED -gt 0 ]; then
    print_error "Tests Failed: $TESTS_FAILED"
    echo ""
    print_error "Failed Tests:"
    for test in "${FAILED_TESTS[@]}"; do
        echo "  - $test"
    done
else
    print_success "Tests Failed: $TESTS_FAILED"
fi

# Configuration summary
echo ""
print_status "Configuration Summary:"
echo "Environment: $ENVIRONMENT"
echo "Tenant: $TENANT_NAME.onmicrosoft.com"
echo "App ID: $APP_ID"
echo "Frontend URL: $FRONTEND_URL"

if [ ! -z "$REDIRECT_URIS" ]; then
    echo ""
    print_status "Configured Redirect URIs:"
    echo "$REDIRECT_URIS" | while read -r uri; do
        echo "  - $uri"
    done
fi

if [ ! -z "$LOGOUT_URL" ] && [ "$LOGOUT_URL" != "null" ]; then
    echo ""
    print_status "Logout URL: $LOGOUT_URL"
fi

# Recommendations
echo ""
print_status "Recommendations:"

if [ ${#MISSING_URIS[@]} -gt 0 ]; then
    echo "1. Add missing redirect URIs:"
    for uri in "${MISSING_URIS[@]}"; do
        echo "   - $uri"
    done
fi

if [ "$ENVIRONMENT" = "production" ]; then
    echo "2. Production recommendations:"
    echo "   - Verify SSL certificates are valid and trusted"
    echo "   - Test authentication flow from different networks"
    echo "   - Monitor authentication logs regularly"
    echo "   - Set up alerts for authentication failures"
fi

echo "3. Test the complete authentication flow:"
echo "   - Navigate to $FRONTEND_URL"
echo "   - Click 'Sign In' button"
echo "   - Complete B2C authentication"
echo "   - Verify successful redirect to callback URL"
echo "   - Test sign out functionality"

echo ""
if [ $TESTS_FAILED -eq 0 ]; then
    print_success "🎉 All tests passed! B2C configuration looks good."
    exit 0
else
    print_error "❌ Some tests failed. Please review the B2C configuration."
    exit 1
fi
