#!/bin/bash

# TaktMate Azure Static Web Apps Custom Domain Configuration Script
# Usage: ./configure-static-web-app-domains.sh [environment] [domain] [options]
# Example: ./configure-static-web-app-domains.sh production taktconnect.com --validate --ssl

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
    echo "TaktMate Azure Static Web Apps Custom Domain Configuration"
    echo ""
    echo "Usage: $0 [environment] [domain] [options]"
    echo ""
    echo "Environments:"
    echo "  production  - Production Static Web App domain configuration"
    echo "  staging     - Staging Static Web App domain configuration"
    echo "  development - Development Static Web App domain configuration"
    echo ""
    echo "Domains:"
    echo "  taktconnect.com - Primary domain for TaktMate application"
    echo "  taktmate.com    - Alternative domain (if available)"
    echo ""
    echo "Options:"
    echo "  --validate      Validate domain configuration before applying"
    echo "  --ssl           Configure SSL certificate (automatic renewal)"
    echo "  --force         Force domain configuration even if validation fails"
    echo "  --dry-run       Show what would be configured without executing"
    echo "  --verbose       Enable verbose output"
    echo "  --help          Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 production taktconnect.com --validate --ssl"
    echo "  $0 staging taktconnect.com --dry-run --verbose"
    echo "  $0 production taktconnect.com --force --ssl"
}

# Parse arguments
ENVIRONMENT=""
DOMAIN=""
VALIDATE=false
SSL=false
FORCE=false
DRY_RUN=false
VERBOSE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        production|staging|development)
            ENVIRONMENT="$1"
            shift
            ;;
        taktconnect.com|taktmate.com)
            DOMAIN="$1"
            shift
            ;;
        --validate)
            VALIDATE=true
            shift
            ;;
        --ssl)
            SSL=true
            shift
            ;;
        --force)
            FORCE=true
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
if [[ ! "$ENVIRONMENT" =~ ^(production|staging|development)$ ]]; then
    print_error "Environment must be specified: production, staging, or development"
    show_usage
    exit 1
fi

if [[ ! "$DOMAIN" =~ ^(taktconnect\.com|taktmate\.com)$ ]]; then
    print_error "Domain must be specified: taktconnect.com or taktmate.com"
    show_usage
    exit 1
fi

# Set environment-specific variables
case "$ENVIRONMENT" in
    "production")
        SUBDOMAIN="app"
        RESOURCE_GROUP="taktmate-prod-rg"
        STATIC_WEB_APP_NAME="taktmate-frontend-prod"
        CUSTOM_DOMAIN="${SUBDOMAIN}.${DOMAIN}"
        WWW_DOMAIN="www.${DOMAIN}"
        ;;
    "staging")
        SUBDOMAIN="staging"
        RESOURCE_GROUP="taktmate-staging-rg"
        STATIC_WEB_APP_NAME="taktmate-frontend-staging"
        CUSTOM_DOMAIN="${SUBDOMAIN}.${DOMAIN}"
        WWW_DOMAIN=""
        ;;
    "development")
        SUBDOMAIN="dev"
        RESOURCE_GROUP="taktmate-dev-rg"
        STATIC_WEB_APP_NAME="taktmate-frontend-dev"
        CUSTOM_DOMAIN="${SUBDOMAIN}.${DOMAIN}"
        WWW_DOMAIN=""
        ;;
esac

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

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

