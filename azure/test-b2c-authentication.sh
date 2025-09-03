#!/bin/bash

# TaktMate Azure AD B2C Authentication Testing Script
# Usage: ./test-b2c-authentication.sh [environment] [domain] [options]
# Example: ./test-b2c-authentication.sh production taktconnect.com --comprehensive --report

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
    echo "TaktMate Azure AD B2C Authentication Testing"
    echo ""
    echo "Usage: $0 [environment] [domain] [options]"
    echo ""
    echo "Environments:"
    echo "  production  - Test production B2C authentication"
    echo "  staging     - Test staging B2C authentication"
    echo "  development - Test development B2C authentication"
    echo "  all         - Test all environments"
    echo ""
    echo "Domains:"
    echo "  taktconnect.com - Primary domain for TaktMate application"
    echo "  taktmate.com    - Alternative domain (if available)"
    echo ""
    echo "Options:"
    echo "  --comprehensive Test all B2C flows and configurations"
    echo "  --endpoints     Test B2C endpoint accessibility"
    echo "  --policies      Test B2C policy configurations"
    echo "  --redirects     Test redirect URL configurations"
    echo "  --tokens        Test token endpoint functionality"
    echo "  --cors          Test CORS configuration with B2C"
    echo "  --report        Generate detailed test report"
    echo "  --verbose       Enable verbose output"
    echo "  --help          Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 production taktconnect.com --comprehensive --report"
    echo "  $0 all taktconnect.com --endpoints --policies"
    echo "  $0 staging taktconnect.com --redirects --cors --verbose"
}

# Parse arguments
ENVIRONMENT=""
DOMAIN=""
COMPREHENSIVE=false
ENDPOINTS=false
POLICIES=false
REDIRECTS=false
TOKENS=false
CORS=false
REPORT=false
VERBOSE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        production|staging|development|all)
            ENVIRONMENT="$1"
            shift
            ;;
        taktconnect.com|taktmate.com)
            DOMAIN="$1"
            shift
            ;;
        --comprehensive)
            COMPREHENSIVE=true
            ENDPOINTS=true
            POLICIES=true
            REDIRECTS=true
            TOKENS=true
            CORS=true
            shift
            ;;
        --endpoints)
            ENDPOINTS=true
            shift
            ;;
        --policies)
            POLICIES=true
            shift
            ;;
        --redirects)
            REDIRECTS=true
            shift
            ;;
        --tokens)
            TOKENS=true
            shift
            ;;
        --cors)
            CORS=true
            shift
            ;;
        --report)
            REPORT=true
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
if [[ ! "$ENVIRONMENT" =~ ^(production|staging|development|all)$ ]]; then
    print_error "Environment must be specified: production, staging, development, or all"
    show_usage
    exit 1
fi

if [[ ! "$DOMAIN" =~ ^(taktconnect\.com|taktmate\.com)$ ]]; then
    print_error "Domain must be specified: taktconnect.com or taktmate.com"
    show_usage
    exit 1
fi

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPORT_DIR="$SCRIPT_DIR/reports"

# Create reports directory if needed
if [ "$REPORT" = true ]; then
    mkdir -p "$REPORT_DIR"
fi

# Azure AD B2C Configuration (would be set as environment variables)
B2C_TENANT_NAME="${B2C_TENANT_NAME:-taktmate}"
B2C_TENANT_ID="${B2C_TENANT_ID:-your-tenant-id}"
B2C_CLIENT_ID="${B2C_CLIENT_ID:-your-client-id}"
B2C_SIGNUP_SIGNIN_POLICY="${B2C_SIGNUP_SIGNIN_POLICY:-B2C_1_signupsignin1}"
B2C_EDIT_PROFILE_POLICY="${B2C_EDIT_PROFILE_POLICY:-B2C_1_profileediting1}"
B2C_RESET_PASSWORD_POLICY="${B2C_RESET_PASSWORD_POLICY:-B2C_1_passwordreset1}"

# Test results tracking
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
WARNING_TESTS=0
TEST_RESULTS=()

