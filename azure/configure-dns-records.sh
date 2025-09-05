#!/bin/bash

# TaktMate DNS Records Configuration Script
# Usage: ./configure-dns-records.sh [environment] [domain] [options]
# Example: ./configure-dns-records.sh production taktconnect.com --validate --backup

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
    echo "TaktMate DNS Records Configuration"
    echo ""
    echo "Usage: $0 [environment] [domain] [options]"
    echo ""
    echo "Environments:"
    echo "  production  - Production DNS configuration (app.taktconnect.com)"
    echo "  staging     - Staging DNS configuration (staging.taktconnect.com)"
    echo "  development - Development DNS configuration (dev.taktconnect.com)"
    echo ""
    echo "Domains:"
    echo "  taktconnect.com - Primary domain for TaktMate application"
    echo "  taktmate.com    - Alternative domain (if available)"
    echo ""
    echo "Options:"
    echo "  --validate      Validate DNS configuration before applying changes"
    echo "  --backup        Backup existing DNS records before making changes"
    echo "  --force         Force DNS updates even if validation fails"
    echo "  --dry-run       Show what would be configured without executing"
    echo "  --verbose       Enable verbose output"
    echo "  --help          Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 production taktconnect.com --validate --backup"
    echo "  $0 staging taktconnect.com --dry-run --verbose"
    echo "  $0 production taktconnect.com --force"
}

# Parse arguments
ENVIRONMENT=""
DOMAIN=""
VALIDATE=false
BACKUP=false
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
        --backup)
            BACKUP=true
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
        APP_SERVICE_NAME="taktmate-api-prod"
        FRONTEND_FULL_DOMAIN="${SUBDOMAIN}.${DOMAIN}"
        BACKEND_FULL_DOMAIN="api.${DOMAIN}"
        DNS_ZONE_NAME="$DOMAIN"
        ;;
    "staging")
        SUBDOMAIN="staging"
        RESOURCE_GROUP="taktmate-staging-rg"
        STATIC_WEB_APP_NAME="taktmate-frontend-staging"
        APP_SERVICE_NAME="taktmate-api-staging"
        FRONTEND_FULL_DOMAIN="${SUBDOMAIN}.${DOMAIN}"
        BACKEND_FULL_DOMAIN="api-staging.${DOMAIN}"
        DNS_ZONE_NAME="$DOMAIN"
        ;;
    "development")
        SUBDOMAIN="dev"
        RESOURCE_GROUP="taktmate-dev-rg"
        STATIC_WEB_APP_NAME="taktmate-frontend-dev"
        APP_SERVICE_NAME="taktmate-api-dev"
        FRONTEND_FULL_DOMAIN="${SUBDOMAIN}.${DOMAIN}"
        BACKEND_FULL_DOMAIN="api-dev.${DOMAIN}"
        DNS_ZONE_NAME="$DOMAIN"
        ;;
esac

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="$SCRIPT_DIR/dns-backups"

# Create backup directory if needed
if [ "$BACKUP" = true ]; then
    mkdir -p "$BACKUP_DIR"
fi

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

# Function to backup existing DNS records
backup_dns_records() {
    if [ "$BACKUP" = false ]; then
        return 0
    fi
    
    print_step "Backing up existing DNS records"
    
    local backup_timestamp=$(date +%Y%m%d-%H%M%S)
    local backup_file="$BACKUP_DIR/dns-backup-${DOMAIN}-${backup_timestamp}.json"
    
    if [ "$DRY_RUN" = false ]; then
        # Check if DNS zone exists
        if az network dns zone show --name "$DNS_ZONE_NAME" --resource-group "$RESOURCE_GROUP" &>/dev/null; then
            # Backup all DNS records
            if az network dns record-set list --zone-name "$DNS_ZONE_NAME" --resource-group "$RESOURCE_GROUP" --output json > "$backup_file"; then
                print_success "DNS records backed up to: $backup_file"
            else
                print_warning "Failed to backup DNS records"
            fi
        else
            print_status "DNS zone does not exist yet - no backup needed"
        fi
    else
        print_status "[DRY-RUN] Would backup DNS records to: $backup_file"
    fi
}