# Function to validate Static Web App exists
validate_static_web_app() {
    print_step "Validating Azure Static Web App"
    
    if [ "$DRY_RUN" = false ]; then
        # Check if Static Web App exists
        if az staticwebapp show --name "$STATIC_WEB_APP_NAME" --resource-group "$RESOURCE_GROUP" &>/dev/null; then
            print_success "Static Web App found: $STATIC_WEB_APP_NAME"
            
            # Get Static Web App details
            local swa_hostname=$(az staticwebapp show --name "$STATIC_WEB_APP_NAME" --resource-group "$RESOURCE_GROUP" --query "defaultHostname" -o tsv)
            local swa_state=$(az staticwebapp show --name "$STATIC_WEB_APP_NAME" --resource-group "$RESOURCE_GROUP" --query "state" -o tsv)
            
            if [ "$VERBOSE" = true ]; then
                print_status "Default hostname: $swa_hostname"
                print_status "State: $swa_state"
            fi
            
            if [ "$swa_state" != "Ready" ]; then
                print_warning "Static Web App state is '$swa_state', not 'Ready'"
                if [ "$FORCE" = false ]; then
                    print_error "Static Web App not ready. Use --force to proceed anyway"
                    return 1
                fi
            fi
        else
            print_error "Static Web App not found: $STATIC_WEB_APP_NAME"
            return 1
        fi
    else
        print_status "[DRY-RUN] Would validate Static Web App: $STATIC_WEB_APP_NAME"
    fi
    
    return 0
}

# Function to validate DNS configuration
validate_dns_configuration() {
    if [ "$VALIDATE" = false ]; then
        return 0
    fi
    
    print_step "Validating DNS configuration"
    
    local validation_failed=false
    
    if [ "$DRY_RUN" = false ]; then
        # Check if DNS resolves to expected target
        if command -v nslookup &>/dev/null; then
            if nslookup "$CUSTOM_DOMAIN" &>/dev/null; then
                local resolved_target=$(nslookup "$CUSTOM_DOMAIN" | grep -A1 "canonical name" | tail -1 | awk '{print $4}' | sed 's/\.$//' || echo "")
                local expected_target="${STATIC_WEB_APP_NAME}.azurestaticapps.net"
                
                if [ "$resolved_target" = "$expected_target" ]; then
                    print_success "DNS resolves correctly: $CUSTOM_DOMAIN → $resolved_target"
                else
                    print_warning "DNS target mismatch: expected $expected_target, got $resolved_target"
                    if [ "$FORCE" = false ]; then
                        validation_failed=true
                    fi
                fi
            else
                print_warning "DNS does not resolve: $CUSTOM_DOMAIN"
                if [ "$FORCE" = false ]; then
                    validation_failed=true
                fi
            fi
        else
            print_warning "nslookup not available - skipping DNS validation"
        fi
        
        # Check if domain responds to HTTP requests
        if command -v curl &>/dev/null; then
            local http_response=$(curl -s -o /dev/null -w "%{http_code}" "http://$CUSTOM_DOMAIN" --max-time 10 2>/dev/null || echo "000")
            if [ "$http_response" = "200" ] || [ "$http_response" = "301" ] || [ "$http_response" = "302" ]; then
                print_success "Domain responds to HTTP: $CUSTOM_DOMAIN (HTTP $http_response)"
            else
                print_warning "Domain HTTP response: $CUSTOM_DOMAIN (HTTP $http_response)"
            fi
        fi
    else
        print_status "[DRY-RUN] Would validate DNS configuration for: $CUSTOM_DOMAIN"
    fi
    
    if [ "$validation_failed" = true ]; then
        print_error "DNS validation failed. Use --force to proceed anyway"
        return 1
    fi
    
    return 0
}

