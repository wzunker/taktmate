#!/bin/bash

# Test Azure Key Vault deployment and functionality
# Usage: ./test-key-vault.sh [environment]
# Example: ./test-key-vault.sh production

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

# Determine Key Vault name
KEY_VAULT_NAME="taktmate-kv-${ENVIRONMENT}"
if [ "$ENVIRONMENT" = "development" ]; then
    KEY_VAULT_NAME="taktmate-kv-dev"
fi

print_status "Testing Azure Key Vault: $KEY_VAULT_NAME"

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

if ! az account show &> /dev/null; then
    print_error "Not logged in to Azure CLI"
    exit 1
fi

# Test 1: Key Vault exists
run_test "Key Vault Existence" \
    "az keyvault show --name '$KEY_VAULT_NAME' --output none 2>/dev/null" \
    "Key Vault exists and is accessible"

# Test 2: List secrets permission
run_test "List Secrets Permission" \
    "az keyvault secret list --vault-name '$KEY_VAULT_NAME' --output none 2>/dev/null" \
    "Can list secrets in Key Vault"

# Test 3: Read secret permission
run_test "Read Secret Permission" \
    "az keyvault secret show --vault-name '$KEY_VAULT_NAME' --name 'JWT-Secret' --output none 2>/dev/null" \
    "Can read secrets from Key Vault"

# Test 4: Key Vault properties
print_status "Checking Key Vault properties..."

VAULT_INFO=$(az keyvault show --name "$KEY_VAULT_NAME" --output json 2>/dev/null)
if [ $? -eq 0 ]; then
    SOFT_DELETE_ENABLED=$(echo "$VAULT_INFO" | jq -r '.properties.enableSoftDelete // false')
    PURGE_PROTECTION_ENABLED=$(echo "$VAULT_INFO" | jq -r '.properties.enablePurgeProtection // false')
    SKU=$(echo "$VAULT_INFO" | jq -r '.properties.sku.name')
    
    if [ "$SOFT_DELETE_ENABLED" = "true" ]; then
        print_success "Soft Delete - Enabled"
        ((TESTS_PASSED++))
    else
        print_warning "Soft Delete - Disabled (recommended for production)"
        FAILED_TESTS+=("Soft Delete")
        ((TESTS_FAILED++))
    fi
    
    if [ "$PURGE_PROTECTION_ENABLED" = "true" ]; then
        print_success "Purge Protection - Enabled"
        ((TESTS_PASSED++))
    else
        print_warning "Purge Protection - Disabled (recommended for production)"
        FAILED_TESTS+=("Purge Protection")
        ((TESTS_FAILED++))
    fi
    
    print_success "Key Vault SKU - $SKU"
    ((TESTS_PASSED++))
else
    print_error "Failed to get Key Vault properties"
    FAILED_TESTS+=("Key Vault Properties")
    ((TESTS_FAILED++))
fi

# Test 5: Required secrets exist
print_status "Checking required secrets..."

REQUIRED_SECRETS=(
    "OpenAI-API-Key"
    "Azure-AD-B2C-Client-ID"
    "Azure-AD-B2C-Tenant-Name"
    "JWT-Secret"
    "Session-Secret"
    "Encryption-Key"
)

for secret in "${REQUIRED_SECRETS[@]}"; do
    if az keyvault secret show --vault-name "$KEY_VAULT_NAME" --name "$secret" --output none 2>/dev/null; then
        print_success "Required Secret '$secret' - Exists"
        ((TESTS_PASSED++))
    else
        print_error "Required Secret '$secret' - Missing"
        FAILED_TESTS+=("Secret: $secret")
        ((TESTS_FAILED++))
    fi
done

# Test 6: Secret values are not placeholders
print_status "Checking secret values..."

PLACEHOLDER_SECRETS=()
for secret in "${REQUIRED_SECRETS[@]}"; do
    SECRET_VALUE=$(az keyvault secret show --vault-name "$KEY_VAULT_NAME" --name "$secret" --query "value" --output tsv 2>/dev/null)
    
    if [ $? -eq 0 ] && [ ! -z "$SECRET_VALUE" ]; then
        if [[ "$SECRET_VALUE" == *"placeholder"* ]]; then
            PLACEHOLDER_SECRETS+=("$secret")
            print_warning "Secret '$secret' - Contains placeholder value"
            FAILED_TESTS+=("Placeholder: $secret")
            ((TESTS_FAILED++))
        else
            print_success "Secret '$secret' - Has real value"
            ((TESTS_PASSED++))
        fi
    else
        print_error "Secret '$secret' - Cannot read value"
        FAILED_TESTS+=("Read: $secret")
        ((TESTS_FAILED++))
    fi
done

# Test 7: Access policies
print_status "Checking access policies..."

ACCESS_POLICIES=$(az keyvault show --name "$KEY_VAULT_NAME" --query "properties.accessPolicies" --output json 2>/dev/null)
if [ $? -eq 0 ]; then
    POLICY_COUNT=$(echo "$ACCESS_POLICIES" | jq length)
    print_success "Access Policies - $POLICY_COUNT policies configured"
    ((TESTS_PASSED++))
    
    # Check for App Service managed identity
    APP_SERVICE_POLICY=$(echo "$ACCESS_POLICIES" | jq '.[] | select(.permissions.secrets[] == "get")')
    if [ ! -z "$APP_SERVICE_POLICY" ]; then
        print_success "App Service Access - Configured"
        ((TESTS_PASSED++))
    else
        print_warning "App Service Access - Not found (may not be configured yet)"
        FAILED_TESTS+=("App Service Access")
        ((TESTS_FAILED++))
    fi
