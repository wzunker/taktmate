#!/bin/bash

# TaktMate SSL Certificate Management and Monitoring Script
# Usage: ./configure-ssl-certificates.sh [environment] [domain] [options]
# Example: ./configure-ssl-certificates.sh production taktconnect.com --monitor --alert

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
    echo "TaktMate SSL Certificate Management and Monitoring"
    echo ""
    echo "Usage: $0 [environment] [domain] [options]"
    echo ""
    echo "Environments:"
    echo "  production  - Production SSL certificate management"
    echo "  staging     - Staging SSL certificate management"
    echo "  development - Development SSL certificate management"
    echo "  all         - All environments"
    echo ""
    echo "Domains:"
    echo "  taktconnect.com - Primary domain for TaktMate application"
    echo "  taktmate.com    - Alternative domain (if available)"
    echo ""
    echo "Options:"
    echo "  --monitor       Monitor SSL certificate status and expiration"
    echo "  --alert         Send alerts for certificate issues (requires monitoring)"
    echo "  --validate      Validate SSL certificate configuration"
    echo "  --security      Perform SSL security analysis"
    echo "  --performance   Test SSL performance metrics"
    echo "  --report        Generate detailed SSL certificate report"
    echo "  --verbose       Enable verbose output"
    echo "  --help          Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 production taktconnect.com --monitor --alert"
    echo "  $0 all taktconnect.com --validate --security --report"
    echo "  $0 staging taktconnect.com --performance --verbose"
}

# Parse arguments
ENVIRONMENT=""
DOMAIN=""
MONITOR=false
ALERT=false
VALIDATE=false
SECURITY=false
PERFORMANCE=false
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
        --monitor)
            MONITOR=true
            shift
            ;;
        --alert)
            ALERT=true
            MONITOR=true  # Alert requires monitoring
            shift
            ;;
        --validate)
            VALIDATE=true
            shift
            ;;
        --security)
            SECURITY=true
            shift
            ;;
        --performance)
            PERFORMANCE=true
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
LOG_DIR="$SCRIPT_DIR/logs"

# Create directories if needed
if [ "$REPORT" = true ]; then
    mkdir -p "$REPORT_DIR"
fi
mkdir -p "$LOG_DIR"

# SSL certificate data
SSL_CERTIFICATES=()
SSL_RESULTS=()

# Function to get environment-specific configuration
get_environment_config() {
    local env="$1"
    
    case "$env" in
        "production")
            echo "app.${DOMAIN}:taktmate-frontend-prod:taktmate-prod-rg"
            if [ "$env" = "production" ]; then
                echo "www.${DOMAIN}:taktmate-frontend-prod:taktmate-prod-rg"
            fi
            ;;
        "staging")
            echo "staging.${DOMAIN}:taktmate-frontend-staging:taktmate-staging-rg"
            ;;
        "development")
            echo "dev.${DOMAIN}:taktmate-frontend-dev:taktmate-dev-rg"
            ;;
    esac
}

# Function to get all environments configuration
get_all_environments_config() {
    get_environment_config "production"
    get_environment_config "staging"
    get_environment_config "development"
}