# Function to record test result
record_test_result() {
    local test_name="$1"
    local status="$2"
    local message="$3"
    local category="$4"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    case "$status" in
        "PASS")
            PASSED_TESTS=$((PASSED_TESTS + 1))
            print_success "$test_name: $message"
            ;;
        "FAIL")
            FAILED_TESTS=$((FAILED_TESTS + 1))
            print_error "$test_name: $message"
            ;;
        "WARN")
            WARNING_TESTS=$((WARNING_TESTS + 1))
            print_warning "$test_name: $message"
            ;;
    esac
    
    if [ "$REPORT" = true ]; then
        TEST_RESULTS+=("{\"test\":\"$test_name\",\"status\":\"$status\",\"message\":\"$message\",\"category\":\"$category\",\"environment\":\"$ENVIRONMENT\",\"domain\":\"$DOMAIN\",\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}")
    fi
}

# Function to get environment-specific configuration
get_environment_config() {
    local env="$1"
    
    case "$env" in
        "production")
            echo "app.${DOMAIN}:https://app.${DOMAIN}:https://app.${DOMAIN}/auth/callback"
            echo "www.${DOMAIN}:https://www.${DOMAIN}:https://www.${DOMAIN}/auth/callback"
            ;;
        "staging")
            echo "staging.${DOMAIN}:https://staging.${DOMAIN}:https://staging.${DOMAIN}/auth/callback"
            ;;
        "development")
            echo "dev.${DOMAIN}:https://dev.${DOMAIN}:https://dev.${DOMAIN}/auth/callback"
            ;;
    esac
}

# Function to test B2C endpoint accessibility
test_b2c_endpoints() {
    local env="$1"
    
    print_step "Testing Azure AD B2C endpoint accessibility for $env"
    
    # Test B2C discovery endpoints for each policy
    local policies=("$B2C_SIGNUP_SIGNIN_POLICY" "$B2C_EDIT_PROFILE_POLICY" "$B2C_RESET_PASSWORD_POLICY")
    local policy_names=("SignUp/SignIn" "Edit Profile" "Reset Password")
    
    for i in "${!policies[@]}"; do
        local policy="${policies[$i]}"
        local policy_name="${policy_names[$i]}"
        local discovery_url="https://${B2C_TENANT_NAME}.b2clogin.com/${B2C_TENANT_NAME}.onmicrosoft.com/${policy}/v2.0/.well-known/openid_configuration"
        
        if command -v curl &>/dev/null; then
            local response=$(curl -s -o /dev/null -w "%{http_code}" "$discovery_url" --max-time 10 2>/dev/null || echo "000")
            if [ "$response" = "200" ]; then
                record_test_result "B2C Discovery Endpoint ($policy_name)" "PASS" "Endpoint accessible: $discovery_url" "endpoints"
                
                # Test if we can get the actual discovery document
                local discovery_doc=$(curl -s "$discovery_url" --max-time 10 2>/dev/null)
                if echo "$discovery_doc" | jq . &>/dev/null; then
                    record_test_result "B2C Discovery Document ($policy_name)" "PASS" "Valid JSON document returned" "endpoints"
                    
                    # Extract and validate key endpoints
                    local auth_endpoint=$(echo "$discovery_doc" | jq -r '.authorization_endpoint' 2>/dev/null)
                    local token_endpoint=$(echo "$discovery_doc" | jq -r '.token_endpoint' 2>/dev/null)
                    local jwks_uri=$(echo "$discovery_doc" | jq -r '.jwks_uri' 2>/dev/null)
                    
                    if [ -n "$auth_endpoint" ] && [ "$auth_endpoint" != "null" ]; then
                        record_test_result "Authorization Endpoint ($policy_name)" "PASS" "Found: $auth_endpoint" "endpoints"
                    else
                        record_test_result "Authorization Endpoint ($policy_name)" "FAIL" "Not found in discovery document" "endpoints"
                    fi
                    
                    if [ -n "$token_endpoint" ] && [ "$token_endpoint" != "null" ]; then
                        record_test_result "Token Endpoint ($policy_name)" "PASS" "Found: $token_endpoint" "endpoints"
                    else
                        record_test_result "Token Endpoint ($policy_name)" "FAIL" "Not found in discovery document" "endpoints"
                    fi
                    
                    if [ -n "$jwks_uri" ] && [ "$jwks_uri" != "null" ]; then
                        record_test_result "JWKS Endpoint ($policy_name)" "PASS" "Found: $jwks_uri" "endpoints"
                    else
                        record_test_result "JWKS Endpoint ($policy_name)" "FAIL" "Not found in discovery document" "endpoints"
                    fi
                else
                    record_test_result "B2C Discovery Document ($policy_name)" "FAIL" "Invalid JSON document" "endpoints"
                fi
            else
                record_test_result "B2C Discovery Endpoint ($policy_name)" "FAIL" "Endpoint not accessible: HTTP $response" "endpoints"
            fi
        else
            record_test_result "B2C Endpoint Testing" "WARN" "curl not available - skipping endpoint tests" "endpoints"
        fi
    done
}