else
    print_error "Failed to check access policies"
    FAILED_TESTS+=("Access Policies")
    ((TESTS_FAILED++))
fi

# Test 8: Network access
print_status "Checking network access..."

NETWORK_ACLS=$(az keyvault show --name "$KEY_VAULT_NAME" --query "properties.networkAcls" --output json 2>/dev/null)
if [ $? -eq 0 ]; then
    DEFAULT_ACTION=$(echo "$NETWORK_ACLS" | jq -r '.defaultAction')
    BYPASS=$(echo "$NETWORK_ACLS" | jq -r '.bypass')
    
    print_success "Network Access - Default action: $DEFAULT_ACTION, Bypass: $BYPASS"
    ((TESTS_PASSED++))
else
    print_warning "Network Access - Could not check network ACLs"
    FAILED_TESTS+=("Network Access")
    ((TESTS_FAILED++))
fi

# Test 9: Write permission (if available)
print_status "Testing write permissions..."

TEST_SECRET_NAME="test-write-access-$(date +%s)"
if az keyvault secret set --vault-name "$KEY_VAULT_NAME" --name "$TEST_SECRET_NAME" --value "test-value" --output none 2>/dev/null; then
    print_success "Write Permission - Can create secrets"
    ((TESTS_PASSED++))
    
    # Clean up test secret
    az keyvault secret delete --vault-name "$KEY_VAULT_NAME" --name "$TEST_SECRET_NAME" --output none 2>/dev/null
else
    print_warning "Write Permission - Cannot create secrets (read-only access)"
    # This is not necessarily a failure for App Service scenarios
fi

# Test 10: Performance test
print_status "Testing secret retrieval performance..."

START_TIME=$(date +%s%3N)
SECRET_VALUE=$(az keyvault secret show --vault-name "$KEY_VAULT_NAME" --name "JWT-Secret" --query "value" --output tsv 2>/dev/null)
END_TIME=$(date +%s%3N)

if [ $? -eq 0 ] && [ ! -z "$SECRET_VALUE" ]; then
    RESPONSE_TIME=$((END_TIME - START_TIME))
    if [ $RESPONSE_TIME -lt 2000 ]; then
        print_success "Performance - Secret retrieval: ${RESPONSE_TIME}ms (< 2s)"
        ((TESTS_PASSED++))
    else
        print_warning "Performance - Secret retrieval: ${RESPONSE_TIME}ms (> 2s)"
        FAILED_TESTS+=("Performance")
        ((TESTS_FAILED++))
    fi
else
    print_error "Performance - Failed to retrieve secret for timing"
    FAILED_TESTS+=("Performance Test")
    ((TESTS_FAILED++))
fi

# Test 11: Secret versioning
print_status "Testing secret versioning..."

SECRET_VERSIONS=$(az keyvault secret list-versions --vault-name "$KEY_VAULT_NAME" --name "JWT-Secret" --query "length(@)" --output tsv 2>/dev/null)
if [ $? -eq 0 ] && [ "$SECRET_VERSIONS" -gt 0 ]; then
    print_success "Secret Versioning - $SECRET_VERSIONS versions available"
    ((TESTS_PASSED++))
else
    print_warning "Secret Versioning - Could not check versions"
    FAILED_TESTS+=("Secret Versioning")
    ((TESTS_FAILED++))
fi

# Test 12: Backup and restore capability
print_status "Testing backup capability..."

BACKUP_DIR=$(mktemp -d)
if az keyvault secret backup --vault-name "$KEY_VAULT_NAME" --name "JWT-Secret" --file "$BACKUP_DIR/jwt-secret-backup" --output none 2>/dev/null; then
    print_success "Backup Capability - Can backup secrets"
    ((TESTS_PASSED++))
    rm -rf "$BACKUP_DIR"
else
    print_warning "Backup Capability - Cannot backup secrets"
    FAILED_TESTS+=("Backup Capability")
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

# Additional information
echo ""
print_status "Key Vault Information:"
echo "Name: $KEY_VAULT_NAME"
echo "Environment: $ENVIRONMENT"

if [ ! -z "$VAULT_INFO" ]; then
    VAULT_URI=$(echo "$VAULT_INFO" | jq -r '.properties.vaultUri')
    LOCATION=$(echo "$VAULT_INFO" | jq -r '.location')
    echo "URI: $VAULT_URI"
    echo "Location: $LOCATION"
fi

# Recommendations
echo ""
print_status "Recommendations:"

if [ ${#PLACEHOLDER_SECRETS[@]} -gt 0 ]; then
    echo "1. Update placeholder secrets with real values:"
    for secret in "${PLACEHOLDER_SECRETS[@]}"; do
        echo "   az keyvault secret set --vault-name $KEY_VAULT_NAME --name '$secret' --value 'your-real-value'"
    done
fi

if [ "$ENVIRONMENT" = "production" ]; then
    echo "2. For production environment:"
    echo "   - Enable network restrictions if not using Azure services only"
    echo "   - Review access policies regularly"
    echo "   - Enable Key Vault logging and monitoring"
    echo "   - Consider Premium SKU for HSM-backed keys"
fi

echo "3. Test App Service integration:"
echo "   - Verify App Service can access secrets via managed identity"
echo "   - Check application logs for Key Vault access issues"

echo ""
if [ $TESTS_FAILED -eq 0 ]; then
    print_success "🎉 All tests passed! Key Vault is properly configured and accessible."
    exit 0
else
    print_error "❌ Some tests failed. Please review the Key Vault configuration."
    exit 1
fi
