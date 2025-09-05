#!/bin/bash

# TaktMate Microsoft Entra External ID Redirect URL Management Script
# Usage: ./update-b2c-redirect-urls.sh [environment] [domain] [options]
# Example: ./update-b2c-redirect-urls.sh production taktconnect.com --update --validate

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
    echo "TaktMate Microsoft Entra External ID Redirect URL Management"
    echo ""
    echo "Usage: $0 [environment] [domain] [options]"
    echo ""
    echo "Environments:"
    echo "  production  - Production B2C redirect URL configuration"
    echo "  staging     - Staging B2C redirect URL configuration"
    echo "  development - Development B2C redirect URL configuration"
    echo "  all         - All environments"
    echo ""
    echo "Domains:"
    echo "  taktconnect.com - Primary domain for TaktMate application"
    echo "  taktmate.com    - Alternative domain (if available)"
    echo ""
    echo "Options:"
    echo "  --update        Update B2C redirect URLs with custom domains"
    echo "  --validate      Validate B2C redirect URL configuration"
    echo "  --test          Test B2C authentication flow with custom domains"
    echo "  --backup        Backup current B2C configuration before changes"
    echo "  --restore       Restore B2C configuration from backup"
    echo "  --dry-run       Show what would be updated without executing"
    echo "  --verbose       Enable verbose output"
    echo "  --help          Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 production taktconnect.com --update --validate --backup"
    echo "  $0 all taktconnect.com --validate --verbose"
    echo "  $0 staging taktconnect.com --test --dry-run"
}

# Parse arguments
ENVIRONMENT=""
DOMAIN=""
UPDATE=false
VALIDATE=false
TEST=false
BACKUP=false
RESTORE=false
DRY_RUN=false
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
        --update)
            UPDATE=true
            shift
            ;;
        --validate)
            VALIDATE=true
            shift
            ;;
        --test)
            TEST=true
            shift
            ;;
        --backup)
            BACKUP=true
            shift
            ;;
        --restore)
            RESTORE=true
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
BACKUP_DIR="$SCRIPT_DIR/b2c-backups"
LOG_DIR="$SCRIPT_DIR/logs"

# Create directories if needed
mkdir -p "$BACKUP_DIR" "$LOG_DIR"

# Microsoft Entra External ID Configuration (these would be set as environment variables in practice)
# Note: These are placeholder values - actual values would be configured in environment
B2C_TENANT_NAME="${B2C_TENANT_NAME:-taktmate}"
B2C_TENANT_ID="${B2C_TENANT_ID:-your-tenant-id}"
B2C_CLIENT_ID="${B2C_CLIENT_ID:-your-client-id}"
B2C_SIGNUP_SIGNIN_POLICY="${B2C_SIGNUP_SIGNIN_POLICY:-B2C_1_signupsignin1}"
B2C_EDIT_PROFILE_POLICY="${B2C_EDIT_PROFILE_POLICY:-B2C_1_profileediting1}"
B2C_RESET_PASSWORD_POLICY="${B2C_RESET_PASSWORD_POLICY:-B2C_1_passwordreset1}"

# Function to get environment-specific configuration
get_environment_config() {
    local env="$1"
    
    case "$env" in
        "production")
            echo "app.${DOMAIN}:https://app.${DOMAIN}:https://app.${DOMAIN}/auth/callback:https://app.${DOMAIN}/"
            # Include www domain for production
            echo "www.${DOMAIN}:https://www.${DOMAIN}:https://www.${DOMAIN}/auth/callback:https://www.${DOMAIN}/"
            ;;
        "staging")
            echo "staging.${DOMAIN}:https://staging.${DOMAIN}:https://staging.${DOMAIN}/auth/callback:https://staging.${DOMAIN}/"
            ;;
        "development")
            echo "dev.${DOMAIN}:https://dev.${DOMAIN}:https://dev.${DOMAIN}/auth/callback:https://dev.${DOMAIN}/"
            ;;
    esac
}

# Function to get all environments configuration
get_all_environments_config() {
    get_environment_config "production"
    get_environment_config "staging"
    get_environment_config "development"
}

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