# Function to test B2C policy configurations
test_b2c_policies() {
    local env="$1"
    
    print_step "Testing Azure AD B2C policy configurations for $env"
    
    # Get environment configuration
    local config_lines=($(get_environment_config "$env"))
    
    for config_line in "${config_lines[@]}"; do
        IFS=':' read -r subdomain base_url callback_url <<< "$config_line"
        
        # Test authorization URLs for each policy
        local policies=("$B2C_SIGNUP_SIGNIN_POLICY" "$B2C_EDIT_PROFILE_POLICY" "$B2C_RESET_PASSWORD_POLICY")
        local policy_names=("SignUp/SignIn" "Edit Profile" "Reset Password")
        
        for i in "${!policies[@]}"; do
            local policy="${policies[$i]}"
            local policy_name="${policy_names[$i]}"
            
            # Construct authorization URL
            local auth_url="https://${B2C_TENANT_NAME}.b2clogin.com/${B2C_TENANT_NAME}.onmicrosoft.com/${policy}/oauth2/v2.0/authorize"
            auth_url="${auth_url}?client_id=${B2C_CLIENT_ID}"
            auth_url="${auth_url}&response_type=code"
            auth_url="${auth_url}&redirect_uri=${callback_url}"
            auth_url="${auth_url}&scope=openid%20profile"
            auth_url="${auth_url}&state=test-state-$(date +%s)"
            auth_url="${auth_url}&nonce=test-nonce-$(date +%s)"
            
            if [ "$VERBOSE" = true ]; then
                print_status "Testing authorization URL for $policy_name: $auth_url"
            fi
            
            if command -v curl &>/dev/null; then
                local auth_response=$(curl -s -o /dev/null -w "%{http_code}" "$auth_url" --max-time 15 2>/dev/null || echo "000")
                if [ "$auth_response" = "200" ] || [ "$auth_response" = "302" ]; then
                    record_test_result "Authorization URL ($policy_name - $subdomain)" "PASS" "HTTP $auth_response - Policy accessible" "policies"
                else
                    record_test_result "Authorization URL ($policy_name - $subdomain)" "FAIL" "HTTP $auth_response - Policy not accessible" "policies"
                fi
            fi
        done
    done
}

# Function to test redirect URL configurations
test_redirect_configurations() {
    local env="$1"
    
    print_step "Testing redirect URL configurations for $env"
    
    if [ -z "$B2C_CLIENT_ID" ] || [ "$B2C_CLIENT_ID" = "your-client-id" ]; then
        record_test_result "B2C Configuration" "FAIL" "B2C_CLIENT_ID not configured" "redirects"
        return 1
    fi
    
    # Get current B2C application configuration via Microsoft Graph API
    if command -v az &>/dev/null && az account show &>/dev/null; then
        local app_config=$(az rest --method GET --url "https://graph.microsoft.com/v1.0/applications/$B2C_CLIENT_ID" 2>/dev/null)
        
        if [ -n "$app_config" ]; then
            # Extract redirect URIs
            local web_redirect_uris=$(echo "$app_config" | jq -r '.web.redirectUris[]?' 2>/dev/null)
            local spa_redirect_uris=$(echo "$app_config" | jq -r '.spa.redirectUris[]?' 2>/dev/null)
            
            # Get expected redirect URLs
            local config_lines=($(get_environment_config "$env"))
            
            for config_line in "${config_lines[@]}"; do
                IFS=':' read -r subdomain base_url callback_url <<< "$config_line"
                
                # Check if callback URL is configured
                if echo "$web_redirect_uris" | grep -q "$callback_url"; then
                    record_test_result "Web Redirect URI ($subdomain)" "PASS" "Configured: $callback_url" "redirects"
                else
                    record_test_result "Web Redirect URI ($subdomain)" "FAIL" "Not configured: $callback_url" "redirects"
                fi
                
                # Check if base URL is configured (for implicit flow)
                if echo "$web_redirect_uris" | grep -q "$base_url"; then
                    record_test_result "Base Redirect URI ($subdomain)" "PASS" "Configured: $base_url" "redirects"
                else
                    record_test_result "Base Redirect URI ($subdomain)" "WARN" "Not configured: $base_url (may be optional)" "redirects"
                fi
                
                # Check SPA redirect URIs
                if echo "$spa_redirect_uris" | grep -q "$callback_url"; then
                    record_test_result "SPA Redirect URI ($subdomain)" "PASS" "Configured: $callback_url" "redirects"
                else
                    record_test_result "SPA Redirect URI ($subdomain)" "WARN" "Not configured: $callback_url (may be optional)" "redirects"
                fi
            done
            
            # Test if redirect URLs are accessible
            for config_line in "${config_lines[@]}"; do
                IFS=':' read -r subdomain base_url callback_url <<< "$config_line"
                
                if command -v curl &>/dev/null; then
                    local base_response=$(curl -s -o /dev/null -w "%{http_code}" "$base_url" --max-time 10 2>/dev/null || echo "000")
                    if [ "$base_response" = "200" ]; then
                        record_test_result "Domain Accessibility ($subdomain)" "PASS" "Domain accessible: $base_url" "redirects"
                    else
                        record_test_result "Domain Accessibility ($subdomain)" "WARN" "Domain not accessible: $base_url (HTTP $base_response)" "redirects"
                    fi
                fi
            done
        else
            record_test_result "B2C Application Configuration" "FAIL" "Could not retrieve application configuration" "redirects"
        fi
    else
        record_test_result "Azure CLI Access" "WARN" "Azure CLI not available or not logged in - skipping redirect URI validation" "redirects"
    fi
}