# Function to create DNS zone if it doesn't exist
create_dns_zone() {
    print_step "Creating DNS zone if needed"
    
    if [ "$DRY_RUN" = false ]; then
        # Check if DNS zone already exists
        if az network dns zone show --name "$DNS_ZONE_NAME" --resource-group "$RESOURCE_GROUP" &>/dev/null; then
            print_success "DNS zone already exists: $DNS_ZONE_NAME"
        else
            # Create DNS zone
            if az network dns zone create \
                --name "$DNS_ZONE_NAME" \
                --resource-group "$RESOURCE_GROUP" \
                --tags environment="$ENVIRONMENT" purpose="taktmate-dns" &>/dev/null; then
                print_success "DNS zone created: $DNS_ZONE_NAME"
                
                # Get name servers
                local name_servers=$(az network dns zone show --name "$DNS_ZONE_NAME" --resource-group "$RESOURCE_GROUP" --query "nameServers" -o tsv | tr '\n' ' ')
                print_status "Name servers for domain registrar configuration:"
                echo "$name_servers" | tr ' ' '\n' | while read -r ns; do
                    [ -n "$ns" ] && echo "  - $ns"
                done
            else
                print_error "Failed to create DNS zone: $DNS_ZONE_NAME"
                return 1
            fi
        fi
    else
        print_status "[DRY-RUN] Would create DNS zone: $DNS_ZONE_NAME"
    fi
}

# Function to get Azure Static Web App default hostname
get_static_web_app_hostname() {
    local hostname=""
    
    if [ "$DRY_RUN" = false ]; then
        # Get the default hostname from Static Web App
        hostname=$(az staticwebapp show --name "$STATIC_WEB_APP_NAME" --resource-group "$RESOURCE_GROUP" --query "defaultHostname" -o tsv 2>/dev/null || echo "")
        
        if [ -n "$hostname" ]; then
            echo "$hostname"
        else
            # Fallback to constructed hostname
            echo "${STATIC_WEB_APP_NAME}.azurestaticapps.net"
        fi
    else
        echo "${STATIC_WEB_APP_NAME}.azurestaticapps.net"
    fi
}

# Function to get App Service hostname
get_app_service_hostname() {
    local hostname=""
    
    if [ "$DRY_RUN" = false ]; then
        # Get the default hostname from App Service
        hostname=$(az webapp show --name "$APP_SERVICE_NAME" --resource-group "$RESOURCE_GROUP" --query "defaultHostName" -o tsv 2>/dev/null || echo "")
        
        if [ -n "$hostname" ]; then
            echo "$hostname"
        else
            # Fallback to constructed hostname
            echo "${APP_SERVICE_NAME}.azurewebsites.net"
        fi
    else
        echo "${APP_SERVICE_NAME}.azurewebsites.net"
    fi
}

# Function to configure frontend DNS records (CNAME for Static Web App)
configure_frontend_dns() {
    print_step "Configuring frontend DNS records"
    
    local static_web_app_hostname=$(get_static_web_app_hostname)
    
    if [ "$DRY_RUN" = false ]; then
        # Remove existing CNAME record if it exists
        if az network dns record-set cname show --name "$SUBDOMAIN" --zone-name "$DNS_ZONE_NAME" --resource-group "$RESOURCE_GROUP" &>/dev/null; then
            print_status "Removing existing CNAME record for $SUBDOMAIN"
            az network dns record-set cname delete --name "$SUBDOMAIN" --zone-name "$DNS_ZONE_NAME" --resource-group "$RESOURCE_GROUP" --yes &>/dev/null || true
        fi
        
        # Create CNAME record for frontend
        if az network dns record-set cname create \
            --name "$SUBDOMAIN" \
            --zone-name "$DNS_ZONE_NAME" \
            --resource-group "$RESOURCE_GROUP" \
            --ttl 300 &>/dev/null; then
            
            if az network dns record-set cname set-record \
                --record-set-name "$SUBDOMAIN" \
                --zone-name "$DNS_ZONE_NAME" \
                --resource-group "$RESOURCE_GROUP" \
                --cname "$static_web_app_hostname" &>/dev/null; then
                print_success "Frontend CNAME record created: $FRONTEND_FULL_DOMAIN → $static_web_app_hostname"
            else
                print_error "Failed to set CNAME record value"
                return 1
            fi
        else
            print_error "Failed to create CNAME record for frontend"
            return 1
        fi
    else
        print_status "[DRY-RUN] Would create CNAME record: $FRONTEND_FULL_DOMAIN → $static_web_app_hostname"
    fi
}