# Function to check SSL certificate expiration
check_ssl_expiration() {
    local domain="$1"
    local hostname="$2"
    
    if ! command -v openssl &>/dev/null; then
        print_warning "openssl not available - cannot check SSL expiration for $hostname"
        return 1
    fi
    
    # Get certificate information
    local cert_info=$(echo | openssl s_client -servername "$hostname" -connect "$hostname:443" 2>/dev/null | openssl x509 -noout -dates 2>/dev/null || echo "")
    
    if [ -z "$cert_info" ]; then
        print_error "Could not retrieve SSL certificate for $hostname"
        return 1
    fi
    
    # Extract expiration date
    local expiry_date=$(echo "$cert_info" | grep "notAfter=" | cut -d'=' -f2)
    local issue_date=$(echo "$cert_info" | grep "notBefore=" | cut -d'=' -f2)
    
    if [ -z "$expiry_date" ]; then
        print_error "Could not parse SSL certificate expiration for $hostname"
        return 1
    fi
    
    # Calculate days until expiration
    local expiry_epoch
    local current_epoch=$(date +%s)
    
    # Try different date parsing methods for cross-platform compatibility
    if date -d "$expiry_date" +%s &>/dev/null; then
        # GNU date (Linux)
        expiry_epoch=$(date -d "$expiry_date" +%s)
    elif date -j -f "%b %d %T %Y %Z" "$expiry_date" +%s &>/dev/null; then
        # BSD date (macOS)
        expiry_epoch=$(date -j -f "%b %d %T %Y %Z" "$expiry_date" +%s)
    else
        print_warning "Could not parse expiration date format: $expiry_date"
        return 1
    fi
    
    local days_until_expiry=$(( (expiry_epoch - current_epoch) / 86400 ))
    
    # Store certificate information
    local cert_data="{
        \"hostname\": \"$hostname\",
        \"domain\": \"$domain\",
        \"issue_date\": \"$issue_date\",
        \"expiry_date\": \"$expiry_date\",
        \"days_until_expiry\": $days_until_expiry,
        \"status\": \"$([ $days_until_expiry -gt 30 ] && echo "healthy" || ([ $days_until_expiry -gt 7 ] && echo "warning" || echo "critical"))\",
        \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
    }"
    
    SSL_CERTIFICATES+=("$cert_data")
    
    # Print status
    if [ $days_until_expiry -gt 30 ]; then
        print_success "SSL certificate for $hostname expires in $days_until_expiry days"
    elif [ $days_until_expiry -gt 7 ]; then
        print_warning "SSL certificate for $hostname expires in $days_until_expiry days"
    else
        print_error "SSL certificate for $hostname expires in $days_until_expiry days - CRITICAL!"
    fi
    
    if [ "$VERBOSE" = true ]; then
        print_status "  Issue Date: $issue_date"
        print_status "  Expiry Date: $expiry_date"
    fi
    
    return 0
}

# Function to validate SSL certificate configuration
validate_ssl_certificate() {
    local domain="$1"
    local hostname="$2"
    
    if ! command -v openssl &>/dev/null; then
        print_warning "openssl not available - cannot validate SSL certificate for $hostname"
        return 1
    fi
    
    print_step "Validating SSL certificate for $hostname"
    
    # Test SSL connection
    local ssl_test=$(echo | openssl s_client -servername "$hostname" -connect "$hostname:443" -verify_return_error 2>/dev/null)
    local ssl_result=$?
    
    if [ $ssl_result -eq 0 ]; then
        print_success "SSL connection successful for $hostname"
    else
        print_error "SSL connection failed for $hostname"
        return 1
    fi
    
    # Get certificate details
    local cert_subject=$(echo "$ssl_test" | openssl x509 -noout -subject 2>/dev/null | sed 's/subject= *//')
    local cert_issuer=$(echo "$ssl_test" | openssl x509 -noout -issuer 2>/dev/null | sed 's/issuer= *//')
    local cert_serial=$(echo "$ssl_test" | openssl x509 -noout -serial 2>/dev/null | cut -d'=' -f2)
    
    if [ "$VERBOSE" = true ]; then
        print_status "  Subject: $cert_subject"
        print_status "  Issuer: $cert_issuer"
        print_status "  Serial: $cert_serial"
    fi
    
    # Validate certificate subject
    if [[ "$cert_subject" == *"$hostname"* ]]; then
        print_success "Certificate subject matches hostname: $hostname"
    else
        print_warning "Certificate subject may not match hostname: $hostname"
    fi
    
    # Validate certificate issuer (trusted CAs)
    if [[ "$cert_issuer" == *"Let's Encrypt"* ]] || [[ "$cert_issuer" == *"DigiCert"* ]] || [[ "$cert_issuer" == *"Microsoft"* ]]; then
        print_success "Certificate issued by trusted CA"
    else
        print_warning "Certificate issuer may not be a well-known CA: $cert_issuer"
    fi
    
    return 0
}

