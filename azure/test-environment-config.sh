#!/bin/bash

# TaktMate Environment Configuration Testing Script
# Usage: ./test-environment-config.sh [environment] [options]
# Example: ./test-environment-config.sh production --comprehensive --report

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
    echo "TaktMate Environment Configuration Testing"
    echo ""
    echo "Usage: $0 [environment] [options]"
    echo ""
    echo "Environments:"
    echo "  production  - Test production environment configuration"
    echo "  staging     - Test staging environment configuration"
    echo "  development - Test development environment configuration"
    echo "  all         - Test all environment configurations"
    echo ""
    echo "Options:"
    echo "  --comprehensive     Run comprehensive tests including external service validation"
    echo "  --report           Generate detailed test report"
    echo "  --fix              Attempt to fix common configuration issues"
    echo "  --verbose          Enable verbose output"
    echo "  --help             Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 production"
    echo "  $0 staging --comprehensive --report"
    echo "  $0 all --verbose"
    echo "  $0 production --fix"
}

# Parse arguments
ENVIRONMENT=""
COMPREHENSIVE=false
REPORT=false
FIX=false
VERBOSE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        production|staging|development|all)
            ENVIRONMENT="$1"
            shift
            ;;
        --comprehensive)
            COMPREHENSIVE=true
            shift
            ;;
        --report)
            REPORT=true
            shift
            ;;
        --fix)
            FIX=true
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

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(production|staging|development|all)$ ]]; then
    print_error "Environment must be specified: production, staging, development, or all"
    show_usage
    exit 1
fi

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_DIR="$SCRIPT_DIR/config"
REPORT_DIR="$SCRIPT_DIR/reports"

# Create reports directory if it doesn't exist
if [ "$REPORT" = true ]; then
    mkdir -p "$REPORT_DIR"
fi

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
    local environment="$4"
    
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
        TEST_RESULTS+=("{\"test\":\"$test_name\",\"status\":\"$status\",\"message\":\"$message\",\"environment\":\"$environment\",\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}")
    fi
}

# Function to test configuration file existence and syntax
test_config_files() {
    local env="$1"
    print_step "Testing configuration files for $env environment"
    
    local backend_env_file="$CONFIG_DIR/backend-${env}.env"
    local frontend_env_file="$CONFIG_DIR/frontend-${env}.env"
    local app_service_config_file="$CONFIG_DIR/app-service-${env}.json"
    local swa_config_file="$CONFIG_DIR/static-web-app-${env}.json"
    
    # Test backend configuration file
    if [ -f "$backend_env_file" ]; then
        record_test_result "Backend Config File Exists" "PASS" "File found at $backend_env_file" "$env"
        
        # Test for required variables
        local required_vars=("NODE_ENV" "AZURE_KEY_VAULT_NAME" "AZURE_AD_B2C_TENANT_NAME" "OPENAI_API_KEY" "CORS_ORIGIN")
        for var in "${required_vars[@]}"; do
            if grep -q "^${var}=" "$backend_env_file"; then
                record_test_result "Backend Var: $var" "PASS" "Variable defined" "$env"
            else
                record_test_result "Backend Var: $var" "FAIL" "Variable missing or not properly defined" "$env"
            fi
        done
        
        # Test for Key Vault references
        local keyvault_refs=$(grep -c "@Microsoft.KeyVault" "$backend_env_file" || echo "0")
        if [ "$keyvault_refs" -gt 0 ]; then
            record_test_result "Key Vault References" "PASS" "$keyvault_refs Key Vault references found" "$env"
        else
            record_test_result "Key Vault References" "WARN" "No Key Vault references found" "$env"
        fi
    else
        record_test_result "Backend Config File Exists" "FAIL" "File not found at $backend_env_file" "$env"
    fi
    
    # Test frontend configuration file
    if [ -f "$frontend_env_file" ]; then
        record_test_result "Frontend Config File Exists" "PASS" "File found at $frontend_env_file" "$env"
        
        # Test for required React app variables
        local required_react_vars=("REACT_APP_AZURE_AD_B2C_CLIENT_ID" "REACT_APP_AZURE_AD_B2C_AUTHORITY" "REACT_APP_API_BASE_URL" "REACT_APP_REDIRECT_URI")
        for var in "${required_react_vars[@]}"; do
            if grep -q "^${var}=" "$frontend_env_file"; then
                record_test_result "Frontend Var: $var" "PASS" "Variable defined" "$env"
            else
                record_test_result "Frontend Var: $var" "FAIL" "Variable missing or not properly defined" "$env"
            fi
        done
    else
        record_test_result "Frontend Config File Exists" "FAIL" "File not found at $frontend_env_file" "$env"
    fi
    
    # Test App Service configuration JSON
    if [ -f "$app_service_config_file" ]; then
        record_test_result "App Service Config File Exists" "PASS" "File found at $app_service_config_file" "$env"
        
        # Validate JSON syntax
        if jq empty "$app_service_config_file" &>/dev/null; then
            record_test_result "App Service Config JSON Valid" "PASS" "JSON syntax is valid" "$env"
            
            # Test for required JSON properties
            local app_service_name=$(jq -r '.appServiceName' "$app_service_config_file")
            local resource_group=$(jq -r '.resourceGroup' "$app_service_config_file")
            local app_settings_count=$(jq '.configuration.appSettings | length' "$app_service_config_file")
            
            if [ "$app_service_name" != "null" ] && [ "$app_service_name" != "" ]; then
                record_test_result "App Service Name Defined" "PASS" "Name: $app_service_name" "$env"
            else
                record_test_result "App Service Name Defined" "FAIL" "App Service name not defined" "$env"
            fi
            
            if [ "$resource_group" != "null" ] && [ "$resource_group" != "" ]; then
                record_test_result "Resource Group Defined" "PASS" "Resource Group: $resource_group" "$env"
            else
                record_test_result "Resource Group Defined" "FAIL" "Resource group not defined" "$env"
            fi
            
            if [ "$app_settings_count" -gt 0 ]; then
                record_test_result "App Settings Count" "PASS" "$app_settings_count app settings defined" "$env"
            else
                record_test_result "App Settings Count" "FAIL" "No app settings defined" "$env"
            fi
        else
            record_test_result "App Service Config JSON Valid" "FAIL" "Invalid JSON syntax" "$env"
        fi
    else
        record_test_result "App Service Config File Exists" "FAIL" "File not found at $app_service_config_file" "$env"
    fi
    
    # Test Static Web App configuration JSON
    if [ -f "$swa_config_file" ]; then
        record_test_result "Static Web App Config File Exists" "PASS" "File found at $swa_config_file" "$env"
        
        # Validate JSON syntax
        if jq empty "$swa_config_file" &>/dev/null; then
            record_test_result "Static Web App Config JSON Valid" "PASS" "JSON syntax is valid" "$env"
        else
            record_test_result "Static Web App Config JSON Valid" "FAIL" "Invalid JSON syntax" "$env"
        fi
    else
        record_test_result "Static Web App Config File Exists" "FAIL" "File not found at $swa_config_file" "$env"
    fi
}