# Function to configure custom domain in Static Web App
configure_custom_domain() {
    print_step "Configuring custom domain in Azure Static Web App"
    
    if [ "$DRY_RUN" = false ]; then
        # Check if custom domain already exists
        local existing_domains=$(az staticwebapp hostname list --name "$STATIC_WEB_APP_NAME" --resource-group "$RESOURCE_GROUP" --query "[].name" -o tsv 2>/dev/null || echo "")
        
        if echo "$existing_domains" | grep -q "^$CUSTOM_DOMAIN$"; then
            print_success "Custom domain already configured: $CUSTOM_DOMAIN"
            
            # Get domain details
            local domain_status=$(az staticwebapp hostname show --name "$STATIC_WEB_APP_NAME" --resource-group "$RESOURCE_GROUP" --hostname "$CUSTOM_DOMAIN" --query "status" -o tsv 2>/dev/null || echo "unknown")
            
            if [ "$VERBOSE" = true ]; then
                print_status "Domain status: $domain_status"
            fi
            
            if [ "$domain_status" = "Failed" ]; then
                print_warning "Domain configuration failed, attempting to reconfigure"
                
                # Remove failed domain configuration
                if az staticwebapp hostname delete --name "$STATIC_WEB_APP_NAME" --resource-group "$RESOURCE_GROUP" --hostname "$CUSTOM_DOMAIN" --yes &>/dev/null; then
                    print_status "Removed failed domain configuration"
                    sleep 10  # Wait for cleanup
                else
                    print_warning "Could not remove failed domain configuration"
                fi
            elif [ "$domain_status" = "Ready" ]; then
                print_success "Custom domain is ready: $CUSTOM_DOMAIN"
                return 0
            fi
        fi
        
        # Add custom domain
        print_status "Adding custom domain: $CUSTOM_DOMAIN"
        if az staticwebapp hostname set --name "$STATIC_WEB_APP_NAME" --resource-group "$RESOURCE_GROUP" --hostname "$CUSTOM_DOMAIN" &>/dev/null; then
            print_success "Custom domain added: $CUSTOM_DOMAIN"
            
            # Wait for domain validation
            print_status "Waiting for domain validation (this may take several minutes)..."
            local max_wait=300  # 5 minutes
            local wait_time=0
            local check_interval=30
            
            while [ $wait_time -lt $max_wait ]; do
                sleep $check_interval
                wait_time=$((wait_time + check_interval))
                
                local current_status=$(az staticwebapp hostname show --name "$STATIC_WEB_APP_NAME" --resource-group "$RESOURCE_GROUP" --hostname "$CUSTOM_DOMAIN" --query "status" -o tsv 2>/dev/null || echo "unknown")
                
                if [ "$current_status" = "Ready" ]; then
                    print_success "Domain validation completed: $CUSTOM_DOMAIN"
                    break
                elif [ "$current_status" = "Failed" ]; then
                    print_error "Domain validation failed: $CUSTOM_DOMAIN"
                    return 1
                else
                    print_status "Domain validation in progress... (status: $current_status, waited ${wait_time}s)"
                fi
            done
            
            if [ $wait_time -ge $max_wait ]; then
                print_warning "Domain validation timeout after ${max_wait}s. Check Azure portal for status."
            fi
        else
            print_error "Failed to add custom domain: $CUSTOM_DOMAIN"
            return 1
        fi
    else
        print_status "[DRY-RUN] Would configure custom domain: $CUSTOM_DOMAIN"
    fi
}

# Function to configure WWW domain (production only)
configure_www_domain() {
    if [ "$ENVIRONMENT" != "production" ] || [ -z "$WWW_DOMAIN" ]; then
        return 0
    fi
    
    print_step "Configuring WWW domain (production only)"
    
    if [ "$DRY_RUN" = false ]; then
        # Check if www domain already exists
        local existing_domains=$(az staticwebapp hostname list --name "$STATIC_WEB_APP_NAME" --resource-group "$RESOURCE_GROUP" --query "[].name" -o tsv 2>/dev/null || echo "")
        
        if echo "$existing_domains" | grep -q "^$WWW_DOMAIN$"; then
            print_success "WWW domain already configured: $WWW_DOMAIN"
        else
            # Add www domain
            print_status "Adding WWW domain: $WWW_DOMAIN"
            if az staticwebapp hostname set --name "$STATIC_WEB_APP_NAME" --resource-group "$RESOURCE_GROUP" --hostname "$WWW_DOMAIN" &>/dev/null; then
                print_success "WWW domain added: $WWW_DOMAIN"
                
                # Wait for www domain validation
                print_status "Waiting for WWW domain validation..."
                sleep 60  # Wait for validation to start
                
                local www_status=$(az staticwebapp hostname show --name "$STATIC_WEB_APP_NAME" --resource-group "$RESOURCE_GROUP" --hostname "$WWW_DOMAIN" --query "status" -o tsv 2>/dev/null || echo "unknown")
                
                if [ "$www_status" = "Ready" ]; then
                    print_success "WWW domain validation completed: $WWW_DOMAIN"
                else
                    print_warning "WWW domain validation status: $www_status"
                fi
            else
                print_warning "Failed to add WWW domain: $WWW_DOMAIN (this is optional)"
            fi
        fi
    else
        print_status "[DRY-RUN] Would configure WWW domain: $WWW_DOMAIN"
    fi
}

