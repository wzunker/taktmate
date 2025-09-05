#!/bin/bash

# TaktMate Azure Static Web Apps Custom Domain Testing Script
# Usage: ./test-static-web-app-domains.sh [environment] [domain] [options]
# Example: ./test-static-web-app-domains.sh production taktconnect.com --comprehensive --ssl --report

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
    echo "TaktMate Azure Static Web Apps Custom Domain Testing"
    echo ""
    echo "Usage: $0 [environment] [domain] [options]"
    echo ""
    echo "Environments:"
    echo "  production  - Test production Static Web App domains"
    echo "  staging     - Test staging Static Web App domains"
    echo "  development - Test development Static Web App domains"
    echo ""
    echo "Domains:"
    echo "  taktconnect.com - Primary domain for TaktMate application"
    echo "  taktmate.com    - Alternative domain (if available)"
    echo ""
    echo "Options:"
    echo "  --comprehensive     Run comprehensive domain tests including SSL and performance"
    echo "  --ssl               Test SSL certificate configuration and security"
    echo "  --performance       Test domain performance and response times"
    echo "  --security          Test security headers and configurations"
    echo "  --report            Generate detailed test report"
    echo "  --verbose           Enable verbose output"
    echo "  --help              Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 production taktconnect.com --comprehensive --report"
    echo "  $0 staging taktconnect.com --ssl --performance"
    echo "  $0 production taktconnect.com --security --verbose"
}

# Parse arguments
ENVIRONMENT=""
DOMAIN=""
COMPREHENSIVE=false
SSL=false
PERFORMANCE=false
SECURITY=false
REPORT=false
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
        --comprehensive)
            COMPREHENSIVE=true
            SSL=true
            PERFORMANCE=true
            SECURITY=true
            shift
            ;;
        --ssl)
            SSL=true
            shift
            ;;
        --performance)
            PERFORMANCE=true
            shift
            ;;
        --security)
            SECURITY=true
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
REPORT_DIR="$SCRIPT_DIR/reports"

# Create reports directory if needed
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

# Function to test Static Web App configuration
test_static_web_app_config() {
    print_step "Testing Azure Static Web App configuration"
    
    # Check if Static Web App exists
    if az staticwebapp show --name "$STATIC_WEB_APP_NAME" --resource-group "$RESOURCE_GROUP" &>/dev/null; then
        record_test_result "Static Web App Exists" "PASS" "Found: $STATIC_WEB_APP_NAME" "infrastructure"
        
        # Get Static Web App details
        local swa_state=$(az staticwebapp show --name "$STATIC_WEB_APP_NAME" --resource-group "$RESOURCE_GROUP" --query "state" -o tsv)
        local swa_hostname=$(az staticwebapp show --name "$STATIC_WEB_APP_NAME" --resource-group "$RESOURCE_GROUP" --query "defaultHostname" -o tsv)
        
        if [ "$swa_state" = "Ready" ]; then
            record_test_result "Static Web App State" "PASS" "State: $swa_state" "infrastructure"
        else
            record_test_result "Static Web App State" "WARN" "State: $swa_state (not Ready)" "infrastructure"
        fi
        
        if [ "$VERBOSE" = true ]; then
            print_status "Default hostname: $swa_hostname"
        fi
        
        # Test default hostname accessibility
        if command -v curl &>/dev/null; then
            local default_response=$(curl -s -o /dev/null -w "%{http_code}" "https://$swa_hostname" --max-time 10 2>/dev/null || echo "000")
            if [ "$default_response" = "200" ]; then
                record_test_result "Default Hostname Access" "PASS" "HTTPS $default_response from $swa_hostname" "accessibility"
            else
                record_test_result "Default Hostname Access" "FAIL" "HTTPS $default_response from $swa_hostname" "accessibility"
            fi
        fi
    else
        record_test_result "Static Web App Exists" "FAIL" "Not found: $STATIC_WEB_APP_NAME" "infrastructure"
    fi
}