# Function to test token endpoints
test_token_endpoints() {
    local env="$1"
    
    print_step "Testing B2C token endpoints for $env"
    
    # Test JWKS endpoints for each policy
    local policies=("$B2C_SIGNUP_SIGNIN_POLICY" "$B2C_EDIT_PROFILE_POLICY" "$B2C_RESET_PASSWORD_POLICY")
    local policy_names=("SignUp/SignIn" "Edit Profile" "Reset Password")
    
    for i in "${!policies[@]}"; do
        local policy="${policies[$i]}"
        local policy_name="${policy_names[$i]}"
        
        # Test JWKS endpoint
        local jwks_url="https://${B2C_TENANT_NAME}.b2clogin.com/${B2C_TENANT_NAME}.onmicrosoft.com/${policy}/discovery/v2.0/keys"
        
        if command -v curl &>/dev/null; then
            local jwks_response=$(curl -s -o /dev/null -w "%{http_code}" "$jwks_url" --max-time 10 2>/dev/null || echo "000")
            if [ "$jwks_response" = "200" ]; then
                record_test_result "JWKS Endpoint ($policy_name)" "PASS" "Accessible: $jwks_url" "tokens"
                
                # Validate JWKS document structure
                local jwks_doc=$(curl -s "$jwks_url" --max-time 10 2>/dev/null)
                if echo "$jwks_doc" | jq . &>/dev/null; then
                    local key_count=$(echo "$jwks_doc" | jq '.keys | length' 2>/dev/null || echo "0")
                    if [ "$key_count" -gt 0 ]; then
                        record_test_result "JWKS Keys ($policy_name)" "PASS" "$key_count keys available" "tokens"
                    else
                        record_test_result "JWKS Keys ($policy_name)" "FAIL" "No keys found in JWKS document" "tokens"
                    fi
                else
                    record_test_result "JWKS Document ($policy_name)" "FAIL" "Invalid JSON document" "tokens"
                fi
            else
                record_test_result "JWKS Endpoint ($policy_name)" "FAIL" "Not accessible: HTTP $jwks_response" "tokens"
            fi
        fi
        
        # Test token endpoint (without actual token request)
        local token_url="https://${B2C_TENANT_NAME}.b2clogin.com/${B2C_TENANT_NAME}.onmicrosoft.com/${policy}/oauth2/v2.0/token"
        
        if command -v curl &>/dev/null; then
            # Test with invalid request to see if endpoint is accessible
            local token_response=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$token_url" --max-time 10 2>/dev/null || echo "000")
            if [ "$token_response" = "400" ] || [ "$token_response" = "401" ]; then
                record_test_result "Token Endpoint ($policy_name)" "PASS" "Accessible (HTTP $token_response - expected for invalid request)" "tokens"
            elif [ "$token_response" = "200" ]; then
                record_test_result "Token Endpoint ($policy_name)" "WARN" "Unexpected HTTP 200 response" "tokens"
            else
                record_test_result "Token Endpoint ($policy_name)" "FAIL" "Not accessible: HTTP $token_response" "tokens"
            fi
        fi
    done
}