# Function to configure SSL certificates
configure_ssl_certificates() {
    if [ "$SSL" = false ]; then
        return 0
    fi
    
    print_step "Configuring SSL certificates"
    
    if [ "$DRY_RUN" = false ]; then
        # Azure Static Web Apps automatically provisions SSL certificates for custom domains
        # We just need to verify they are working
        
        print_status "Azure Static Web Apps automatically provisions SSL certificates"
        print_status "Verifying SSL certificate configuration..."
        
        # Wait a bit for SSL provisioning to complete
        sleep 30
        
        # Check SSL certificate for main domain
        if command -v openssl &>/dev/null; then
            local ssl_check=$(echo | openssl s_client -servername "$CUSTOM_DOMAIN" -connect "$CUSTOM_DOMAIN:443" 2>/dev/null | openssl x509 -noout -subject 2>/dev/null || echo "")
            if [ -n "$ssl_check" ]; then
                print_success "SSL certificate available for: $CUSTOM_DOMAIN"
                
                if [ "$VERBOSE" = true ]; then
                    local ssl_expiry=$(echo | openssl s_client -servername "$CUSTOM_DOMAIN" -connect "$CUSTOM_DOMAIN:443" 2>/dev/null | openssl x509 -noout -dates 2>/dev/null | grep "notAfter=" | cut -d'=' -f2)
                    print_status "SSL certificate expires: $ssl_expiry"
                fi
            else
                print_warning "SSL certificate not yet available for: $CUSTOM_DOMAIN"
                print_status "SSL certificates may take up to 24 hours to provision"
            fi
            
            # Check SSL certificate for WWW domain (if configured)
            if [ -n "$WWW_DOMAIN" ]; then
                local www_ssl_check=$(echo | openssl s_client -servername "$WWW_DOMAIN" -connect "$WWW_DOMAIN:443" 2>/dev/null | openssl x509 -noout -subject 2>/dev/null || echo "")
                if [ -n "$www_ssl_check" ]; then
                    print_success "SSL certificate available for: $WWW_DOMAIN"
                else
                    print_warning "SSL certificate not yet available for: $WWW_DOMAIN"
                fi
            fi
        else
            print_warning "openssl not available - cannot verify SSL certificates"
        fi
        
        # Verify HTTPS redirects
        if command -v curl &>/dev/null; then
            local https_response=$(curl -s -o /dev/null -w "%{http_code}" "https://$CUSTOM_DOMAIN" --max-time 15 2>/dev/null || echo "000")
            if [ "$https_response" = "200" ] || [ "$https_response" = "301" ] || [ "$https_response" = "302" ]; then
                print_success "HTTPS access working: $CUSTOM_DOMAIN (HTTPS $https_response)"
            else
                print_warning "HTTPS access issue: $CUSTOM_DOMAIN (HTTPS $https_response)"
            fi
        fi
    else
        print_status "[DRY-RUN] Would configure SSL certificates for: $CUSTOM_DOMAIN"
        if [ -n "$WWW_DOMAIN" ]; then
            print_status "[DRY-RUN] Would configure SSL certificates for: $WWW_DOMAIN"
        fi
    fi
}