# Function to check Azure CLI authentication and B2C access
check_azure_access() {
    print_step "Checking Azure CLI authentication and B2C access"
    
    # Check if logged in to Azure CLI
    if ! az account show &>/dev/null; then
        print_error "Not logged in to Azure CLI. Please run 'az login' first."
        return 1
    fi
    
    # Check if Microsoft Graph extension is installed
    if ! az extension list --query "[?name=='application']" -o tsv | grep -q application; then
        print_status "Installing Azure CLI application extension for B2C management"
        if [ "$DRY_RUN" = false ]; then
            az extension add --name application --only-show-errors
        fi
    fi
    
    # Validate B2C tenant access
    if [ "$DRY_RUN" = false ]; then
        if ! az rest --method GET --url "https://graph.microsoft.com/v1.0/applications" --query "value[0].id" -o tsv &>/dev/null; then
            print_error "Cannot access Microsoft Graph API. Please ensure you have appropriate permissions."
            return 1
        fi
    fi
    
    print_success "Azure CLI authentication and B2C access verified"
    return 0
}

# Function to backup B2C application configuration
backup_b2c_config() {
    if [ "$BACKUP" = false ]; then
        return 0
    fi
    
    print_step "Backing up Microsoft Entra External ID application configuration"
    
    local backup_timestamp=$(date +%Y%m%d-%H%M%S)
    local backup_file="$BACKUP_DIR/b2c-config-backup-${ENVIRONMENT}-${backup_timestamp}.json"
    
    if [ "$DRY_RUN" = false ]; then
        # Get current application configuration
        if az rest --method GET --url "https://graph.microsoft.com/v1.0/applications/$B2C_CLIENT_ID" --query "{id:id,displayName:displayName,web:web,spa:spa,publicClient:publicClient}" > "$backup_file" 2>/dev/null; then
            print_success "B2C configuration backed up to: $backup_file"
        else
            print_warning "Failed to backup B2C configuration - continuing without backup"
        fi
    else
        print_status "[DRY-RUN] Would backup B2C configuration to: $backup_file"
    fi
}

# Function to get current B2C redirect URLs
get_current_redirect_urls() {
    local app_id="$1"
    
    if [ "$DRY_RUN" = true ]; then
        echo "https://taktmate-frontend-prod.azurestaticapps.net/auth/callback"
        echo "https://taktmate-frontend-staging.azurestaticapps.net/auth/callback"
        return 0
    fi
    
    # Get current redirect URIs from the application
    local redirect_uris=$(az rest --method GET --url "https://graph.microsoft.com/v1.0/applications/$app_id" --query "web.redirectUris" -o tsv 2>/dev/null | tr '\t' '\n')
    
    if [ -n "$redirect_uris" ]; then
        echo "$redirect_uris"
    else
        print_warning "Could not retrieve current redirect URLs for application: $app_id"
    fi
}

