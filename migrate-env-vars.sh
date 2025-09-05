#!/bin/bash

# Microsoft Entra External ID Environment Variable Migration Script
# This script helps migrate existing Azure AD B2C environment variables to Microsoft Entra External ID

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
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

# Function to backup a file
backup_file() {
    local file="$1"
    if [[ -f "$file" ]]; then
        local backup_file="${file}.backup.$(date +%Y%m%d_%H%M%S)"
        cp "$file" "$backup_file"
        print_success "Backed up $file to $backup_file"
    fi
}

# Function to migrate environment variables in a file
migrate_env_file() {
    local file="$1"
    local description="$2"
    
    if [[ ! -f "$file" ]]; then
        print_warning "$description not found: $file"
        return
    fi
    
    print_status "Migrating $description: $file"
    
    # Create backup
    backup_file "$file"
    
    # Migrate environment variable names
    sed -i.tmp \
        -e 's/AZURE_AD_B2C_TENANT_NAME/ENTRA_EXTERNAL_ID_TENANT_NAME/g' \
        -e 's/AZURE_AD_B2C_TENANT_ID/ENTRA_EXTERNAL_ID_TENANT_ID/g' \
        -e 's/AZURE_AD_B2C_DOMAIN/ENTRA_EXTERNAL_ID_DOMAIN/g' \
        -e 's/AZURE_AD_B2C_CLIENT_ID/ENTRA_EXTERNAL_ID_CLIENT_ID/g' \
        -e 's/AZURE_AD_B2C_CLIENT_SECRET/ENTRA_EXTERNAL_ID_CLIENT_SECRET/g' \
        -e 's/AZURE_AD_B2C_SIGNUP_SIGNIN_POLICY/ENTRA_EXTERNAL_ID_SIGNUP_SIGNIN_POLICY/g' \
        -e 's/AZURE_AD_B2C_SIGN_UP_SIGN_IN_POLICY/ENTRA_EXTERNAL_ID_SIGNUP_SIGNIN_POLICY/g' \
        -e 's/AZURE_AD_B2C_PASSWORD_RESET_POLICY/ENTRA_EXTERNAL_ID_PASSWORD_RESET_POLICY/g' \
        -e 's/AZURE_AD_B2C_PROFILE_EDIT_POLICY/ENTRA_EXTERNAL_ID_PROFILE_EDIT_POLICY/g' \
        -e 's/AZURE_AD_B2C_EDIT_PROFILE_POLICY/ENTRA_EXTERNAL_ID_EDIT_PROFILE_POLICY/g' \
        -e 's/AZURE_AD_B2C_RESET_PASSWORD_POLICY/ENTRA_EXTERNAL_ID_RESET_PASSWORD_POLICY/g' \
        -e 's/AZURE_AD_B2C_USE_CUSTOM_POLICIES/ENTRA_EXTERNAL_ID_USE_CUSTOM_POLICIES/g' \
        -e 's/AZURE_AD_B2C_CUSTOM_POLICY_SIGNUP_SIGNIN/ENTRA_EXTERNAL_ID_CUSTOM_POLICY_SIGNUP_SIGNIN/g' \
        -e 's/AZURE_AD_B2C_CUSTOM_POLICY_PASSWORD_RESET/ENTRA_EXTERNAL_ID_CUSTOM_POLICY_PASSWORD_RESET/g' \
        -e 's/AZURE_AD_B2C_CUSTOM_POLICY_PROFILE_EDIT/ENTRA_EXTERNAL_ID_CUSTOM_POLICY_PROFILE_EDIT/g' \
        -e 's/AZURE_AD_B2C_SCOPE/ENTRA_EXTERNAL_ID_SCOPE/g' \
        -e 's/AZURE_AD_B2C_REDIRECT_URI/ENTRA_EXTERNAL_ID_REDIRECT_URI/g' \
        -e 's/AZURE_AD_B2C_POST_LOGOUT_REDIRECT_URI/ENTRA_EXTERNAL_ID_POST_LOGOUT_REDIRECT_URI/g' \
        -e 's/AZURE_AD_B2C_AUTHORITY/ENTRA_EXTERNAL_ID_AUTHORITY/g' \
        -e 's/AZURE_AD_B2C_KNOWN_AUTHORITY/ENTRA_EXTERNAL_ID_KNOWN_AUTHORITY/g' \
        -e 's/AZURE_AD_B2C_DISCOVERY_ENDPOINT/ENTRA_EXTERNAL_ID_DISCOVERY_ENDPOINT/g' \
        "$file"
    
    # Migrate React app environment variables
    sed -i.tmp \
        -e 's/REACT_APP_AZURE_AD_B2C_CLIENT_ID/REACT_APP_ENTRA_EXTERNAL_ID_CLIENT_ID/g' \
        -e 's/REACT_APP_AZURE_AD_B2C_AUTHORITY/REACT_APP_ENTRA_EXTERNAL_ID_AUTHORITY/g' \
        -e 's/REACT_APP_AZURE_AD_B2C_KNOWN_AUTHORITY/REACT_APP_ENTRA_EXTERNAL_ID_KNOWN_AUTHORITY/g' \
        -e 's/REACT_APP_AZURE_AD_B2C_TENANT_NAME/REACT_APP_ENTRA_EXTERNAL_ID_TENANT_NAME/g' \
        -e 's/REACT_APP_AZURE_AD_B2C_SIGNUP_SIGNIN_POLICY/REACT_APP_ENTRA_EXTERNAL_ID_SIGNUP_SIGNIN_POLICY/g' \
        -e 's/REACT_APP_AZURE_AD_B2C_EDIT_PROFILE_POLICY/REACT_APP_ENTRA_EXTERNAL_ID_EDIT_PROFILE_POLICY/g' \
        -e 's/REACT_APP_AZURE_AD_B2C_RESET_PASSWORD_POLICY/REACT_APP_ENTRA_EXTERNAL_ID_RESET_PASSWORD_POLICY/g' \
        -e 's/REACT_APP_AZURE_AD_B2C_SCOPE/REACT_APP_ENTRA_EXTERNAL_ID_SCOPE/g' \
        "$file"
    
    # Migrate domain endpoints from b2clogin.com to ciamlogin.com
    sed -i.tmp \
        -e 's/\\.b2clogin\\.com/.ciamlogin.com/g' \
        "$file"
    
    # Migrate Azure Key Vault secret names
    sed -i.tmp \
        -e 's/Azure-AD-B2C-Tenant-ID/Entra-External-ID-Tenant-ID/g' \
        -e 's/Azure-AD-B2C-Client-ID/Entra-External-ID-Client-ID/g' \
        -e 's/Azure-AD-B2C-Client-Secret/Entra-External-ID-Client-Secret/g' \
        "$file"
    
    # Update comments and documentation references
    sed -i.tmp \
        -e 's/Azure AD B2C/Microsoft Entra External ID/g' \
        -e 's/AZURE AD B2C/MICROSOFT ENTRA EXTERNAL ID/g' \
        -e 's/AZURE_AD_B2C_SETUP\\.md/MICROSOFT_ENTRA_EXTERNAL_ID_SETUP.md/g' \
        "$file"
    
    # Remove temporary file
    rm -f "${file}.tmp"
    
    print_success "Migrated $description"
}