# Function to test custom domain configuration
test_custom_domain_config() {
    print_step "Testing custom domain configuration"
    
    # Check if custom domains are configured
    local configured_domains=$(az staticwebapp hostname list --name "$STATIC_WEB_APP_NAME" --resource-group "$RESOURCE_GROUP" --query "[].name" -o tsv 2>/dev/null || echo "")
    
    if [ -n "$configured_domains" ]; then
        record_test_result "Custom Domains Configured" "PASS" "Found configured domains" "domain_config"
        
        if [ "$VERBOSE" = true ]; then
            print_status "Configured domains: $configured_domains"
        fi
        
        # Check main custom domain
        if echo "$configured_domains" | grep -q "^$CUSTOM_DOMAIN$"; then
            record_test_result "Main Custom Domain" "PASS" "Domain configured: $CUSTOM_DOMAIN" "domain_config"
            
            # Get domain status
            local domain_status=$(az staticwebapp hostname show --name "$STATIC_WEB_APP_NAME" --resource-group "$RESOURCE_GROUP" --hostname "$CUSTOM_DOMAIN" --query "status" -o tsv 2>/dev/null || echo "unknown")
            local validation_status=$(az staticwebapp hostname show --name "$STATIC_WEB_APP_NAME" --resource-group "$RESOURCE_GROUP" --hostname "$CUSTOM_DOMAIN" --query "validationStatus" -o tsv 2>/dev/null || echo "unknown")
            
            if [ "$domain_status" = "Ready" ]; then
                record_test_result "Main Domain Status" "PASS" "Status: $domain_status" "domain_config"
            else
                record_test_result "Main Domain Status" "FAIL" "Status: $domain_status" "domain_config"
            fi
            
            if [ "$validation_status" = "Succeeded" ]; then
                record_test_result "Main Domain Validation" "PASS" "Validation: $validation_status" "domain_config"
            else
                record_test_result "Main Domain Validation" "WARN" "Validation: $validation_status" "domain_config"
            fi
        else
            record_test_result "Main Custom Domain" "FAIL" "Domain not configured: $CUSTOM_DOMAIN" "domain_config"
        fi
        
        # Check WWW domain (production only)
        if [ "$ENVIRONMENT" = "production" ] && [ -n "$WWW_DOMAIN" ]; then
            if echo "$configured_domains" | grep -q "^$WWW_DOMAIN$"; then
                record_test_result "WWW Domain" "PASS" "Domain configured: $WWW_DOMAIN" "domain_config"
                
                local www_status=$(az staticwebapp hostname show --name "$STATIC_WEB_APP_NAME" --resource-group "$RESOURCE_GROUP" --hostname "$WWW_DOMAIN" --query "status" -o tsv 2>/dev/null || echo "unknown")
                if [ "$www_status" = "Ready" ]; then
                    record_test_result "WWW Domain Status" "PASS" "Status: $www_status" "domain_config"
                else
                    record_test_result "WWW Domain Status" "WARN" "Status: $www_status" "domain_config"
                fi
            else
                record_test_result "WWW Domain" "WARN" "WWW domain not configured (optional)" "domain_config"
            fi
        fi
    else
        record_test_result "Custom Domains Configured" "FAIL" "No custom domains configured" "domain_config"
    fi
}