# Function to update B2C redirect URLs
update_b2c_redirect_urls() {
    local env="$1"
    
    print_step "Updating Microsoft Entra External ID redirect URLs for $env environment"
    
    if [ -z "$B2C_CLIENT_ID" ] || [ "$B2C_CLIENT_ID" = "your-client-id" ]; then
        print_error "B2C_CLIENT_ID not configured. Please set the environment variable."
        return 1
    fi
    
    # Get environment-specific configuration
    local config_lines
    if [ "$env" = "all" ]; then
        config_lines=($(get_all_environments_config))
    else
        config_lines=($(get_environment_config "$env"))
    fi
    
    # Build redirect URLs array
    local redirect_urls=()
    local logout_urls=()
    
    for config_line in "${config_lines[@]}"; do
        IFS=':' read -r subdomain base_url callback_url logout_url <<< "$config_line"
        redirect_urls+=("$callback_url")
        logout_urls+=("$logout_url")
        
        if [ "$VERBOSE" = true ]; then
            print_status "  Adding redirect URL: $callback_url"
            print_status "  Adding logout URL: $logout_url"
        fi
    done
    
    # Get current redirect URLs to preserve existing ones
    local current_urls=$(get_current_redirect_urls "$B2C_CLIENT_ID")
    
    # Merge current and new URLs (avoiding duplicates)
    local all_redirect_urls=()
    local all_logout_urls=()
    
    # Add current URLs
    while IFS= read -r url; do
        if [ -n "$url" ] && [[ "$url" != *"azurestaticapps.net"* ]] || [ "$env" = "all" ]; then
            all_redirect_urls+=("$url")
        fi
    done <<< "$current_urls"
    
    # Add new custom domain URLs
    for url in "${redirect_urls[@]}"; do
        if [[ ! " ${all_redirect_urls[*]} " =~ " ${url} " ]]; then
            all_redirect_urls+=("$url")
        fi
    done
    
    # Add logout URLs (similar process)
    for url in "${logout_urls[@]}"; do
        if [[ ! " ${all_logout_urls[*]} " =~ " ${url} " ]]; then
            all_logout_urls+=("$url")
        fi
    done
    
    # Prepare JSON payload for Microsoft Graph API
    local redirect_uris_json=$(printf '"%s",' "${all_redirect_urls[@]}" | sed 's/,$//')
    local logout_uris_json=$(printf '"%s",' "${all_logout_urls[@]}" | sed 's/,$//')
    
    local update_payload="{
        \"web\": {
            \"redirectUris\": [$redirect_uris_json],
            \"logoutUrl\": \"${all_logout_urls[0]}\",
            \"implicitGrantSettings\": {
                \"enableIdTokenIssuance\": true,
                \"enableAccessTokenIssuance\": true
            }
        },
        \"spa\": {
            \"redirectUris\": [$redirect_uris_json]
        }
    }"
    
    if [ "$DRY_RUN" = false ]; then
        # Update the application configuration
        if az rest --method PATCH --url "https://graph.microsoft.com/v1.0/applications/$B2C_CLIENT_ID" --body "$update_payload" --headers "Content-Type=application/json" &>/dev/null; then
            print_success "B2C redirect URLs updated successfully"
            
            # Log the update
            local log_file="$LOG_DIR/b2c-updates-$(date +%Y%m%d).log"
            echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) - Updated B2C redirect URLs for $env environment" >> "$log_file"
            
            if [ "$VERBOSE" = true ]; then
                print_status "Updated redirect URLs:"
                for url in "${all_redirect_urls[@]}"; do
                    print_status "  - $url"
                done
            fi
        else
            print_error "Failed to update B2C redirect URLs"
            return 1
        fi
    else
        print_status "[DRY-RUN] Would update B2C application with redirect URLs:"
        for url in "${all_redirect_urls[@]}"; do
            print_status "  - $url"
        done
    fi
}

# Function to validate B2C redirect URL configuration
validate_b2c_config() {
    local env="$1"
    
    print_step "Validating Microsoft Entra External ID redirect URL configuration for $env"
    
    if [ -z "$B2C_CLIENT_ID" ] || [ "$B2C_CLIENT_ID" = "your-client-id" ]; then
        print_error "B2C_CLIENT_ID not configured. Cannot validate configuration."
        return 1
    fi
    
    if [ "$DRY_RUN" = true ]; then
        print_status "[DRY-RUN] Would validate B2C configuration for $env environment"
        return 0
    fi
    
    # Get current application configuration
    local app_config=$(az rest --method GET --url "https://graph.microsoft.com/v1.0/applications/$B2C_CLIENT_ID" 2>/dev/null)
    
    if [ -z "$app_config" ]; then
        print_error "Could not retrieve B2C application configuration"
        return 1
    fi
    
    # Extract redirect URIs
    local current_redirect_uris=$(echo "$app_config" | jq -r '.web.redirectUris[]?' 2>/dev/null | sort)
    local current_spa_uris=$(echo "$app_config" | jq -r '.spa.redirectUris[]?' 2>/dev/null | sort)
    local logout_url=$(echo "$app_config" | jq -r '.web.logoutUrl?' 2>/dev/null)
    
    print_success "Current B2C application configuration:"
    
    if [ -n "$current_redirect_uris" ]; then
        print_status "Web Redirect URIs:"
        echo "$current_redirect_uris" | while read -r uri; do
            if [ -n "$uri" ]; then
                print_status "  - $uri"
            fi
        done
    else
        print_warning "No web redirect URIs configured"
    fi
    
    if [ -n "$current_spa_uris" ]; then
        print_status "SPA Redirect URIs:"
        echo "$current_spa_uris" | while read -r uri; do
            if [ -n "$uri" ]; then
                print_status "  - $uri"
            fi
        done
    else
        print_warning "No SPA redirect URIs configured"
    fi
    
    if [ -n "$logout_url" ] && [ "$logout_url" != "null" ]; then
        print_status "Logout URL: $logout_url"
    else
        print_warning "No logout URL configured"
    fi
    
    # Validate expected URLs are present
    local config_lines
    if [ "$env" = "all" ]; then
        config_lines=($(get_all_environments_config))
    else
        config_lines=($(get_environment_config "$env"))
    fi
    
    local validation_passed=true
    
    for config_line in "${config_lines[@]}"; do
        IFS=':' read -r subdomain base_url callback_url logout_url <<< "$config_line"
        
        # Check if callback URL is configured
        if echo "$current_redirect_uris" | grep -q "$callback_url"; then
            print_success "✅ Callback URL configured: $callback_url"
        else
            print_error "❌ Callback URL missing: $callback_url"
            validation_passed=false
        fi
        
        # Check if base URL is configured (for implicit flow)
        if echo "$current_redirect_uris" | grep -q "$base_url"; then
            print_success "✅ Base URL configured: $base_url"
        else
            print_warning "⚠️  Base URL not configured: $base_url (may be optional)"
        fi
    done
    
    if [ "$validation_passed" = true ]; then
        print_success "B2C redirect URL validation passed"
        return 0
    else
        print_error "B2C redirect URL validation failed"
        return 1
    fi
}