# Function to perform SSL security analysis
perform_ssl_security_analysis() {
    local domain="$1"
    local hostname="$2"
    
    if ! command -v openssl &>/dev/null; then
        print_warning "openssl not available - cannot perform SSL security analysis for $hostname"
        return 1
    fi
    
    print_step "Performing SSL security analysis for $hostname"
    
    # Test SSL protocols
    local protocols=("tls1" "tls1_1" "tls1_2" "tls1_3")
    local supported_protocols=()
    local deprecated_protocols=()
    
    for protocol in "${protocols[@]}"; do
        if echo | openssl s_client -$protocol -servername "$hostname" -connect "$hostname:443" 2>/dev/null | grep -q "Verify return code: 0"; then
            supported_protocols+=("$protocol")
            
            # Check for deprecated protocols
            if [[ "$protocol" == "tls1" ]] || [[ "$protocol" == "tls1_1" ]]; then
                deprecated_protocols+=("$protocol")
                print_warning "Deprecated SSL protocol supported: $protocol"
            else
                print_success "Modern SSL protocol supported: $protocol"
            fi
        fi
    done
    
    if [ ${#deprecated_protocols[@]} -eq 0 ]; then
        print_success "No deprecated SSL protocols supported"
    fi
    
    # Test cipher strength
    local cipher_info=$(echo | openssl s_client -servername "$hostname" -connect "$hostname:443" 2>/dev/null | grep "Cipher    :" | awk '{print $3}')
    if [ -n "$cipher_info" ]; then
        print_success "SSL cipher: $cipher_info"
        
        # Check for weak ciphers
        if [[ "$cipher_info" == *"RC4"* ]] || [[ "$cipher_info" == *"DES"* ]] || [[ "$cipher_info" == *"MD5"* ]]; then
            print_error "Weak SSL cipher detected: $cipher_info"
        fi
    fi
    
    # Test certificate chain
    local cert_chain=$(echo | openssl s_client -servername "$hostname" -connect "$hostname:443" -showcerts 2>/dev/null | grep -c "BEGIN CERTIFICATE")
    if [ "$cert_chain" -gt 1 ]; then
        print_success "Complete certificate chain provided ($cert_chain certificates)"
    else
        print_warning "Incomplete certificate chain ($cert_chain certificate)"
    fi
    
    return 0
}

# Function to test SSL performance
test_ssl_performance() {
    local domain="$1"
    local hostname="$2"
    
    if ! command -v curl &>/dev/null; then
        print_warning "curl not available - cannot test SSL performance for $hostname"
        return 1
    fi
    
    print_step "Testing SSL performance for $hostname"
    
    # Test SSL handshake time
    local ssl_handshake_time=$(curl -s -o /dev/null -w "%{time_connect}" "https://$hostname" --max-time 30 2>/dev/null || echo "0")
    local ssl_handshake_ms=$(echo "$ssl_handshake_time * 1000" | bc -l 2>/dev/null | cut -d'.' -f1 || echo "0")
    
    if [ "$ssl_handshake_ms" -lt 500 ]; then
        print_success "SSL handshake time: ${ssl_handshake_ms}ms (excellent)"
    elif [ "$ssl_handshake_ms" -lt 1000 ]; then
        print_success "SSL handshake time: ${ssl_handshake_ms}ms (good)"
    elif [ "$ssl_handshake_ms" -lt 2000 ]; then
        print_warning "SSL handshake time: ${ssl_handshake_ms}ms (acceptable)"
    else
        print_error "SSL handshake time: ${ssl_handshake_ms}ms (slow)"
    fi
    
    # Test DNS resolution time
    local dns_time=$(curl -s -o /dev/null -w "%{time_namelookup}" "https://$hostname" --max-time 30 2>/dev/null || echo "0")
    local dns_time_ms=$(echo "$dns_time * 1000" | bc -l 2>/dev/null | cut -d'.' -f1 || echo "0")
    
    if [ "$dns_time_ms" -lt 100 ]; then
        print_success "DNS resolution time: ${dns_time_ms}ms (excellent)"
    elif [ "$dns_time_ms" -lt 500 ]; then
        print_success "DNS resolution time: ${dns_time_ms}ms (good)"
    else
        print_warning "DNS resolution time: ${dns_time_ms}ms (slow)"
    fi
    
    # Test total connection time
    local total_time=$(curl -s -o /dev/null -w "%{time_total}" "https://$hostname" --max-time 30 2>/dev/null || echo "0")
    local total_time_ms=$(echo "$total_time * 1000" | bc -l 2>/dev/null | cut -d'.' -f1 || echo "0")
    
    if [ "$total_time_ms" -lt 1000 ]; then
        print_success "Total response time: ${total_time_ms}ms (excellent)"
    elif [ "$total_time_ms" -lt 2000 ]; then
        print_success "Total response time: ${total_time_ms}ms (good)"
    elif [ "$total_time_ms" -lt 5000 ]; then
        print_warning "Total response time: ${total_time_ms}ms (acceptable)"
    else
        print_error "Total response time: ${total_time_ms}ms (slow)"
    fi
    
    return 0
}

# Function to check Azure Static Web App SSL status
check_azure_ssl_status() {
    local domain="$1"
    local hostname="$2"
    local swa_name="$3"
    local resource_group="$4"
    
    print_step "Checking Azure Static Web App SSL status for $hostname"
    
    # Check if custom domain exists in Static Web App
    if az staticwebapp hostname show --name "$swa_name" --resource-group "$resource_group" --hostname "$hostname" &>/dev/null; then
        local domain_status=$(az staticwebapp hostname show --name "$swa_name" --resource-group "$resource_group" --hostname "$hostname" --query "status" -o tsv 2>/dev/null || echo "unknown")
        local ssl_state=$(az staticwebapp hostname show --name "$swa_name" --resource-group "$resource_group" --hostname "$hostname" --query "sslState" -o tsv 2>/dev/null || echo "unknown")
        local validation_status=$(az staticwebapp hostname show --name "$swa_name" --resource-group "$resource_group" --hostname "$hostname" --query "validationStatus" -o tsv 2>/dev/null || echo "unknown")
        
        if [ "$domain_status" = "Ready" ]; then
            print_success "Domain status: $domain_status"
        else
            print_warning "Domain status: $domain_status"
        fi
        
        if [ "$ssl_state" = "Ready" ]; then
            print_success "SSL state: $ssl_state"
        else
            print_warning "SSL state: $ssl_state"
        fi
        
        if [ "$validation_status" = "Succeeded" ]; then
            print_success "Validation status: $validation_status"
        else
            print_warning "Validation status: $validation_status"
        fi
        
        if [ "$VERBOSE" = true ]; then
            print_status "  Domain: $hostname"
            print_status "  Static Web App: $swa_name"
            print_status "  Resource Group: $resource_group"
        fi
    else
        print_error "Custom domain not found in Static Web App: $hostname"
        return 1
    fi
    
    return 0
}

# Function to send alerts for certificate issues
send_certificate_alerts() {
    local critical_certs=()
    local warning_certs=()
    
    # Parse certificate data for alerts
    for cert_data in "${SSL_CERTIFICATES[@]}"; do
        local hostname=$(echo "$cert_data" | jq -r '.hostname' 2>/dev/null || echo "unknown")
        local days_until_expiry=$(echo "$cert_data" | jq -r '.days_until_expiry' 2>/dev/null || echo "0")
        local status=$(echo "$cert_data" | jq -r '.status' 2>/dev/null || echo "unknown")
        
        if [ "$status" = "critical" ]; then
            critical_certs+=("$hostname ($days_until_expiry days)")
        elif [ "$status" = "warning" ]; then
            warning_certs+=("$hostname ($days_until_expiry days)")
        fi
    done
    
    # Generate alerts
    local alert_message=""
    local alert_level="info"
    
    if [ ${#critical_certs[@]} -gt 0 ]; then
        alert_level="critical"
        alert_message="CRITICAL: SSL certificates expiring soon:\n"
        for cert in "${critical_certs[@]}"; do
            alert_message="${alert_message}  - $cert\n"
        done
    fi
    
    if [ ${#warning_certs[@]} -gt 0 ]; then
        if [ "$alert_level" != "critical" ]; then
            alert_level="warning"
        fi
        alert_message="${alert_message}WARNING: SSL certificates expiring within 30 days:\n"
        for cert in "${warning_certs[@]}"; do
            alert_message="${alert_message}  - $cert\n"
        done
    fi
    
    if [ -n "$alert_message" ]; then
        print_header "SSL CERTIFICATE ALERTS"
        echo -e "$alert_message"
        
        # Log alert
        local log_file="$LOG_DIR/ssl-alerts-$(date +%Y%m%d).log"
        echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) [$alert_level] $alert_message" >> "$log_file"
        
        # In a real implementation, you would send these alerts via:
        # - Email (using sendmail, AWS SES, etc.)
        # - Slack webhook
        # - Microsoft Teams webhook
        # - SMS (using Twilio, AWS SNS, etc.)
        # - PagerDuty API
        # - Custom monitoring system API
        
        print_status "Alert logged to: $log_file"
        print_status "Configure notification integrations for automated alerts"
    else
        print_success "No SSL certificate alerts - all certificates are healthy"
    fi
}

# Function to generate SSL certificate report
generate_ssl_report() {
    if [ "$REPORT" = false ]; then
        return 0
    fi
    
    print_step "Generating SSL certificate report"
    
    local report_file="$REPORT_DIR/ssl-certificate-report-${ENVIRONMENT}-${DOMAIN}-$(date +%Y%m%d-%H%M%S).json"
    
    # Count certificate statuses
    local healthy_count=0
    local warning_count=0
    local critical_count=0
    
    for cert_data in "${SSL_CERTIFICATES[@]}"; do
        local status=$(echo "$cert_data" | jq -r '.status' 2>/dev/null || echo "unknown")
        case "$status" in
            "healthy") healthy_count=$((healthy_count + 1)) ;;
            "warning") warning_count=$((warning_count + 1)) ;;
            "critical") critical_count=$((critical_count + 1)) ;;
        esac
    done
    
    local report_data="{
        \"environment\": \"$ENVIRONMENT\",
        \"domain\": \"$DOMAIN\",
        \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
        \"summary\": {
            \"total_certificates\": ${#SSL_CERTIFICATES[@]},
            \"healthy\": $healthy_count,
            \"warning\": $warning_count,
            \"critical\": $critical_count
        },
        \"certificates\": [$(IFS=,; echo "${SSL_CERTIFICATES[*]}")]
    }"
    
    echo "$report_data" | jq '.' > "$report_file" 2>/dev/null || echo "$report_data" > "$report_file"
    print_success "SSL certificate report generated: $report_file"
}