# Function to test CORS configuration
test_cors_configuration() {
    local env="$1"
    
    print_step "Testing CORS configuration for B2C integration in $env"
    
    # Get environment configuration
    local config_lines=($(get_environment_config "$env"))
    
    for config_line in "${config_lines[@]}"; do
        IFS=':' read -r subdomain base_url callback_url <<< "$config_line"
        
        if command -v curl &>/dev/null; then
            # Test CORS preflight request to the application
            local cors_response=$(curl -s -o /dev/null -w "%{http_code}" \
                -H "Origin: https://${B2C_TENANT_NAME}.b2clogin.com" \
                -H "Access-Control-Request-Method: GET" \
                -H "Access-Control-Request-Headers: Authorization" \
                -X OPTIONS "$base_url" --max-time 10 2>/dev/null || echo "000")
            
            if [ "$cors_response" = "200" ] || [ "$cors_response" = "204" ]; then
                record_test_result "CORS Preflight ($subdomain)" "PASS" "CORS preflight successful (HTTP $cors_response)" "cors"
            else
                record_test_result "CORS Preflight ($subdomain)" "WARN" "CORS preflight failed (HTTP $cors_response) - may need backend CORS config" "cors"
            fi
            
            # Test actual CORS headers
            local cors_headers=$(curl -s -I \
                -H "Origin: https://${B2C_TENANT_NAME}.b2clogin.com" \
                "$base_url" --max-time 10 2>/dev/null | grep -i "access-control" || echo "")
            
            if [ -n "$cors_headers" ]; then
                record_test_result "CORS Headers ($subdomain)" "PASS" "CORS headers present" "cors"
                if [ "$VERBOSE" = true ]; then
                    echo "$cors_headers" | while read -r header; do
                        print_status "  $header"
                    done
                fi
            else
                record_test_result "CORS Headers ($subdomain)" "WARN" "No CORS headers found - may need configuration" "cors"
            fi
        fi
    done
    
    # Test B2C domain CORS configuration
    local b2c_domain="https://${B2C_TENANT_NAME}.b2clogin.com"
    if command -v curl &>/dev/null; then
        local b2c_cors_response=$(curl -s -o /dev/null -w "%{http_code}" \
            -H "Origin: https://app.${DOMAIN}" \
            -H "Access-Control-Request-Method: GET" \
            -X OPTIONS "$b2c_domain" --max-time 10 2>/dev/null || echo "000")
        
        if [ "$b2c_cors_response" = "200" ] || [ "$b2c_cors_response" = "204" ]; then
            record_test_result "B2C CORS Configuration" "PASS" "B2C accepts CORS requests from custom domain" "cors"
        else
            record_test_result "B2C CORS Configuration" "WARN" "B2C CORS response: HTTP $b2c_cors_response" "cors"
        fi
    fi
}