# Function to test B2C authentication flow
test_b2c_auth_flow() {
    local env="$1"
    
    print_step "Testing Microsoft Entra External ID authentication flow for $env"
    
    if [ "$DRY_RUN" = true ]; then
        print_status "[DRY-RUN] Would test B2C authentication flow for $env environment"
        return 0
    fi
    
    # Get environment-specific configuration
    local config_lines
    if [ "$env" = "all" ]; then
        config_lines=($(get_all_environments_config))
    else
        config_lines=($(get_environment_config "$env"))
    fi
    
    for config_line in "${config_lines[@]}"; do
        IFS=':' read -r subdomain base_url callback_url logout_url <<< "$config_line"
        
        print_status "Testing B2C endpoints for: $subdomain"
        
        # Test B2C discovery endpoint
        local discovery_url="https://${B2C_TENANT_NAME}.b2clogin.com/${B2C_TENANT_NAME}.onmicrosoft.com/${B2C_SIGNUP_SIGNIN_POLICY}/v2.0/.well-known/openid_configuration"
        
        if command -v curl &>/dev/null; then
            local discovery_response=$(curl -s -o /dev/null -w "%{http_code}" "$discovery_url" --max-time 10 2>/dev/null || echo "000")
            if [ "$discovery_response" = "200" ]; then
                print_success "✅ B2C discovery endpoint accessible: $discovery_url"
            else
                print_error "❌ B2C discovery endpoint failed: $discovery_url (HTTP $discovery_response)"
            fi
        fi
        
        # Test domain accessibility (prerequisite for B2C flow)
        local domain_response=$(curl -s -o /dev/null -w "%{http_code}" "$base_url" --max-time 10 2>/dev/null || echo "000")
        if [ "$domain_response" = "200" ]; then
            print_success "✅ Domain accessible: $base_url"
        else
            print_warning "⚠️  Domain not accessible: $base_url (HTTP $domain_response)"
        fi
        
        # Generate test B2C authorization URL
        local auth_url="https://${B2C_TENANT_NAME}.b2clogin.com/${B2C_TENANT_NAME}.onmicrosoft.com/${B2C_SIGNUP_SIGNIN_POLICY}/oauth2/v2.0/authorize"
        auth_url="${auth_url}?client_id=${B2C_CLIENT_ID}"
        auth_url="${auth_url}&response_type=code"
        auth_url="${auth_url}&redirect_uri=${callback_url}"
        auth_url="${auth_url}&scope=openid%20profile"
        auth_url="${auth_url}&state=test-state"
        auth_url="${auth_url}&nonce=test-nonce"
        
        if [ "$VERBOSE" = true ]; then
            print_status "Test authorization URL: $auth_url"
        fi
        
        # Test if the authorization endpoint is accessible
        local auth_response=$(curl -s -o /dev/null -w "%{http_code}" "$auth_url" --max-time 10 2>/dev/null || echo "000")
        if [ "$auth_response" = "200" ] || [ "$auth_response" = "302" ]; then
            print_success "✅ B2C authorization endpoint accessible"
        else
            print_error "❌ B2C authorization endpoint failed (HTTP $auth_response)"
        fi
    done
}