# Function to test Azure resource connectivity
test_azure_resources() {
    local env="$1"
    print_step "Testing Azure resource connectivity for $env environment"
    
    # Set environment-specific variables
    case "$env" in
        "production")
            local resource_group="taktmate-prod-rg"
            local key_vault_name="taktmate-kv-prod"
            local app_service_name="taktmate-api-prod"
            ;;
        "staging")
            local resource_group="taktmate-staging-rg"
            local key_vault_name="taktmate-kv-staging"
            local app_service_name="taktmate-api-staging"
            ;;
        "development")
            local resource_group="taktmate-dev-rg"
            local key_vault_name="taktmate-kv-dev"
            local app_service_name="taktmate-api-dev"
            ;;
    esac
    
    # Test Azure CLI authentication
    if az account show &>/dev/null; then
        local subscription=$(az account show --query "name" -o tsv)
        record_test_result "Azure CLI Authentication" "PASS" "Authenticated to subscription: $subscription" "$env"
        
        # Test resource group existence
        if az group show --name "$resource_group" &>/dev/null; then
            record_test_result "Resource Group Exists" "PASS" "Resource group $resource_group exists" "$env"
        else
            record_test_result "Resource Group Exists" "FAIL" "Resource group $resource_group does not exist" "$env"
        fi
        
        # Test Key Vault existence and access
        if az keyvault show --name "$key_vault_name" &>/dev/null; then
            record_test_result "Key Vault Exists" "PASS" "Key Vault $key_vault_name exists" "$env"
            
            # Test Key Vault access permissions
            if az keyvault secret list --vault-name "$key_vault_name" --query "length(@)" -o tsv &>/dev/null; then
                local secret_count=$(az keyvault secret list --vault-name "$key_vault_name" --query "length(@)" -o tsv)
                record_test_result "Key Vault Access" "PASS" "Can access Key Vault, $secret_count secrets found" "$env"
            else
                record_test_result "Key Vault Access" "FAIL" "Cannot access Key Vault secrets" "$env"
            fi
        else
            record_test_result "Key Vault Exists" "FAIL" "Key Vault $key_vault_name does not exist" "$env"
        fi
        
        # Test App Service existence
        if az webapp show --name "$app_service_name" --resource-group "$resource_group" &>/dev/null; then
            record_test_result "App Service Exists" "PASS" "App Service $app_service_name exists" "$env"
            
            # Test App Service status
            local app_state=$(az webapp show --name "$app_service_name" --resource-group "$resource_group" --query "state" -o tsv)
            if [ "$app_state" = "Running" ]; then
                record_test_result "App Service Status" "PASS" "App Service is running" "$env"
            else
                record_test_result "App Service Status" "WARN" "App Service state: $app_state" "$env"
            fi
        else
            record_test_result "App Service Exists" "FAIL" "App Service $app_service_name does not exist" "$env"
        fi
    else
        record_test_result "Azure CLI Authentication" "FAIL" "Not authenticated to Azure CLI" "$env"
    fi
}

