#!/bin/bash

# Manage secrets in Azure Key Vault for TaktMate
# Usage: ./manage-secrets.sh [command] [environment] [secret-name] [secret-value]
# Commands: set, get, list, delete, rotate, backup, restore
# Examples:
#   ./manage-secrets.sh set production OpenAI-API-Key "your-key-here"
#   ./manage-secrets.sh get production OpenAI-API-Key
#   ./manage-secrets.sh list production
#   ./manage-secrets.sh rotate production JWT-Secret

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
    echo "Usage: $0 [command] [environment] [secret-name] [secret-value]"
    echo ""
    echo "Commands:"
    echo "  set      - Set a secret value"
    echo "  get      - Get a secret value"
    echo "  list     - List all secrets"
    echo "  delete   - Delete a secret"
    echo "  rotate   - Generate new value for auto-generated secrets"
    echo "  backup   - Backup all secrets to file"
    echo "  restore  - Restore secrets from backup file"
    echo "  test     - Test Key Vault access"
    echo ""
    echo "Environments: production, staging, development"
    echo ""
    echo "Examples:"
    echo "  $0 set production OpenAI-API-Key 'your-openai-key'"
    echo "  $0 get production OpenAI-API-Key"
    echo "  $0 list production"
    echo "  $0 rotate production JWT-Secret"
    echo "  $0 backup production /path/to/backup.json"
    echo "  $0 test production"
}

# Parse arguments
COMMAND=${1:-""}
ENVIRONMENT=${2:-""}
SECRET_NAME=${3:-""}
SECRET_VALUE=${4:-""}

# Validate command
if [[ ! "$COMMAND" =~ ^(set|get|list|delete|rotate|backup|restore|test)$ ]]; then
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

# Determine Key Vault name
KEY_VAULT_NAME="taktmate-kv-${ENVIRONMENT}"
if [ "$ENVIRONMENT" = "development" ]; then
    KEY_VAULT_NAME="taktmate-kv-dev"
fi

print_status "Using Key Vault: $KEY_VAULT_NAME"

# Check if Azure CLI is installed and user is logged in
if ! command -v az &> /dev/null; then
    print_error "Azure CLI is not installed. Please install it first."
    exit 1
fi

if ! az account show &> /dev/null; then
    print_error "Not logged in to Azure CLI. Please run 'az login' first."
    exit 1
fi

# Check if Key Vault exists
if ! az keyvault show --name "$KEY_VAULT_NAME" &> /dev/null; then
    print_error "Key Vault '$KEY_VAULT_NAME' not found. Please deploy it first."
    exit 1
fi

# Function to generate secure random string
generate_secret() {
    openssl rand -base64 32 | tr -d "=+/" | cut -c1-32
}

# Function to set secret
set_secret() {
    local name="$1"
    local value="$2"
    
    if [ -z "$name" ] || [ -z "$value" ]; then
        print_error "Secret name and value are required for set command"
        exit 1
    fi
    
    print_status "Setting secret: $name"
    
    if az keyvault secret set \
        --vault-name "$KEY_VAULT_NAME" \
        --name "$name" \
        --value "$value" \
        --output none; then
        print_success "Secret '$name' set successfully"
    else
        print_error "Failed to set secret '$name'"
        exit 1
    fi
}

# Function to get secret
get_secret() {
    local name="$1"
    
    if [ -z "$name" ]; then
        print_error "Secret name is required for get command"
        exit 1
    fi
    
    print_status "Getting secret: $name"
    
    local value=$(az keyvault secret show \
        --vault-name "$KEY_VAULT_NAME" \
        --name "$name" \
        --query "value" \
        --output tsv 2>/dev/null)
    
    if [ $? -eq 0 ] && [ ! -z "$value" ]; then
        echo "$value"
    else
        print_error "Failed to get secret '$name' or secret not found"
        exit 1
    fi
}

# Function to list secrets
list_secrets() {
    print_status "Listing all secrets in Key Vault: $KEY_VAULT_NAME"
    
    local secrets=$(az keyvault secret list \
        --vault-name "$KEY_VAULT_NAME" \
        --query "[].{Name:name, Enabled:attributes.enabled, Created:attributes.created, Updated:attributes.updated}" \
        --output table 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        echo "$secrets"
    else
        print_error "Failed to list secrets"
        exit 1
    fi
}

# Function to delete secret
delete_secret() {
    local name="$1"
    
    if [ -z "$name" ]; then
        print_error "Secret name is required for delete command"
        exit 1
    fi
    
    print_warning "Are you sure you want to delete secret '$name'? (y/N)"
    read -r confirmation
    
    if [[ "$confirmation" =~ ^[Yy]$ ]]; then
        print_status "Deleting secret: $name"
        
        if az keyvault secret delete \
            --vault-name "$KEY_VAULT_NAME" \
            --name "$name" \
            --output none; then
            print_success "Secret '$name' deleted successfully"
        else
            print_error "Failed to delete secret '$name'"
            exit 1
        fi
    else
        print_status "Delete operation cancelled"
    fi
}

# Function to rotate auto-generated secrets
rotate_secret() {
    local name="$1"
    
    if [ -z "$name" ]; then
        print_error "Secret name is required for rotate command"
        exit 1
    fi
    
    # List of secrets that can be auto-rotated
    case "$name" in
        "JWT-Secret"|"Session-Secret"|"Encryption-Key")
            print_status "Rotating secret: $name"
            local new_value=$(generate_secret)
            set_secret "$name" "$new_value"
            print_success "Secret '$name' rotated successfully"
            ;;
        *)
            print_error "Secret '$name' cannot be auto-rotated. Use 'set' command instead."
            exit 1
            ;;
    esac
}