# Function to generate test report
generate_test_report() {
    if [ "$REPORT" = false ]; then
        return 0
    fi
    
    print_step "Generating B2C authentication test report"
    
    local report_file="$REPORT_DIR/b2c-auth-test-report-${ENVIRONMENT}-${DOMAIN}-$(date +%Y%m%d-%H%M%S).json"
    
    local report_data="{
        \"environment\": \"$ENVIRONMENT\",
        \"domain\": \"$DOMAIN\",
        \"b2c_tenant\": \"${B2C_TENANT_NAME}.onmicrosoft.com\",
        \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
        \"summary\": {
            \"total_tests\": $TOTAL_TESTS,
            \"passed\": $PASSED_TESTS,
            \"failed\": $FAILED_TESTS,
            \"warnings\": $WARNING_TESTS,
            \"success_rate\": $(echo "scale=2; $PASSED_TESTS * 100 / $TOTAL_TESTS" | bc -l 2>/dev/null || echo "0")
        },
        \"test_categories\": {
            \"endpoints\": $(echo "${TEST_RESULTS[*]}" | grep -c '"category":"endpoints"' || echo "0"),
            \"policies\": $(echo "${TEST_RESULTS[*]}" | grep -c '"category":"policies"' || echo "0"),
            \"redirects\": $(echo "${TEST_RESULTS[*]}" | grep -c '"category":"redirects"' || echo "0"),
            \"tokens\": $(echo "${TEST_RESULTS[*]}" | grep -c '"category":"tokens"' || echo "0"),
            \"cors\": $(echo "${TEST_RESULTS[*]}" | grep -c '"category":"cors"' || echo "0")
        },
        \"b2c_configuration\": {
            \"tenant_name\": \"$B2C_TENANT_NAME\",
            \"client_id\": \"$B2C_CLIENT_ID\",
            \"policies\": {
                \"signup_signin\": \"$B2C_SIGNUP_SIGNIN_POLICY\",
                \"edit_profile\": \"$B2C_EDIT_PROFILE_POLICY\",
                \"reset_password\": \"$B2C_RESET_PASSWORD_POLICY\"
            }
        },
        \"tests\": [$(IFS=,; echo "${TEST_RESULTS[*]}")]
    }"
    
    echo "$report_data" | jq '.' > "$report_file" 2>/dev/null || echo "$report_data" > "$report_file"
    print_success "B2C authentication test report generated: $report_file"
}

# Function to process single environment
process_environment() {
    local env="$1"
    
    print_header "TESTING B2C AUTHENTICATION - $env ENVIRONMENT"
    
    # Test B2C endpoints
    if [ "$ENDPOINTS" = true ]; then
        test_b2c_endpoints "$env"
    fi
    
    # Test B2C policies
    if [ "$POLICIES" = true ]; then
        test_b2c_policies "$env"
    fi
    
    # Test redirect configurations
    if [ "$REDIRECTS" = true ]; then
        test_redirect_configurations "$env"
    fi
    
    # Test token endpoints
    if [ "$TOKENS" = true ]; then
        test_token_endpoints "$env"
    fi
    
    # Test CORS configuration
    if [ "$CORS" = true ]; then
        test_cors_configuration "$env"
    fi
}

# Main function
main() {
    print_header "AZURE AD B2C AUTHENTICATION TESTING"
    print_status "Environment: $ENVIRONMENT"
    print_status "Domain: $DOMAIN"
    print_status "B2C Tenant: ${B2C_TENANT_NAME}.onmicrosoft.com"
    print_status "Comprehensive Testing: $COMPREHENSIVE"
    echo ""
    
    # Process environments
    if [ "$ENVIRONMENT" = "all" ]; then
        for env in production staging development; do
            process_environment "$env"
            echo ""
        done
    else
        process_environment "$ENVIRONMENT"
    fi
    
    # Generate test report
    generate_test_report
    
    # Print summary
    print_header "B2C AUTHENTICATION TESTING SUMMARY"
    echo "Total Tests: $TOTAL_TESTS"
    echo "Passed: $PASSED_TESTS"
    echo "Failed: $FAILED_TESTS"
    echo "Warnings: $WARNING_TESTS"
    
    if [ $TOTAL_TESTS -gt 0 ]; then
        local success_rate=$(echo "scale=1; $PASSED_TESTS * 100 / $TOTAL_TESTS" | bc -l 2>/dev/null || echo "0")
        echo "Success Rate: ${success_rate}%"
    fi
    
    if [ $FAILED_TESTS -gt 0 ]; then
        print_header "SOME B2C AUTHENTICATION TESTS FAILED! ❌"
        echo ""
        echo "Common issues and solutions:"
        echo "1. Ensure B2C application is configured with correct redirect URLs"
        echo "2. Verify custom domains are accessible and SSL certificates are valid"
        echo "3. Check B2C policies are properly configured and published"
        echo "4. Ensure Azure CLI is logged in with appropriate permissions"
        echo "5. Verify CORS configuration allows B2C domain requests"
        exit 1
    elif [ $WARNING_TESTS -gt 0 ]; then
        print_header "B2C AUTHENTICATION TESTS COMPLETED WITH WARNINGS! ⚠️"
        echo ""
        echo "Review warnings above - some configurations may need attention"
        exit 0
    else
        print_header "ALL B2C AUTHENTICATION TESTS PASSED! ✅"
        exit 0
    fi
}

# Execute main function
main "$@"