# Function to test external service connectivity
test_external_services() {
    local env="$1"
    print_step "Testing external service connectivity for $env environment"
    
    # Test OpenAI API connectivity (if API key is available)
    if [ "$COMPREHENSIVE" = true ]; then
        print_status "Testing OpenAI API connectivity (this may take a moment)..."
        
        # This is a simplified test - in a real scenario, you'd need to get the API key from Key Vault
        if command -v curl &>/dev/null; then
            local openai_response=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer test" "https://api.openai.com/v1/models" || echo "000")
            if [ "$openai_response" = "401" ]; then
                record_test_result "OpenAI API Connectivity" "PASS" "OpenAI API is reachable (authentication required)" "$env"
            elif [ "$openai_response" = "000" ]; then
                record_test_result "OpenAI API Connectivity" "FAIL" "Cannot reach OpenAI API" "$env"
            else
                record_test_result "OpenAI API Connectivity" "WARN" "Unexpected response code: $openai_response" "$env"
            fi
        else
            record_test_result "OpenAI API Connectivity" "WARN" "curl not available for testing" "$env"
        fi
    fi
    
    # Test Azure AD B2C endpoints
    case "$env" in
        "production")
            local tenant_name="taktmate"
            ;;
        "staging")
            local tenant_name="taktmate-staging"
            ;;
        "development")
            local tenant_name="taktmate-dev"
            ;;
    esac
    
    local b2c_discovery_url="https://${tenant_name}.b2clogin.com/${tenant_name}.onmicrosoft.com/B2C_1_SignUpSignIn/v2.0/.well-known/openid_configuration"
    
    if command -v curl &>/dev/null; then
        local b2c_response=$(curl -s -o /dev/null -w "%{http_code}" "$b2c_discovery_url" || echo "000")
        if [ "$b2c_response" = "200" ]; then
            record_test_result "B2C Discovery Endpoint" "PASS" "B2C discovery endpoint is reachable" "$env"
        else
            record_test_result "B2C Discovery Endpoint" "FAIL" "B2C discovery endpoint returned: $b2c_response" "$env"
        fi
    else
        record_test_result "B2C Discovery Endpoint" "WARN" "curl not available for testing" "$env"
    fi
}

# Function to test environment consistency
test_environment_consistency() {
    local env="$1"
    print_step "Testing environment consistency for $env environment"
    
    local backend_env_file="$CONFIG_DIR/backend-${env}.env"
    local frontend_env_file="$CONFIG_DIR/frontend-${env}.env"
    
    if [ -f "$backend_env_file" ] && [ -f "$frontend_env_file" ]; then
        # Check if NODE_ENV matches environment
        local node_env=$(grep "^NODE_ENV=" "$backend_env_file" | cut -d'=' -f2)
        if [ "$node_env" = "$env" ]; then
            record_test_result "NODE_ENV Consistency" "PASS" "NODE_ENV matches environment: $env" "$env"
        else
            record_test_result "NODE_ENV Consistency" "FAIL" "NODE_ENV ($node_env) does not match environment ($env)" "$env"
        fi
        
        # Check if REACT_APP_ENVIRONMENT matches (if defined)
        if grep -q "^REACT_APP_ENVIRONMENT=" "$frontend_env_file"; then
            local react_env=$(grep "^REACT_APP_ENVIRONMENT=" "$frontend_env_file" | cut -d'=' -f2)
            if [ "$react_env" = "$env" ]; then
                record_test_result "React Environment Consistency" "PASS" "REACT_APP_ENVIRONMENT matches environment: $env" "$env"
            else
                record_test_result "React Environment Consistency" "FAIL" "REACT_APP_ENVIRONMENT ($react_env) does not match environment ($env)" "$env"
            fi
        fi
        
        # Check if tenant names are consistent
        local backend_tenant=$(grep "^AZURE_AD_B2C_TENANT_NAME=" "$backend_env_file" | cut -d'=' -f2)
        local frontend_tenant=$(grep "^REACT_APP_AZURE_AD_B2C_TENANT_NAME=" "$frontend_env_file" | cut -d'=' -f2)
        
        if [ "$backend_tenant" = "$frontend_tenant" ]; then
            record_test_result "Tenant Name Consistency" "PASS" "Tenant names match: $backend_tenant" "$env"
        else
            record_test_result "Tenant Name Consistency" "FAIL" "Tenant names do not match: backend=$backend_tenant, frontend=$frontend_tenant" "$env"
        fi
    else
        record_test_result "Environment Consistency" "FAIL" "Cannot test consistency - configuration files missing" "$env"
    fi
}