# Function to backup secrets
backup_secrets() {
    local backup_file="${SECRET_NAME:-secrets-backup-${ENVIRONMENT}-$(date +%Y%m%d-%H%M%S).json}"
    
    print_status "Backing up secrets to: $backup_file"
    
    # Get all secret names
    local secret_names=$(az keyvault secret list \
        --vault-name "$KEY_VAULT_NAME" \
        --query "[].name" \
        --output tsv 2>/dev/null)
    
    if [ $? -ne 0 ]; then
        print_error "Failed to list secrets for backup"
        exit 1
    fi
    
    # Create backup JSON
    echo "{" > "$backup_file"
    echo "  \"vault\": \"$KEY_VAULT_NAME\"," >> "$backup_file"
    echo "  \"environment\": \"$ENVIRONMENT\"," >> "$backup_file"
    echo "  \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"," >> "$backup_file"
    echo "  \"secrets\": {" >> "$backup_file"
    
    local first=true
    while IFS= read -r secret_name; do
        if [ ! -z "$secret_name" ]; then
            local secret_value=$(az keyvault secret show \
                --vault-name "$KEY_VAULT_NAME" \
                --name "$secret_name" \
                --query "value" \
                --output tsv 2>/dev/null)
            
            if [ $? -eq 0 ]; then
                if [ "$first" = false ]; then
                    echo "," >> "$backup_file"
                fi
                echo -n "    \"$secret_name\": \"$secret_value\"" >> "$backup_file"
                first=false
            fi
        fi
    done <<< "$secret_names"
    
    echo "" >> "$backup_file"
    echo "  }" >> "$backup_file"
    echo "}" >> "$backup_file"
    
    print_success "Secrets backed up to: $backup_file"
    print_warning "Keep this backup file secure - it contains sensitive information!"
}

# Function to restore secrets
restore_secrets() {
    local backup_file="$SECRET_NAME"
    
    if [ -z "$backup_file" ] || [ ! -f "$backup_file" ]; then
        print_error "Backup file is required and must exist for restore command"
        exit 1
    fi
    
    print_warning "This will overwrite existing secrets. Are you sure? (y/N)"
    read -r confirmation
    
    if [[ ! "$confirmation" =~ ^[Yy]$ ]]; then
        print_status "Restore operation cancelled"
        exit 0
    fi
    
    print_status "Restoring secrets from: $backup_file"
    
    # Parse and restore secrets
    local secrets=$(jq -r '.secrets | to_entries[] | "\(.key)=\(.value)"' "$backup_file" 2>/dev/null)
    
    if [ $? -ne 0 ]; then
        print_error "Failed to parse backup file"
        exit 1
    fi
    
    while IFS='=' read -r secret_name secret_value; do
        if [ ! -z "$secret_name" ] && [ ! -z "$secret_value" ]; then
            print_status "Restoring secret: $secret_name"
            set_secret "$secret_name" "$secret_value"
        fi
    done <<< "$secrets"
    
    print_success "Secrets restored successfully"
}

# Function to test Key Vault access
test_access() {
    print_status "Testing Key Vault access..."
    
    # Test list access
    if az keyvault secret list --vault-name "$KEY_VAULT_NAME" --output none 2>/dev/null; then
        print_success "✓ Can list secrets"
    else
        print_error "✗ Cannot list secrets"
        return 1
    fi
    
    # Test read access
    if az keyvault secret show --vault-name "$KEY_VAULT_NAME" --name "JWT-Secret" --output none 2>/dev/null; then
        print_success "✓ Can read secrets"
    else
        print_error "✗ Cannot read secrets"
        return 1
    fi
    
    # Test write access (create a test secret)
    local test_secret_name="test-access-$(date +%s)"
    if az keyvault secret set --vault-name "$KEY_VAULT_NAME" --name "$test_secret_name" --value "test" --output none 2>/dev/null; then
        print_success "✓ Can write secrets"
        # Clean up test secret
        az keyvault secret delete --vault-name "$KEY_VAULT_NAME" --name "$test_secret_name" --output none 2>/dev/null
    else
        print_error "✗ Cannot write secrets"
        return 1
    fi
    
    print_success "All Key Vault access tests passed!"
}

# Execute command
case "$COMMAND" in
    "set")
        set_secret "$SECRET_NAME" "$SECRET_VALUE"
        ;;
    "get")
        get_secret "$SECRET_NAME"
        ;;
    "list")
        list_secrets
        ;;
    "delete")
        delete_secret "$SECRET_NAME"
        ;;
    "rotate")
        rotate_secret "$SECRET_NAME"
        ;;
    "backup")
        backup_secrets
        ;;
    "restore")
        restore_secrets
        ;;
    "test")
        test_access
        ;;
    *)
        print_error "Unknown command: $COMMAND"
        show_usage
        exit 1
        ;;
esac