# Function to test domain accessibility
test_domain_accessibility() {
    print_step "Testing domain accessibility"
    
    if command -v curl &>/dev/null; then
        # Test main custom domain HTTP
        local http_response=$(curl -s -o /dev/null -w "%{http_code}" "http://$CUSTOM_DOMAIN" --max-time 10 2>/dev/null || echo "000")
        if [ "$http_response" = "200" ] || [ "$http_response" = "301" ] || [ "$http_response" = "302" ]; then
            record_test_result "Main Domain HTTP Access" "PASS" "HTTP $http_response from $CUSTOM_DOMAIN" "accessibility"
        else
            record_test_result "Main Domain HTTP Access" "FAIL" "HTTP $http_response from $CUSTOM_DOMAIN" "accessibility"
        fi
        
        # Test main custom domain HTTPS
        local https_response=$(curl -s -o /dev/null -w "%{http_code}" "https://$CUSTOM_DOMAIN" --max-time 15 2>/dev/null || echo "000")
        if [ "$https_response" = "200" ] || [ "$https_response" = "301" ] || [ "$https_response" = "302" ]; then
            record_test_result "Main Domain HTTPS Access" "PASS" "HTTPS $https_response from $CUSTOM_DOMAIN" "accessibility"
        else
            record_test_result "Main Domain HTTPS Access" "FAIL" "HTTPS $https_response from $CUSTOM_DOMAIN" "accessibility"
        fi
        
        # Test WWW domain (production only)
        if [ "$ENVIRONMENT" = "production" ] && [ -n "$WWW_DOMAIN" ]; then
            local www_http_response=$(curl -s -o /dev/null -w "%{http_code}" "http://$WWW_DOMAIN" --max-time 10 2>/dev/null || echo "000")
            if [ "$www_http_response" = "200" ] || [ "$www_http_response" = "301" ] || [ "$www_http_response" = "302" ]; then
                record_test_result "WWW Domain HTTP Access" "PASS" "HTTP $www_http_response from $WWW_DOMAIN" "accessibility"
            else
                record_test_result "WWW Domain HTTP Access" "WARN" "HTTP $www_http_response from $WWW_DOMAIN" "accessibility"
            fi
            
            local www_https_response=$(curl -s -o /dev/null -w "%{http_code}" "https://$WWW_DOMAIN" --max-time 15 2>/dev/null || echo "000")
            if [ "$www_https_response" = "200" ] || [ "$www_https_response" = "301" ] || [ "$www_https_response" = "302" ]; then
                record_test_result "WWW Domain HTTPS Access" "PASS" "HTTPS $www_https_response from $WWW_DOMAIN" "accessibility"
            else
                record_test_result "WWW Domain HTTPS Access" "WARN" "HTTPS $www_https_response from $WWW_DOMAIN" "accessibility"
            fi
        fi
        
        # Test HTTPS redirect
        local redirect_location=$(curl -s -I "http://$CUSTOM_DOMAIN" --max-time 10 2>/dev/null | grep -i "location:" | awk '{print $2}' | tr -d '\r\n')
        if [[ "$redirect_location" == https://* ]]; then
            record_test_result "HTTPS Redirect" "PASS" "HTTP redirects to HTTPS" "security"
        else
            record_test_result "HTTPS Redirect" "WARN" "HTTP does not redirect to HTTPS" "security"
        fi
    else
        record_test_result "Domain Accessibility Tools" "WARN" "curl not available - skipping accessibility tests" "accessibility"
    fi
}

# Function to test SSL certificates
test_ssl_certificates() {
    if [ "$SSL" = false ]; then
        return 0
    fi
    
    print_step "Testing SSL certificate configuration"
    
    if command -v openssl &>/dev/null; then
        # Test main domain SSL certificate
        local ssl_info=$(echo | openssl s_client -servername "$CUSTOM_DOMAIN" -connect "$CUSTOM_DOMAIN:443" 2>/dev/null | openssl x509 -noout -dates 2>/dev/null || echo "")
        if [ -n "$ssl_info" ]; then
            local expiry_date=$(echo "$ssl_info" | grep "notAfter=" | cut -d'=' -f2)
            record_test_result "Main Domain SSL Certificate" "PASS" "SSL certificate valid, expires: $expiry_date" "ssl"
            
            # Check certificate subject
            local cert_subject=$(echo | openssl s_client -servername "$CUSTOM_DOMAIN" -connect "$CUSTOM_DOMAIN:443" 2>/dev/null | openssl x509 -noout -subject 2>/dev/null || echo "")
            if [[ "$cert_subject" == *"$CUSTOM_DOMAIN"* ]]; then
                record_test_result "Main Domain SSL Subject" "PASS" "Certificate subject matches domain" "ssl"
            else
                record_test_result "Main Domain SSL Subject" "WARN" "Certificate subject may not match domain" "ssl"
            fi
            
            # Check certificate issuer
            local cert_issuer=$(echo | openssl s_client -servername "$CUSTOM_DOMAIN" -connect "$CUSTOM_DOMAIN:443" 2>/dev/null | openssl x509 -noout -issuer 2>/dev/null || echo "")
            if [[ "$cert_issuer" == *"Let's Encrypt"* ]] || [[ "$cert_issuer" == *"DigiCert"* ]] || [[ "$cert_issuer" == *"Microsoft"* ]]; then
                record_test_result "Main Domain SSL Issuer" "PASS" "Certificate from trusted issuer" "ssl"
            else
                record_test_result "Main Domain SSL Issuer" "WARN" "Certificate issuer: $cert_issuer" "ssl"
            fi
        else
            record_test_result "Main Domain SSL Certificate" "FAIL" "SSL certificate not available or invalid" "ssl"
        fi
        
        # Test WWW domain SSL certificate (production only)
        if [ "$ENVIRONMENT" = "production" ] && [ -n "$WWW_DOMAIN" ]; then
            local www_ssl_info=$(echo | openssl s_client -servername "$WWW_DOMAIN" -connect "$WWW_DOMAIN:443" 2>/dev/null | openssl x509 -noout -dates 2>/dev/null || echo "")
            if [ -n "$www_ssl_info" ]; then
                local www_expiry_date=$(echo "$www_ssl_info" | grep "notAfter=" | cut -d'=' -f2)
                record_test_result "WWW Domain SSL Certificate" "PASS" "SSL certificate valid, expires: $www_expiry_date" "ssl"
            else
                record_test_result "WWW Domain SSL Certificate" "WARN" "SSL certificate not available" "ssl"
            fi
        fi
        
        # Test SSL protocol support
        local ssl_protocols=("tls1_2" "tls1_3")
        for protocol in "${ssl_protocols[@]}"; do
            if echo | openssl s_client -$protocol -servername "$CUSTOM_DOMAIN" -connect "$CUSTOM_DOMAIN:443" 2>/dev/null | grep -q "Verify return code: 0"; then
                record_test_result "SSL Protocol $protocol" "PASS" "$protocol supported" "ssl"
            else
                record_test_result "SSL Protocol $protocol" "WARN" "$protocol not supported or failed" "ssl"
            fi
        done
        
        # Test SSL cipher strength
        local cipher_info=$(echo | openssl s_client -servername "$CUSTOM_DOMAIN" -connect "$CUSTOM_DOMAIN:443" 2>/dev/null | grep "Cipher    :" | awk '{print $3}')
        if [ -n "$cipher_info" ]; then
            record_test_result "SSL Cipher" "PASS" "Cipher: $cipher_info" "ssl"
        else
            record_test_result "SSL Cipher" "WARN" "Could not determine SSL cipher" "ssl"
        fi
    else
        record_test_result "SSL Certificate Tools" "WARN" "openssl not available - skipping SSL certificate tests" "ssl"
    fi
}

# Function to test security headers
test_security_headers() {
    if [ "$SECURITY" = false ]; then
        return 0
    fi
    
    print_step "Testing security headers"
    
    if command -v curl &>/dev/null; then
        # Get response headers
        local headers=$(curl -s -I "https://$CUSTOM_DOMAIN" --max-time 10 2>/dev/null || echo "")
        
        if [ -n "$headers" ]; then
            # Check for important security headers
            local security_headers=(
                "strict-transport-security:HSTS"
                "x-content-type-options:X-Content-Type-Options"
                "x-frame-options:X-Frame-Options"
                "x-xss-protection:X-XSS-Protection"
                "content-security-policy:Content-Security-Policy"
                "referrer-policy:Referrer-Policy"
            )
            
            for header_pair in "${security_headers[@]}"; do
                local header_name=$(echo "$header_pair" | cut -d':' -f1)
                local display_name=$(echo "$header_pair" | cut -d':' -f2)
                
                if echo "$headers" | grep -qi "$header_name"; then
                    local header_value=$(echo "$headers" | grep -i "$header_name" | cut -d':' -f2- | tr -d '\r\n' | xargs)
                    record_test_result "Security Header: $display_name" "PASS" "$header_value" "security"
                else
                    record_test_result "Security Header: $display_name" "WARN" "Header not found" "security"
                fi
            done
            
            # Check for server header (should be minimal)
            if echo "$headers" | grep -qi "server:"; then
                local server_header=$(echo "$headers" | grep -i "server:" | cut -d':' -f2- | tr -d '\r\n' | xargs)
                if [ ${#server_header} -lt 20 ]; then
                    record_test_result "Server Header" "PASS" "Minimal server info: $server_header" "security"
                else
                    record_test_result "Server Header" "WARN" "Verbose server info: $server_header" "security"
                fi
            else
                record_test_result "Server Header" "PASS" "Server header not disclosed" "security"
            fi
        else
            record_test_result "Security Headers" "FAIL" "Could not retrieve headers" "security"
        fi
    else
        record_test_result "Security Headers Tools" "WARN" "curl not available - skipping security header tests" "security"
    fi
}

# Function to test performance
test_performance() {
    if [ "$PERFORMANCE" = false ]; then
        return 0
    fi
    
    print_step "Testing domain performance"
    
    if command -v curl &>/dev/null; then
        # Test response times
        local response_time=$(curl -s -o /dev/null -w "%{time_total}" "https://$CUSTOM_DOMAIN" --max-time 30 2>/dev/null || echo "0")
        local response_time_ms=$(echo "$response_time * 1000" | bc -l 2>/dev/null | cut -d'.' -f1 || echo "0")
        
        if [ "$response_time_ms" -lt 2000 ]; then
            record_test_result "Response Time" "PASS" "${response_time_ms}ms (< 2s)" "performance"
        elif [ "$response_time_ms" -lt 5000 ]; then
            record_test_result "Response Time" "WARN" "${response_time_ms}ms (2-5s)" "performance"
        else
            record_test_result "Response Time" "FAIL" "${response_time_ms}ms (> 5s)" "performance"
        fi
        
        # Test DNS resolution time
        local dns_time=$(curl -s -o /dev/null -w "%{time_namelookup}" "https://$CUSTOM_DOMAIN" --max-time 30 2>/dev/null || echo "0")
        local dns_time_ms=$(echo "$dns_time * 1000" | bc -l 2>/dev/null | cut -d'.' -f1 || echo "0")
        
        if [ "$dns_time_ms" -lt 100 ]; then
            record_test_result "DNS Resolution Time" "PASS" "${dns_time_ms}ms (< 100ms)" "performance"
        elif [ "$dns_time_ms" -lt 500 ]; then
            record_test_result "DNS Resolution Time" "WARN" "${dns_time_ms}ms (100-500ms)" "performance"
        else
            record_test_result "DNS Resolution Time" "FAIL" "${dns_time_ms}ms (> 500ms)" "performance"
        fi
        
        # Test SSL handshake time
        local ssl_time=$(curl -s -o /dev/null -w "%{time_connect}" "https://$CUSTOM_DOMAIN" --max-time 30 2>/dev/null || echo "0")
        local ssl_time_ms=$(echo "$ssl_time * 1000" | bc -l 2>/dev/null | cut -d'.' -f1 || echo "0")
        
        if [ "$ssl_time_ms" -lt 500 ]; then
            record_test_result "SSL Handshake Time" "PASS" "${ssl_time_ms}ms (< 500ms)" "performance"
        elif [ "$ssl_time_ms" -lt 1000 ]; then
            record_test_result "SSL Handshake Time" "WARN" "${ssl_time_ms}ms (500ms-1s)" "performance"
        else
            record_test_result "SSL Handshake Time" "FAIL" "${ssl_time_ms}ms (> 1s)" "performance"
        fi
        
        # Test compression
        local content_encoding=$(curl -s -I -H "Accept-Encoding: gzip, deflate" "https://$CUSTOM_DOMAIN" --max-time 10 2>/dev/null | grep -i "content-encoding:" | cut -d':' -f2 | tr -d '\r\n' | xargs || echo "")
        if [[ "$content_encoding" == *"gzip"* ]] || [[ "$content_encoding" == *"br"* ]]; then
            record_test_result "Compression" "PASS" "Content compressed: $content_encoding" "performance"
        else
            record_test_result "Compression" "WARN" "Content not compressed" "performance"
        fi
        
        # Test caching headers
        local cache_control=$(curl -s -I "https://$CUSTOM_DOMAIN" --max-time 10 2>/dev/null | grep -i "cache-control:" | cut -d':' -f2 | tr -d '\r\n' | xargs || echo "")
        if [ -n "$cache_control" ]; then
            record_test_result "Cache Headers" "PASS" "Cache-Control: $cache_control" "performance"
        else
            record_test_result "Cache Headers" "WARN" "No cache control headers" "performance"
        fi
    else
        record_test_result "Performance Tools" "WARN" "curl not available - skipping performance tests" "performance"
    fi
}

# Function to test content delivery
test_content_delivery() {
    print_step "Testing content delivery"
    
    if command -v curl &>/dev/null; then
        # Test main page content
        local content=$(curl -s "https://$CUSTOM_DOMAIN" --max-time 15 2>/dev/null || echo "")
        
        if [ -n "$content" ]; then
            # Check for expected content
            if [[ "$content" == *"TaktMate"* ]] || [[ "$content" == *"taktmate"* ]]; then
                record_test_result "Content Delivery" "PASS" "Expected content found" "content"
            else
                record_test_result "Content Delivery" "WARN" "Expected content not found" "content"
            fi
            
            # Check content length
            local content_length=${#content}
            if [ "$content_length" -gt 1000 ]; then
                record_test_result "Content Length" "PASS" "${content_length} bytes" "content"
            else
                record_test_result "Content Length" "WARN" "${content_length} bytes (seems small)" "content"
            fi
            
            # Check for HTML structure
            if [[ "$content" == *"<html"* ]] && [[ "$content" == *"</html>"* ]]; then
                record_test_result "HTML Structure" "PASS" "Valid HTML structure" "content"
            else
                record_test_result "HTML Structure" "WARN" "Invalid or missing HTML structure" "content"
            fi
            
            # Check for meta tags (SEO)
            if [[ "$content" == *"<meta"* ]]; then
                record_test_result "Meta Tags" "PASS" "Meta tags found" "content"
            else
                record_test_result "Meta Tags" "WARN" "No meta tags found" "content"
            fi
        else
            record_test_result "Content Delivery" "FAIL" "No content received" "content"
        fi
        
        # Test 404 handling
        local not_found_response=$(curl -s -o /dev/null -w "%{http_code}" "https://$CUSTOM_DOMAIN/nonexistent-page-12345" --max-time 10 2>/dev/null || echo "000")
        if [ "$not_found_response" = "404" ] || [ "$not_found_response" = "200" ]; then
            record_test_result "404 Handling" "PASS" "404 pages handled correctly (HTTP $not_found_response)" "content"
        else
            record_test_result "404 Handling" "WARN" "Unexpected 404 response: HTTP $not_found_response" "content"
        fi
    else
        record_test_result "Content Delivery Tools" "WARN" "curl not available - skipping content delivery tests" "content"
    fi
}

# Function to generate test report
generate_test_report() {
    if [ "$REPORT" = false ]; then
        return 0
    fi
    
    print_step "Generating Static Web App domain test report"
    
    local report_file="$REPORT_DIR/swa-domain-test-report-${ENVIRONMENT}-${DOMAIN}-$(date +%Y%m%d-%H%M%S).json"
    
    local report_data="{
        \"environment\": \"$ENVIRONMENT\",
        \"domain\": \"$DOMAIN\",
        \"static_web_app\": \"$STATIC_WEB_APP_NAME\",
        \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
        \"domains_tested\": {
            \"custom_domain\": \"$CUSTOM_DOMAIN\",
            \"www_domain\": \"$WWW_DOMAIN\"
        },
        \"summary\": {
            \"total_tests\": $TOTAL_TESTS,
            \"passed\": $PASSED_TESTS,
            \"failed\": $FAILED_TESTS,
            \"warnings\": $WARNING_TESTS,
            \"success_rate\": $(echo "scale=2; $PASSED_TESTS * 100 / $TOTAL_TESTS" | bc -l 2>/dev/null || echo "0")
        },
        \"test_categories\": {
            \"infrastructure\": $(echo "${TEST_RESULTS[*]}" | grep -c '"category":"infrastructure"' || echo "0"),
            \"domain_config\": $(echo "${TEST_RESULTS[*]}" | grep -c '"category":"domain_config"' || echo "0"),
            \"accessibility\": $(echo "${TEST_RESULTS[*]}" | grep -c '"category":"accessibility"' || echo "0"),
            \"ssl\": $(echo "${TEST_RESULTS[*]}" | grep -c '"category":"ssl"' || echo "0"),
            \"security\": $(echo "${TEST_RESULTS[*]}" | grep -c '"category":"security"' || echo "0"),
            \"performance\": $(echo "${TEST_RESULTS[*]}" | grep -c '"category":"performance"' || echo "0"),
            \"content\": $(echo "${TEST_RESULTS[*]}" | grep -c '"category":"content"' || echo "0")
        },
        \"tests\": [$(IFS=,; echo "${TEST_RESULTS[*]}")]
    }"
    
    echo "$report_data" | jq '.' > "$report_file" 2>/dev/null || echo "$report_data" > "$report_file"
    print_success "Static Web App domain test report generated: $report_file"
}

# Main function
main() {
    print_header "AZURE STATIC WEB APPS CUSTOM DOMAIN TESTING"
    print_status "Environment: $ENVIRONMENT"
    print_status "Domain: $DOMAIN"
    print_status "Custom Domain: $CUSTOM_DOMAIN"
    print_status "Static Web App: $STATIC_WEB_APP_NAME"
    print_status "Comprehensive Testing: $COMPREHENSIVE"
    echo ""
    
    # Execute test phases
    test_static_web_app_config
    test_custom_domain_config
    test_domain_accessibility
    test_ssl_certificates
    test_security_headers
    test_performance
    test_content_delivery
    generate_test_report
    
    # Print summary
    print_header "STATIC WEB APP DOMAIN TESTING SUMMARY"
    echo "Total Tests: $TOTAL_TESTS"
    echo "Passed: $PASSED_TESTS"
    echo "Failed: $FAILED_TESTS"
    echo "Warnings: $WARNING_TESTS"
    
    if [ $TOTAL_TESTS -gt 0 ]; then
        local success_rate=$(echo "scale=1; $PASSED_TESTS * 100 / $TOTAL_TESTS" | bc -l 2>/dev/null || echo "0")
        echo "Success Rate: ${success_rate}%"
    fi
    
    if [ $FAILED_TESTS -gt 0 ]; then
        print_header "SOME STATIC WEB APP DOMAIN TESTS FAILED! ❌"
        echo ""
        echo "Common issues and solutions:"
        echo "1. Custom domains may take time to provision and validate"
        echo "2. DNS propagation may still be in progress"
        echo "3. SSL certificates may take up to 24 hours to provision"
        echo "4. Check Azure portal for domain validation status"
        exit 1
    elif [ $WARNING_TESTS -gt 0 ]; then
        print_header "STATIC WEB APP DOMAIN TESTS COMPLETED WITH WARNINGS! ⚠️"
        echo ""
        echo "Review warnings above - some may be expected during initial setup"
        exit 0
    else
        print_header "ALL STATIC WEB APP DOMAIN TESTS PASSED! ✅"
        exit 0
    fi
}

# Execute main function
main "$@"