# Function to process single environment
process_environment() {
    local env="$1"
    
    print_header "SSL CERTIFICATE MANAGEMENT - $env ENVIRONMENT"
    
    local config_lines
    if [ "$env" = "all" ]; then
        config_lines=($(get_all_environments_config))
    else
        config_lines=($(get_environment_config "$env"))
    fi
    
    for config_line in "${config_lines[@]}"; do
        IFS=':' read -r hostname swa_name resource_group <<< "$config_line"
        
        print_status "Processing: $hostname"
        
        # Check Azure SSL status
        if [ "$VALIDATE" = true ]; then
            check_azure_ssl_status "$DOMAIN" "$hostname" "$swa_name" "$resource_group"
        fi
        
        # Monitor SSL certificate
        if [ "$MONITOR" = true ]; then
            check_ssl_expiration "$DOMAIN" "$hostname"
        fi
        
        # Validate SSL certificate
        if [ "$VALIDATE" = true ]; then
            validate_ssl_certificate "$DOMAIN" "$hostname"
        fi
        
        # Perform security analysis
        if [ "$SECURITY" = true ]; then
            perform_ssl_security_analysis "$DOMAIN" "$hostname"
        fi
        
        # Test SSL performance
        if [ "$PERFORMANCE" = true ]; then
            test_ssl_performance "$DOMAIN" "$hostname"
        fi
        
        echo ""
    done
}