# Function to verify domain configuration
verify_domain_configuration() {
    print_step "Verifying domain configuration"
    
    if [ "$DRY_RUN" = false ]; then
        # List all configured hostnames
        local configured_domains=$(az staticwebapp hostname list --name "$STATIC_WEB_APP_NAME" --resource-group "$RESOURCE_GROUP" --query "[].{name:name,status:status}" -o table 2>/dev/null || echo "")
        
        if [ -n "$configured_domains" ]; then
            print_success "Configured domains:"
            echo "$configured_domains"
        else
            print_warning "No custom domains configured"
        fi
        
        # Test HTTP and HTTPS access
        if command -v curl &>/dev/null; then
            print_status "Testing domain accessibility:"
            
            # Test main custom domain
            local http_test=$(curl -s -o /dev/null -w "%{http_code}" "http://$CUSTOM_DOMAIN" --max-time 10 2>/dev/null || echo "000")
            local https_test=$(curl -s -o /dev/null -w "%{http_code}" "https://$CUSTOM_DOMAIN" --max-time 10 2>/dev/null || echo "000")
            
            print_status "  $CUSTOM_DOMAIN - HTTP: $http_test, HTTPS: $https_test"
            
            # Test WWW domain (if configured)
            if [ -n "$WWW_DOMAIN" ]; then
                local www_http_test=$(curl -s -o /dev/null -w "%{http_code}" "http://$WWW_DOMAIN" --max-time 10 2>/dev/null || echo "000")
                local www_https_test=$(curl -s -o /dev/null -w "%{http_code}" "https://$WWW_DOMAIN" --max-time 10 2>/dev/null || echo "000")
                
                print_status "  $WWW_DOMAIN - HTTP: $www_http_test, HTTPS: $www_https_test"
            fi
        fi
    else
        print_status "[DRY-RUN] Would verify domain configuration for: $STATIC_WEB_APP_NAME"
    fi
}

# Function to display configuration summary
display_configuration_summary() {
    print_header "STATIC WEB APP DOMAIN CONFIGURATION SUMMARY"
    
    echo "Environment: $ENVIRONMENT"
    echo "Static Web App: $STATIC_WEB_APP_NAME"
    echo "Resource Group: $RESOURCE_GROUP"
    echo "Primary Domain: $CUSTOM_DOMAIN"
    if [ -n "$WWW_DOMAIN" ]; then
        echo "WWW Domain: $WWW_DOMAIN"
    fi
    echo "SSL Configuration: $SSL"
    echo ""
    
    if [ "$DRY_RUN" = false ]; then
        # Get default hostname for reference
        local default_hostname=$(az staticwebapp show --name "$STATIC_WEB_APP_NAME" --resource-group "$RESOURCE_GROUP" --query "defaultHostname" -o tsv 2>/dev/null || echo "unknown")
        echo "Default Azure Hostname: $default_hostname"
        echo ""
        
        echo "Domain Configuration Status:"
        az staticwebapp hostname list --name "$STATIC_WEB_APP_NAME" --resource-group "$RESOURCE_GROUP" --query "[].{Domain:name,Status:status,ValidationStatus:validationStatus}" -o table 2>/dev/null || echo "No custom domains configured"
        echo ""
    fi
    
    echo "Next Steps:"
    echo "1. Verify DNS propagation is complete"
    echo "2. Test domain accessibility (HTTP/HTTPS)"
    echo "3. Configure SSL certificates (if not already done)"
    echo "4. Update Azure AD B2C redirect URLs"
    echo "5. Configure CORS settings for custom domain"
    echo "6. Update frontend environment variables"
}

# Main function
main() {
    print_header "AZURE STATIC WEB APPS CUSTOM DOMAIN CONFIGURATION"
    print_status "Environment: $ENVIRONMENT"
    print_status "Domain: $DOMAIN"
    print_status "Custom Domain: $CUSTOM_DOMAIN"
    print_status "Static Web App: $STATIC_WEB_APP_NAME"
    print_status "SSL Configuration: $SSL"
    print_status "Dry Run: $DRY_RUN"
    echo ""
    
    # Execute configuration phases
    validate_static_web_app
    validate_dns_configuration
    configure_custom_domain
    configure_www_domain
    configure_ssl_certificates
    verify_domain_configuration
    display_configuration_summary
    
    if [ "$DRY_RUN" = true ]; then
        print_header "DRY RUN COMPLETED - NO CHANGES MADE"
    else
        print_header "STATIC WEB APP DOMAIN CONFIGURATION COMPLETED! 🎉"
    fi
}

# Execute main function
main "$@"