# Function to restore B2C configuration from backup
restore_b2c_config() {
    if [ "$RESTORE" = false ]; then
        return 0
    fi
    
    print_step "Restoring Microsoft Entra External ID configuration from backup"
    
    # Find the most recent backup file
    local latest_backup=$(ls -t "$BACKUP_DIR"/b2c-config-backup-*.json 2>/dev/null | head -1)
    
    if [ -z "$latest_backup" ]; then
        print_error "No backup file found in $BACKUP_DIR"
        return 1
    fi
    
    print_status "Restoring from backup: $latest_backup"
    
    if [ "$DRY_RUN" = false ]; then
        # Read backup configuration
        local backup_config=$(cat "$latest_backup")
        
        if [ -n "$backup_config" ]; then
            # Extract relevant configuration for restoration
            local restore_payload=$(echo "$backup_config" | jq '{web: .web, spa: .spa, publicClient: .publicClient}')
            
            # Restore the configuration
            if az rest --method PATCH --url "https://graph.microsoft.com/v1.0/applications/$B2C_CLIENT_ID" --body "$restore_payload" --headers "Content-Type=application/json" &>/dev/null; then
                print_success "B2C configuration restored successfully"
            else
                print_error "Failed to restore B2C configuration"
                return 1
            fi
        else
            print_error "Backup file is empty or invalid"
            return 1
        fi
    else
        print_status "[DRY-RUN] Would restore B2C configuration from: $latest_backup"
    fi
}

# Function to display configuration summary
display_config_summary() {
    print_header "AZURE AD B2C REDIRECT URL CONFIGURATION SUMMARY"
    
    echo "Environment: $ENVIRONMENT"
    echo "Domain: $DOMAIN"
    echo "B2C Tenant: ${B2C_TENANT_NAME}.onmicrosoft.com"
    echo "B2C Client ID: $B2C_CLIENT_ID"
    echo ""
    
    # Show expected redirect URLs
    local config_lines
    if [ "$ENVIRONMENT" = "all" ]; then
        config_lines=($(get_all_environments_config))
    else
        config_lines=($(get_environment_config "$ENVIRONMENT"))
    fi
    
    echo "Expected Redirect URLs:"
    for config_line in "${config_lines[@]}"; do
        IFS=':' read -r subdomain base_url callback_url logout_url <<< "$config_line"
        echo "  Environment: $(echo $subdomain | cut -d'.' -f1)"
        echo "    Base URL: $base_url"
        echo "    Callback URL: $callback_url"
        echo "    Logout URL: $logout_url"
        echo ""
    done
    
    echo "B2C Policies:"
    echo "  Sign Up/Sign In: $B2C_SIGNUP_SIGNIN_POLICY"
    echo "  Edit Profile: $B2C_EDIT_PROFILE_POLICY"
    echo "  Reset Password: $B2C_RESET_PASSWORD_POLICY"
    echo ""
    
    echo "Next Steps:"
    echo "1. Verify B2C redirect URLs are updated correctly"
    echo "2. Test authentication flows with custom domains"
    echo "3. Update frontend environment variables"
    echo "4. Update backend CORS configuration"
    echo "5. Test end-to-end authentication"
}

# Function to process single environment
process_environment() {
    local env="$1"
    
    print_header "PROCESSING $env ENVIRONMENT"
    
    # Check Azure access
    if ! check_azure_access; then
        return 1
    fi
    
    # Backup current configuration
    backup_b2c_config
    
    # Update redirect URLs
    if [ "$UPDATE" = true ]; then
        update_b2c_redirect_urls "$env"
    fi
    
    # Validate configuration
    if [ "$VALIDATE" = true ]; then
        validate_b2c_config "$env"
    fi
    
    # Test authentication flow
    if [ "$TEST" = true ]; then
        test_b2c_auth_flow "$env"
    fi
    
    # Restore configuration if requested
    restore_b2c_config
}

# Main function
main() {
    print_header "AZURE AD B2C REDIRECT URL MANAGEMENT"
    print_status "Environment: $ENVIRONMENT"
    print_status "Domain: $DOMAIN"
    print_status "Update: $UPDATE"
    print_status "Validate: $VALIDATE"
    print_status "Test: $TEST"
    print_status "Backup: $BACKUP"
    print_status "Restore: $RESTORE"
    print_status "Dry Run: $DRY_RUN"
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
    
    # Display configuration summary
    display_config_summary
    
    if [ "$DRY_RUN" = true ]; then
        print_header "DRY RUN COMPLETED - NO CHANGES MADE"
    else
        print_header "B2C REDIRECT URL CONFIGURATION COMPLETED! 🎉"
    fi
}

# Execute main function
main "$@"