# Main function
main() {
    print_header "TAKTMATE SSL CERTIFICATE MANAGEMENT"
    print_status "Environment: $ENVIRONMENT"
    print_status "Domain: $DOMAIN"
    print_status "Monitor: $MONITOR"
    print_status "Alert: $ALERT"
    print_status "Validate: $VALIDATE"
    print_status "Security: $SECURITY"
    print_status "Performance: $PERFORMANCE"
    print_status "Report: $REPORT"
    echo ""
    
    # Process environments
    if [ "$ENVIRONMENT" = "all" ]; then
        for env in production staging development; do
            process_environment "$env"
        done
    else
        process_environment "$ENVIRONMENT"
    fi
    
    # Send alerts if enabled
    if [ "$ALERT" = true ]; then
        send_certificate_alerts
    fi
    
    # Generate report if enabled
    generate_ssl_report
    
    print_header "SSL CERTIFICATE MANAGEMENT COMPLETED! 🎉"
    
    if [ ${#SSL_CERTIFICATES[@]} -gt 0 ]; then
        local healthy_count=0
        local warning_count=0
        local critical_count=0
        
        for cert_data in "${SSL_CERTIFICATES[@]}"; do
            local status=$(echo "$cert_data" | jq -r '.status' 2>/dev/null || echo "unknown")
            case "$status" in
                "healthy") healthy_count=$((healthy_count + 1)) ;;
                "warning") warning_count=$((warning_count + 1)) ;;
                "critical") critical_count=$((critical_count + 1)) ;;
            esac
        done
        
        echo "Certificate Summary:"
        echo "  Total: ${#SSL_CERTIFICATES[@]}"
        echo "  Healthy: $healthy_count"
        echo "  Warning: $warning_count"
        echo "  Critical: $critical_count"
        
        if [ $critical_count -gt 0 ]; then
            print_error "CRITICAL SSL certificates found - immediate action required!"
            exit 1
        elif [ $warning_count -gt 0 ]; then
            print_warning "SSL certificates expiring soon - plan renewal"
            exit 0
        else
            print_success "All SSL certificates are healthy"
            exit 0
        fi
    fi
}

# Execute main function
main "$@"