# Main migration function
main() {
    print_status "Starting Microsoft Entra External ID Environment Variable Migration"
    print_status "This script will migrate Azure AD B2C environment variables to Microsoft Entra External ID"
    echo
    
    # Check if we're in the right directory
    if [[ ! -f "package.json" ]] && [[ ! -f "backend/package.json" ]] && [[ ! -f "frontend/package.json" ]]; then
        print_error "This script should be run from the project root directory"
        exit 1
    fi
    
    # Ask for confirmation
    echo -e "${YELLOW}This script will:"
    echo "1. Create backups of all environment files"
    echo "2. Update variable names from AZURE_AD_B2C_* to ENTRA_EXTERNAL_ID_*"
    echo "3. Update domain endpoints from *.b2clogin.com to *.ciamlogin.com"
    echo "4. Update Azure Key Vault secret names"
    echo "5. Update comments and documentation references"
    echo
    echo -e "Do you want to continue? (y/N): ${NC}"
    read -r response
    
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        print_status "Migration cancelled"
        exit 0
    fi
    
    echo
    print_status "Starting migration..."
    echo
    
    # Migrate backend environment files
    migrate_env_file "backend/env.example" "Backend environment example"
    migrate_env_file "backend/env.production" "Backend production environment"
    migrate_env_file "backend/env.staging" "Backend staging environment"
    migrate_env_file "backend/.env" "Backend local environment"
    
    # Migrate frontend environment files
    migrate_env_file "frontend/env.production" "Frontend production environment"
    migrate_env_file "frontend/env.staging" "Frontend staging environment"
    migrate_env_file "frontend/.env" "Frontend local environment"
    migrate_env_file "frontend/.env.local" "Frontend local environment (local)"
    migrate_env_file "frontend/.env.development" "Frontend development environment"
    migrate_env_file "frontend/.env.production" "Frontend production environment (local)"
    
    # Migrate root environment files
    migrate_env_file ".env" "Root environment file"
    migrate_env_file "frontend-env.example" "Frontend environment example"
    
    echo
    print_success "Migration completed successfully!"
    echo
    print_warning "IMPORTANT NEXT STEPS:"
    echo "1. Review all migrated files to ensure they look correct"
    echo "2. Update your Azure Key Vault with the new secret names:"
    echo "   - Entra-External-ID-Tenant-ID"
    echo "   - Entra-External-ID-Client-ID"
    echo "   - Entra-External-ID-Client-Secret"
    echo "3. Update your CI/CD pipelines to use the new environment variable names"
    echo "4. Test the application with the new configuration"
    echo "5. Update your Microsoft Entra External ID tenant configuration"
    echo
    print_status "Backup files have been created with .backup.YYYYMMDD_HHMMSS extension"
    print_status "You can restore from backups if needed"
}

# Run the migration
main "$@"