# Function to configure backend DNS records (CNAME for App Service)
configure_backend_dns() {
    print_step "Configuring backend API DNS records"
    
    local app_service_hostname=$(get_app_service_hostname)
    local backend_subdomain=""
    
    # Determine backend subdomain based on environment
    case "$ENVIRONMENT" in
        "production")
            backend_subdomain="api"
            ;;
        "staging")
            backend_subdomain="api-staging"
            ;;
        "development")
            backend_subdomain="api-dev"
            ;;
    esac
    
    if [ "$DRY_RUN" = false ]; then
        # Remove existing CNAME record if it exists
        if az network dns record-set cname show --name "$backend_subdomain" --zone-name "$DNS_ZONE_NAME" --resource-group "$RESOURCE_GROUP" &>/dev/null; then
            print_status "Removing existing CNAME record for $backend_subdomain"
            az network dns record-set cname delete --name "$backend_subdomain" --zone-name "$DNS_ZONE_NAME" --resource-group "$RESOURCE_GROUP" --yes &>/dev/null || true
        fi
        
        # Create CNAME record for backend
        if az network dns record-set cname create \
            --name "$backend_subdomain" \
            --zone-name "$DNS_ZONE_NAME" \
            --resource-group "$RESOURCE_GROUP" \
            --ttl 300 &>/dev/null; then
            
            if az network dns record-set cname set-record \
                --record-set-name "$backend_subdomain" \
                --zone-name "$DNS_ZONE_NAME" \
                --resource-group "$RESOURCE_GROUP" \
                --cname "$app_service_hostname" &>/dev/null; then
                print_success "Backend CNAME record created: $BACKEND_FULL_DOMAIN → $app_service_hostname"
            else
                print_error "Failed to set CNAME record value"
                return 1
            fi
        else
            print_error "Failed to create CNAME record for backend"
            return 1
        fi
    else
        print_status "[DRY-RUN] Would create CNAME record: $BACKEND_FULL_DOMAIN → $app_service_hostname"
    fi
}

# Function to configure additional DNS records
configure_additional_dns_records() {
    print_step "Configuring additional DNS records"
    
    if [ "$ENVIRONMENT" = "production" ]; then
        # Create www redirect record (optional)
        if [ "$DRY_RUN" = false ]; then
            local static_web_app_hostname=$(get_static_web_app_hostname)
            
            # Remove existing www CNAME if it exists
            if az network dns record-set cname show --name "www" --zone-name "$DNS_ZONE_NAME" --resource-group "$RESOURCE_GROUP" &>/dev/null; then
                print_status "Removing existing www CNAME record"
                az network dns record-set cname delete --name "www" --zone-name "$DNS_ZONE_NAME" --resource-group "$RESOURCE_GROUP" --yes &>/dev/null || true
            fi
            
            # Create www CNAME record
            if az network dns record-set cname create \
                --name "www" \
                --zone-name "$DNS_ZONE_NAME" \
                --resource-group "$RESOURCE_GROUP" \
                --ttl 300 &>/dev/null; then
                
                if az network dns record-set cname set-record \
                    --record-set-name "www" \
                    --zone-name "$DNS_ZONE_NAME" \
                    --resource-group "$RESOURCE_GROUP" \
                    --cname "$static_web_app_hostname" &>/dev/null; then
                    print_success "WWW CNAME record created: www.$DOMAIN → $static_web_app_hostname"
                else
                    print_warning "Failed to set www CNAME record value"
                fi
            else
                print_warning "Failed to create www CNAME record"
            fi
        else
            print_status "[DRY-RUN] Would create www CNAME record: www.$DOMAIN"
        fi
        
        # Create TXT record for domain verification (if needed)
        if [ "$DRY_RUN" = false ]; then
            # This would be used for domain verification with various services
            local verification_txt="taktmate-domain-verification-$(date +%s)"
            
            print_status "Domain verification TXT record would be: $verification_txt"
            print_status "Add this manually if required by domain verification services"
        else
            print_status "[DRY-RUN] Would prepare domain verification TXT record"
        fi
    fi
}