# Function to fix common configuration issues
fix_configuration_issues() {
    local env="$1"
    
    if [ "$FIX" = true ]; then
        print_step "Attempting to fix configuration issues for $env environment"
        
        # This is a placeholder for fix functionality
        # In a real implementation, you would add specific fixes for common issues
        print_warning "Configuration fix functionality not yet implemented"
        print_status "Common fixes that could be implemented:"
        print_status "- Regenerate missing configuration files"
        print_status "- Fix JSON syntax errors"
        print_status "- Update environment-specific values"
        print_status "- Validate and correct Key Vault references"
    fi
}

# Function to generate test report
generate_test_report() {
    local env="$1"
    
    if [ "$REPORT" = true ]; then
        local report_file="$REPORT_DIR/environment-test-report-${env}-$(date +%Y%m%d-%H%M%S).json"
        
        local report_data="{
            \"environment\": \"$env\",
            \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
            \"summary\": {
                \"total_tests\": $TOTAL_TESTS,
                \"passed\": $PASSED_TESTS,
                \"failed\": $FAILED_TESTS,
                \"warnings\": $WARNING_TESTS,
                \"success_rate\": $(echo "scale=2; $PASSED_TESTS * 100 / $TOTAL_TESTS" | bc -l 2>/dev/null || echo "0")
            },
            \"tests\": [$(IFS=,; echo "${TEST_RESULTS[*]}")]
        }"
        
        echo "$report_data" | jq '.' > "$report_file" 2>/dev/null || echo "$report_data" > "$report_file"
        print_success "Test report generated: $report_file"
    fi
}

# Function to test a single environment
test_environment() {
    local env="$1"
    
    print_header "TESTING $env ENVIRONMENT CONFIGURATION"
    
    # Reset counters for this environment
    TOTAL_TESTS=0
    PASSED_TESTS=0
    FAILED_TESTS=0
    WARNING_TESTS=0
    TEST_RESULTS=()
    
    test_config_files "$env"
    test_azure_resources "$env"
    
    if [ "$COMPREHENSIVE" = true ]; then
        test_external_services "$env"
    fi
    
    test_environment_consistency "$env"
    fix_configuration_issues "$env"
    generate_test_report "$env"
    
    # Print summary for this environment
    print_header "$env ENVIRONMENT TEST SUMMARY"
    echo "Total Tests: $TOTAL_TESTS"
    echo "Passed: $PASSED_TESTS"
    echo "Failed: $FAILED_TESTS"
    echo "Warnings: $WARNING_TESTS"
    
    if [ $TOTAL_TESTS -gt 0 ]; then
        local success_rate=$(echo "scale=1; $PASSED_TESTS * 100 / $TOTAL_TESTS" | bc -l 2>/dev/null || echo "0")
        echo "Success Rate: ${success_rate}%"
    fi
    
    if [ $FAILED_TESTS -gt 0 ]; then
        print_error "Some tests failed for $env environment"
        return 1
    elif [ $WARNING_TESTS -gt 0 ]; then
        print_warning "Some tests have warnings for $env environment"
        return 0
    else
        print_success "All tests passed for $env environment"
        return 0
    fi
}

# Main execution
print_header "TAKTMATE ENVIRONMENT CONFIGURATION TESTING"
print_status "Testing Environment(s): $ENVIRONMENT"
print_status "Comprehensive Testing: $COMPREHENSIVE"
print_status "Generate Report: $REPORT"
echo ""

overall_result=0

if [ "$ENVIRONMENT" = "all" ]; then
    for env in production staging development; do
        if ! test_environment "$env"; then
            overall_result=1
        fi
        echo ""
    done
else
    if ! test_environment "$ENVIRONMENT"; then
        overall_result=1
    fi
fi

if [ $overall_result -eq 0 ]; then
    print_header "ALL ENVIRONMENT TESTS COMPLETED SUCCESSFULLY! 🎉"
else
    print_header "SOME ENVIRONMENT TESTS FAILED! ❌"
fi

exit $overall_result