# Function to validate DNS configuration
validate_dns_configuration() {
    if [ "$VALIDATE" = false ]; then
        return 0
    fi
    
    print_header "VALIDATING DNS CONFIGURATION"
    
    local validation_failed=false
    
    # Check if DNS zone exists
    if [ "$DRY_RUN" = false ]; then
        if az network dns zone show --name "$DNS_ZONE_NAME" --resource-group "$RESOURCE_GROUP" &>/dev/null; then
            print_success "DNS zone exists: $DNS_ZONE_NAME"
        else
            print_error "DNS zone does not exist: $DNS_ZONE_NAME"
            validation_failed=true
        fi
        
        # Check frontend CNAME record
        if az network dns record-set cname show --name "$SUBDOMAIN" --zone-name "$DNS_ZONE_NAME" --resource-group "$RESOURCE_GROUP" &>/dev/null; then
            local cname_target=$(az network dns record-set cname show --name "$SUBDOMAIN" --zone-name "$DNS_ZONE_NAME" --resource-group "$RESOURCE_GROUP" --query "cname" -o tsv)
            print_success "Frontend CNAME record exists: $FRONTEND_FULL_DOMAIN → $cname_target"
        else
            print_error "Frontend CNAME record does not exist: $FRONTEND_FULL_DOMAIN"
            validation_failed=true
        fi
        
        # Check backend CNAME record
        local backend_subdomain=""
        case "$ENVIRONMENT" in
            "production") backend_subdomain="api" ;;
            "staging") backend_subdomain="api-staging" ;;
            "development") backend_subdomain="api-dev" ;;
        esac
        
        if az network dns record-set cname show --name "$backend_subdomain" --zone-name "$DNS_ZONE_NAME" --resource-group "$RESOURCE_GROUP" &>/dev/null; then
            local backend_cname_target=$(az network dns record-set cname show --name "$backend_subdomain" --zone-name "$DNS_ZONE_NAME" --resource-group "$RESOURCE_GROUP" --query "cname" -o tsv)
            print_success "Backend CNAME record exists: $BACKEND_FULL_DOMAIN → $backend_cname_target"
        else
            print_error "Backend CNAME record does not exist: $BACKEND_FULL_DOMAIN"
            validation_failed=true
        fi
        
        # Validate DNS propagation (basic check)
        if command -v nslookup &>/dev/null; then
            print_step "Checking DNS propagation"
            
            # Check frontend DNS resolution
            if nslookup "$FRONTEND_FULL_DOMAIN" &>/dev/null; then
                print_success "Frontend DNS resolves: $FRONTEND_FULL_DOMAIN"
            else
                print_warning "Frontend DNS not yet propagated: $FRONTEND_FULL_DOMAIN"
            fi
            
            # Check backend DNS resolution
            if nslookup "$BACKEND_FULL_DOMAIN" &>/dev/null; then
                print_success "Backend DNS resolves: $BACKEND_FULL_DOMAIN"
            else
                print_warning "Backend DNS not yet propagated: $BACKEND_FULL_DOMAIN"
            fi
        else
            print_warning "nslookup not available - skipping DNS propagation check"
        fi
    else
        print_status "[DRY-RUN] Would validate DNS configuration"
    fi
    
    if [ "$validation_failed" = true ]; then
        if [ "$FORCE" = false ]; then
            print_error "DNS validation failed. Use --force to proceed anyway"
            return 1
        else
            print_warning "DNS validation failed but continuing due to --force flag"
        fi
    else
        print_success "DNS configuration validation passed"
    fi
    
    return 0
}

# Function to display DNS configuration summary
display_dns_summary() {
    print_header "DNS CONFIGURATION SUMMARY"
    
    echo "Environment: $ENVIRONMENT"
    echo "Domain: $DOMAIN"
    echo "DNS Zone: $DNS_ZONE_NAME"
    echo ""
    echo "Frontend Configuration:"
    echo "  Domain: $FRONTEND_FULL_DOMAIN"
    echo "  Target: $(get_static_web_app_hostname)"
    echo "  Record Type: CNAME"
    echo ""
    echo "Backend Configuration:"
    echo "  Domain: $BACKEND_FULL_DOMAIN"
    echo "  Target: $(get_app_service_hostname)"
    echo "  Record Type: CNAME"
    echo ""
    
    if [ "$ENVIRONMENT" = "production" ]; then
        echo "Additional Records:"
        echo "  www.$DOMAIN → $(get_static_web_app_hostname)"
        echo ""
    fi
    
    if [ "$DRY_RUN" = false ]; then
        # Get name servers
        if az network dns zone show --name "$DNS_ZONE_NAME" --resource-group "$RESOURCE_GROUP" &>/dev/null; then
            echo "Name Servers (configure at domain registrar):"
            az network dns zone show --name "$DNS_ZONE_NAME" --resource-group "$RESOURCE_GROUP" --query "nameServers" -o tsv | while read -r ns; do
                [ -n "$ns" ] && echo "  - $ns"
            done
            echo ""
        fi
    fi
    
    echo "Next Steps:"
    echo "1. Configure name servers at your domain registrar"
    echo "2. Wait for DNS propagation (up to 48 hours)"
    echo "3. Configure custom domains in Azure Static Web Apps and App Service"
    echo "4. Set up SSL certificates"
    echo "5. Update Azure AD B2C redirect URLs"
}

# Main function
main() {
    print_header "TAKTMATE DNS RECORDS CONFIGURATION"
    print_status "Environment: $ENVIRONMENT"
    print_status "Domain: $DOMAIN"
    print_status "Frontend: $FRONTEND_FULL_DOMAIN"
    print_status "Backend: $BACKEND_FULL_DOMAIN"
    print_status "Dry Run: $DRY_RUN"
    echo ""
    
    # Execute configuration phases
    backup_dns_records
    create_dns_zone
    configure_frontend_dns
    configure_backend_dns
    configure_additional_dns_records
    validate_dns_configuration
    display_dns_summary
    
    if [ "$DRY_RUN" = true ]; then
        print_header "DRY RUN COMPLETED - NO CHANGES MADE"
    else
        print_header "DNS CONFIGURATION COMPLETED! 🎉"
    fi
}

# Execute main function
main "$@"
