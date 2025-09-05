#!/bin/bash

# TaktMate Domain Accessibility and SSL Certificate Validation Script
# Usage: ./test-domain-ssl-validation.sh [environment] [domain] [options]
# Example: ./test-domain-ssl-validation.sh production taktconnect.com --comprehensive --report

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
    echo "TaktMate Domain Accessibility and SSL Certificate Validation"
    echo ""
    echo "Usage: $0 [environment] [domain] [options]"
    echo ""
    echo "Environments:"
    echo "  production  - Test production domain and SSL configuration"
    echo "  staging     - Test staging domain and SSL configuration"
    echo "  development - Test development domain and SSL configuration"
    echo "  all         - Test all environments"
    echo ""
    echo "Domains:"
    echo "  taktconnect.com - Primary domain for TaktMate application"
    echo "  taktmate.com    - Alternative domain (if available)"
    echo ""
    echo "Options:"
    echo "  --comprehensive Test all domain and SSL aspects"
    echo "  --dns           Test DNS configuration and propagation"
    echo "  --ssl           Test SSL certificate validity and security"
    echo "  --accessibility Test HTTP/HTTPS domain accessibility"
    echo "  --performance   Test domain and SSL performance"
    echo "  --security      Test security headers and configuration"
    echo "  --integration   Test integration with Azure services"
    echo "  --report        Generate detailed test report"
    echo "  --verbose       Enable verbose output"
    echo "  --help          Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 production taktconnect.com --comprehensive --report"
    echo "  $0 all taktconnect.com --dns --ssl --accessibility"
    echo "  $0 staging taktconnect.com --performance --security --verbose"
}

# Parse arguments
ENVIRONMENT=""
DOMAIN=""
COMPREHENSIVE=false
DNS=false
SSL=false
ACCESSIBILITY=false
PERFORMANCE=false
SECURITY=false
INTEGRATION=false
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
            DNS=true
            SSL=true
            ACCESSIBILITY=true
            PERFORMANCE=true
            SECURITY=true
            INTEGRATION=true
            shift
            ;;
        --dns)
            DNS=true
            shift
            ;;
        --ssl)
            SSL=true
            shift
            ;;
        --accessibility)
            ACCESSIBILITY=true
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
        --integration)
            INTEGRATION=true
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
    local details="${5:-}"
    
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
    
    if [ "$VERBOSE" = true ] && [ -n "$details" ]; then
        print_status "  Details: $details"
    fi
    
    if [ "$REPORT" = true ]; then
        local test_data="{\"test\":\"$test_name\",\"status\":\"$status\",\"message\":\"$message\",\"category\":\"$category\",\"details\":\"$details\",\"environment\":\"$ENVIRONMENT\",\"domain\":\"$DOMAIN\",\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}"
        TEST_RESULTS+=("$test_data")
    fi
}

# Function to get environment-specific configuration
get_environment_config() {
    local env="$1"
    
    case "$env" in
        "production")
            echo "app.${DOMAIN}:taktmate-frontend-prod:taktmate-prod-rg"
            echo "www.${DOMAIN}:taktmate-frontend-prod:taktmate-prod-rg"
            ;;
        "staging")
            echo "staging.${DOMAIN}:taktmate-frontend-staging:taktmate-staging-rg"
            ;;
        "development")
            echo "dev.${DOMAIN}:taktmate-frontend-dev:taktmate-dev-rg"
            ;;
    esac
}

# Function to test DNS configuration
test_dns_configuration() {
    local env="$1"
    
    print_step "Testing DNS configuration for $env environment"
    
    local config_lines=($(get_environment_config "$env"))
    
    for config_line in "${config_lines[@]}"; do
        IFS=':' read -r hostname swa_name resource_group <<< "$config_line"
        
        # Test DNS resolution
        if command -v nslookup &>/dev/null; then
            if nslookup "$hostname" &>/dev/null; then
                local resolved_ip=$(nslookup "$hostname" 2>/dev/null | grep -A1 "Name:" | tail -1 | awk '{print $2}' || echo "unknown")
                record_test_result "DNS Resolution ($hostname)" "PASS" "Domain resolves to $resolved_ip" "dns" "Hostname: $hostname"
            else
                record_test_result "DNS Resolution ($hostname)" "FAIL" "Domain does not resolve" "dns" "Hostname: $hostname"
            fi
        fi
        
        # Test CNAME record
        if command -v dig &>/dev/null; then
            local cname_target=$(dig "$hostname" CNAME +short | tail -1)
            if [ -n "$cname_target" ]; then
                local expected_target="${swa_name}.azurestaticapps.net."
                if [[ "$cname_target" == *"azurestaticapps.net"* ]]; then
                    record_test_result "CNAME Record ($hostname)" "PASS" "Points to Azure Static Web App: $cname_target" "dns" "Expected: $expected_target"
                else
                    record_test_result "CNAME Record ($hostname)" "WARN" "Unexpected CNAME target: $cname_target" "dns" "Expected: $expected_target"
                fi
            else
                record_test_result "CNAME Record ($hostname)" "FAIL" "No CNAME record found" "dns" "Expected: $expected_target"
            fi
        fi
        
        # Test DNS propagation across multiple servers
        local dns_servers=("8.8.8.8" "1.1.1.1" "208.67.222.222")
        local dns_server_names=("Google DNS" "Cloudflare DNS" "OpenDNS")
        
        for i in "${!dns_servers[@]}"; do
            local server="${dns_servers[$i]}"
            local server_name="${dns_server_names[$i]}"
            
            if command -v dig &>/dev/null; then
                local propagation_result=$(dig "@$server" "$hostname" +short 2>/dev/null | head -1)
                if [ -n "$propagation_result" ]; then
                    record_test_result "DNS Propagation ($hostname - $server_name)" "PASS" "Resolves via $server_name" "dns" "Result: $propagation_result"
                else
                    record_test_result "DNS Propagation ($hostname - $server_name)" "WARN" "Not propagated to $server_name" "dns" "Server: $server"
                fi
            fi
        done
        
        # Test DNS response time
        if command -v dig &>/dev/null; then
            local dns_time=$(dig "$hostname" | grep "Query time:" | awk '{print $4}')
            if [ -n "$dns_time" ]; then
                local dns_time_num=$(echo "$dns_time" | sed 's/[^0-9]//g')
                if [ "$dns_time_num" -lt 100 ]; then
                    record_test_result "DNS Response Time ($hostname)" "PASS" "${dns_time}ms (excellent)" "dns" "Threshold: <100ms"
                elif [ "$dns_time_num" -lt 500 ]; then
                    record_test_result "DNS Response Time ($hostname)" "PASS" "${dns_time}ms (good)" "dns" "Threshold: <500ms"
                else
                    record_test_result "DNS Response Time ($hostname)" "WARN" "${dns_time}ms (slow)" "dns" "Threshold: <500ms"
                fi
            fi
        fi
    done
}

# Function to test SSL certificates
test_ssl_certificates() {
    local env="$1"
    
    print_step "Testing SSL certificates for $env environment"
    
    local config_lines=($(get_environment_config "$env"))
    
    for config_line in "${config_lines[@]}"; do
        IFS=':' read -r hostname swa_name resource_group <<< "$config_line"
        
        if ! command -v openssl &>/dev/null; then
            record_test_result "SSL Testing Tools" "WARN" "openssl not available - skipping SSL tests for $hostname" "ssl"
            continue
        fi
        
        # Test SSL certificate existence and validity
        local ssl_info=$(echo | openssl s_client -servername "$hostname" -connect "$hostname:443" 2>/dev/null | openssl x509 -noout -dates 2>/dev/null || echo "")
        
        if [ -n "$ssl_info" ]; then
            # Extract certificate dates
            local issue_date=$(echo "$ssl_info" | grep "notBefore=" | cut -d'=' -f2)
            local expiry_date=$(echo "$ssl_info" | grep "notAfter=" | cut -d'=' -f2)
            
            # Calculate days until expiration
            local expiry_epoch
            local current_epoch=$(date +%s)
            
            if date -d "$expiry_date" +%s &>/dev/null; then
                expiry_epoch=$(date -d "$expiry_date" +%s)
            elif date -j -f "%b %d %T %Y %Z" "$expiry_date" +%s &>/dev/null; then
                expiry_epoch=$(date -j -f "%b %d %T %Y %Z" "$expiry_date" +%s)
            fi
            
            if [ -n "$expiry_epoch" ]; then
                local days_until_expiry=$(( (expiry_epoch - current_epoch) / 86400 ))
                
                if [ $days_until_expiry -gt 30 ]; then
                    record_test_result "SSL Certificate Validity ($hostname)" "PASS" "Valid for $days_until_expiry days" "ssl" "Expires: $expiry_date"
                elif [ $days_until_expiry -gt 7 ]; then
                    record_test_result "SSL Certificate Validity ($hostname)" "WARN" "Expires in $days_until_expiry days" "ssl" "Expires: $expiry_date"
                else
                    record_test_result "SSL Certificate Validity ($hostname)" "FAIL" "Expires in $days_until_expiry days - CRITICAL!" "ssl" "Expires: $expiry_date"
                fi
            fi
            
            # Test certificate subject
            local cert_subject=$(echo | openssl s_client -servername "$hostname" -connect "$hostname:443" 2>/dev/null | openssl x509 -noout -subject 2>/dev/null | sed 's/subject= *//')
            if [[ "$cert_subject" == *"$hostname"* ]]; then
                record_test_result "SSL Certificate Subject ($hostname)" "PASS" "Subject matches hostname" "ssl" "Subject: $cert_subject"
            else
                record_test_result "SSL Certificate Subject ($hostname)" "WARN" "Subject may not match hostname" "ssl" "Subject: $cert_subject"
            fi
            
            # Test certificate issuer
            local cert_issuer=$(echo | openssl s_client -servername "$hostname" -connect "$hostname:443" 2>/dev/null | openssl x509 -noout -issuer 2>/dev/null | sed 's/issuer= *//')
            if [[ "$cert_issuer" == *"Let's Encrypt"* ]] || [[ "$cert_issuer" == *"DigiCert"* ]] || [[ "$cert_issuer" == *"Microsoft"* ]]; then
                record_test_result "SSL Certificate Issuer ($hostname)" "PASS" "Trusted CA issuer" "ssl" "Issuer: $cert_issuer"
            else
                record_test_result "SSL Certificate Issuer ($hostname)" "WARN" "Unknown or untrusted issuer" "ssl" "Issuer: $cert_issuer"
            fi
            
            # Test SSL protocols
            local ssl_protocols=("tls1_2" "tls1_3")
            for protocol in "${ssl_protocols[@]}"; do
                if echo | openssl s_client -$protocol -servername "$hostname" -connect "$hostname:443" 2>/dev/null | grep -q "Verify return code: 0"; then
                    record_test_result "SSL Protocol $protocol ($hostname)" "PASS" "$protocol supported" "ssl" "Protocol: $protocol"
                else
                    if [ "$protocol" = "tls1_3" ]; then
                        record_test_result "SSL Protocol $protocol ($hostname)" "WARN" "$protocol not supported (optional)" "ssl" "Protocol: $protocol"
                    else
                        record_test_result "SSL Protocol $protocol ($hostname)" "FAIL" "$protocol not supported (required)" "ssl" "Protocol: $protocol"
                    fi
                fi
            done
            
            # Test certificate chain
            local cert_chain_count=$(echo | openssl s_client -servername "$hostname" -connect "$hostname:443" -showcerts 2>/dev/null | grep -c "BEGIN CERTIFICATE" || echo "0")
            if [ "$cert_chain_count" -gt 1 ]; then
                record_test_result "SSL Certificate Chain ($hostname)" "PASS" "Complete chain ($cert_chain_count certificates)" "ssl" "Chain length: $cert_chain_count"
            else
                record_test_result "SSL Certificate Chain ($hostname)" "WARN" "Incomplete or minimal chain ($cert_chain_count certificate)" "ssl" "Chain length: $cert_chain_count"
            fi
            
        else
            record_test_result "SSL Certificate ($hostname)" "FAIL" "SSL certificate not accessible" "ssl" "Connection failed"
        fi
    done
}

# Function to test domain accessibility
test_domain_accessibility() {
    local env="$1"
    
    print_step "Testing domain accessibility for $env environment"
    
    local config_lines=($(get_environment_config "$env"))
    
    for config_line in "${config_lines[@]}"; do
        IFS=':' read -r hostname swa_name resource_group <<< "$config_line"
        
        if ! command -v curl &>/dev/null; then
            record_test_result "Accessibility Testing Tools" "WARN" "curl not available - skipping accessibility tests for $hostname" "accessibility"
            continue
        fi
        
        # Test HTTP accessibility
        local http_response=$(curl -s -o /dev/null -w "%{http_code}" "http://$hostname" --max-time 15 2>/dev/null || echo "000")
        if [ "$http_response" = "200" ]; then
            record_test_result "HTTP Access ($hostname)" "PASS" "HTTP accessible (HTTP $http_response)" "accessibility" "URL: http://$hostname"
        elif [ "$http_response" = "301" ] || [ "$http_response" = "302" ]; then
            record_test_result "HTTP Access ($hostname)" "PASS" "HTTP redirects to HTTPS (HTTP $http_response)" "accessibility" "URL: http://$hostname"
        else
            record_test_result "HTTP Access ($hostname)" "FAIL" "HTTP not accessible (HTTP $http_response)" "accessibility" "URL: http://$hostname"
        fi
        
        # Test HTTPS accessibility
        local https_response=$(curl -s -o /dev/null -w "%{http_code}" "https://$hostname" --max-time 15 2>/dev/null || echo "000")
        if [ "$https_response" = "200" ]; then
            record_test_result "HTTPS Access ($hostname)" "PASS" "HTTPS accessible (HTTP $https_response)" "accessibility" "URL: https://$hostname"
        else
            record_test_result "HTTPS Access ($hostname)" "FAIL" "HTTPS not accessible (HTTP $https_response)" "accessibility" "URL: https://$hostname"
        fi
        
        # Test HTTPS redirect
        local redirect_location=$(curl -s -I "http://$hostname" --max-time 10 2>/dev/null | grep -i "location:" | awk '{print $2}' | tr -d '\r\n')
        if [[ "$redirect_location" == https://* ]]; then
            record_test_result "HTTPS Redirect ($hostname)" "PASS" "HTTP redirects to HTTPS" "accessibility" "Redirect: $redirect_location"
        elif [ -n "$redirect_location" ]; then
            record_test_result "HTTPS Redirect ($hostname)" "WARN" "HTTP redirects but not to HTTPS" "accessibility" "Redirect: $redirect_location"
        else
            record_test_result "HTTPS Redirect ($hostname)" "WARN" "No HTTPS redirect detected" "accessibility" "No redirect header"
        fi
        
        # Test content accessibility
        if [ "$https_response" = "200" ]; then
            local content=$(curl -s "https://$hostname" --max-time 15 2>/dev/null | head -c 1000)
            if [ -n "$content" ]; then
                if [[ "$content" == *"<html"* ]] || [[ "$content" == *"<!DOCTYPE"* ]]; then
                    record_test_result "Content Delivery ($hostname)" "PASS" "Valid HTML content delivered" "accessibility" "Content type: HTML"
                else
                    record_test_result "Content Delivery ($hostname)" "WARN" "Content delivered but may not be HTML" "accessibility" "Content length: ${#content} chars"
                fi
            else
                record_test_result "Content Delivery ($hostname)" "FAIL" "No content delivered" "accessibility" "Empty response"
            fi
        fi
        
        # Test 404 handling
        local not_found_response=$(curl -s -o /dev/null -w "%{http_code}" "https://$hostname/nonexistent-test-page-$(date +%s)" --max-time 10 2>/dev/null || echo "000")
        if [ "$not_found_response" = "404" ]; then
            record_test_result "404 Handling ($hostname)" "PASS" "Proper 404 response for missing pages" "accessibility" "Response: HTTP $not_found_response"
        elif [ "$not_found_response" = "200" ]; then
            record_test_result "404 Handling ($hostname)" "PASS" "SPA routing - returns 200 for all routes" "accessibility" "Response: HTTP $not_found_response (SPA)"
        else
            record_test_result "404 Handling ($hostname)" "WARN" "Unexpected response for missing pages" "accessibility" "Response: HTTP $not_found_response"
        fi
    done
}

# Function to test performance
test_performance() {
    local env="$1"
    
    print_step "Testing performance for $env environment"
    
    local config_lines=($(get_environment_config "$env"))
    
    for config_line in "${config_lines[@]}"; do
        IFS=':' read -r hostname swa_name resource_group <<< "$config_line"
        
        if ! command -v curl &>/dev/null; then
            record_test_result "Performance Testing Tools" "WARN" "curl not available - skipping performance tests for $hostname" "performance"
            continue
        fi
        
        # Test response time
        local response_time=$(curl -s -o /dev/null -w "%{time_total}" "https://$hostname" --max-time 30 2>/dev/null || echo "0")
        local response_time_ms=$(echo "$response_time * 1000" | bc -l 2>/dev/null | cut -d'.' -f1 || echo "0")
        
        if [ "$response_time_ms" -lt 1000 ]; then
            record_test_result "Response Time ($hostname)" "PASS" "${response_time_ms}ms (excellent)" "performance" "Target: <1s"
        elif [ "$response_time_ms" -lt 3000 ]; then
            record_test_result "Response Time ($hostname)" "PASS" "${response_time_ms}ms (good)" "performance" "Target: <3s"
        elif [ "$response_time_ms" -lt 5000 ]; then
            record_test_result "Response Time ($hostname)" "WARN" "${response_time_ms}ms (acceptable)" "performance" "Target: <5s"
        else
            record_test_result "Response Time ($hostname)" "FAIL" "${response_time_ms}ms (slow)" "performance" "Target: <5s"
        fi
        
        # Test DNS resolution time
        local dns_time=$(curl -s -o /dev/null -w "%{time_namelookup}" "https://$hostname" --max-time 30 2>/dev/null || echo "0")
        local dns_time_ms=$(echo "$dns_time * 1000" | bc -l 2>/dev/null | cut -d'.' -f1 || echo "0")
        
        if [ "$dns_time_ms" -lt 100 ]; then
            record_test_result "DNS Resolution Time ($hostname)" "PASS" "${dns_time_ms}ms (excellent)" "performance" "Target: <100ms"
        elif [ "$dns_time_ms" -lt 500 ]; then
            record_test_result "DNS Resolution Time ($hostname)" "PASS" "${dns_time_ms}ms (good)" "performance" "Target: <500ms"
        else
            record_test_result "DNS Resolution Time ($hostname)" "WARN" "${dns_time_ms}ms (slow)" "performance" "Target: <500ms"
        fi
        
        # Test SSL handshake time
        local ssl_time=$(curl -s -o /dev/null -w "%{time_connect}" "https://$hostname" --max-time 30 2>/dev/null || echo "0")
        local ssl_time_ms=$(echo "$ssl_time * 1000" | bc -l 2>/dev/null | cut -d'.' -f1 || echo "0")
        
        if [ "$ssl_time_ms" -lt 500 ]; then
            record_test_result "SSL Handshake Time ($hostname)" "PASS" "${ssl_time_ms}ms (excellent)" "performance" "Target: <500ms"
        elif [ "$ssl_time_ms" -lt 1000 ]; then
            record_test_result "SSL Handshake Time ($hostname)" "PASS" "${ssl_time_ms}ms (good)" "performance" "Target: <1s"
        else
            record_test_result "SSL Handshake Time ($hostname)" "WARN" "${ssl_time_ms}ms (slow)" "performance" "Target: <1s"
        fi
        
        # Test compression
        local content_encoding=$(curl -s -I -H "Accept-Encoding: gzip, deflate, br" "https://$hostname" --max-time 10 2>/dev/null | grep -i "content-encoding:" | cut -d':' -f2 | tr -d '\r\n' | xargs || echo "")
        if [[ "$content_encoding" == *"gzip"* ]] || [[ "$content_encoding" == *"br"* ]] || [[ "$content_encoding" == *"deflate"* ]]; then
            record_test_result "Content Compression ($hostname)" "PASS" "Content compressed: $content_encoding" "performance" "Encoding: $content_encoding"
        else
            record_test_result "Content Compression ($hostname)" "WARN" "Content not compressed" "performance" "No compression detected"
        fi
    done
}

# Function to test security headers
test_security_headers() {
    local env="$1"
    
    print_step "Testing security headers for $env environment"
    
    local config_lines=($(get_environment_config "$env"))
    
    for config_line in "${config_lines[@]}"; do
        IFS=':' read -r hostname swa_name resource_group <<< "$config_line"
        
        if ! command -v curl &>/dev/null; then
            record_test_result "Security Testing Tools" "WARN" "curl not available - skipping security tests for $hostname" "security"
            continue
        fi
        
        # Get response headers
        local headers=$(curl -s -I "https://$hostname" --max-time 10 2>/dev/null || echo "")
        
        if [ -n "$headers" ]; then
            # Test security headers
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
                    record_test_result "Security Header: $display_name ($hostname)" "PASS" "Header present: $header_value" "security" "Header: $header_name"
                else
                    if [ "$header_name" = "content-security-policy" ] || [ "$header_name" = "x-xss-protection" ]; then
                        record_test_result "Security Header: $display_name ($hostname)" "WARN" "Optional security header not found" "security" "Header: $header_name"
                    else
                        record_test_result "Security Header: $display_name ($hostname)" "WARN" "Important security header not found" "security" "Header: $header_name"
                    fi
                fi
            done
            
            # Test server header disclosure
            if echo "$headers" | grep -qi "server:"; then
                local server_header=$(echo "$headers" | grep -i "server:" | cut -d':' -f2- | tr -d '\r\n' | xargs)
                if [ ${#server_header} -lt 20 ]; then
                    record_test_result "Server Header Disclosure ($hostname)" "PASS" "Minimal server info: $server_header" "security" "Header: $server_header"
                else
                    record_test_result "Server Header Disclosure ($hostname)" "WARN" "Verbose server info: $server_header" "security" "Header: $server_header"
                fi
            else
                record_test_result "Server Header Disclosure ($hostname)" "PASS" "Server header not disclosed" "security" "No server header"
            fi
        else
            record_test_result "Security Headers ($hostname)" "FAIL" "Could not retrieve headers" "security" "Connection failed"
        fi
    done
}

# Function to test Azure integration
test_azure_integration() {
    local env="$1"
    
    print_step "Testing Azure integration for $env environment"
    
    local config_lines=($(get_environment_config "$env"))
    
    for config_line in "${config_lines[@]}"; do
        IFS=':' read -r hostname swa_name resource_group <<< "$config_line"
        
        # Test Azure Static Web App status
        if command -v az &>/dev/null && az account show &>/dev/null; then
            if az staticwebapp show --name "$swa_name" --resource-group "$resource_group" &>/dev/null; then
                local swa_state=$(az staticwebapp show --name "$swa_name" --resource-group "$resource_group" --query "state" -o tsv 2>/dev/null || echo "unknown")
                if [ "$swa_state" = "Ready" ]; then
                    record_test_result "Azure Static Web App Status ($hostname)" "PASS" "State: $swa_state" "integration" "SWA: $swa_name"
                else
                    record_test_result "Azure Static Web App Status ($hostname)" "WARN" "State: $swa_state" "integration" "SWA: $swa_name"
                fi
                
                # Test custom domain configuration
                if az staticwebapp hostname show --name "$swa_name" --resource-group "$resource_group" --hostname "$hostname" &>/dev/null; then
                    local domain_status=$(az staticwebapp hostname show --name "$swa_name" --resource-group "$resource_group" --hostname "$hostname" --query "status" -o tsv 2>/dev/null || echo "unknown")
                    local ssl_state=$(az staticwebapp hostname show --name "$swa_name" --resource-group "$resource_group" --hostname "$hostname" --query "sslState" -o tsv 2>/dev/null || echo "unknown")
                    
                    if [ "$domain_status" = "Ready" ]; then
                        record_test_result "Custom Domain Status ($hostname)" "PASS" "Domain status: $domain_status" "integration" "SSL state: $ssl_state"
                    else
                        record_test_result "Custom Domain Status ($hostname)" "FAIL" "Domain status: $domain_status" "integration" "SSL state: $ssl_state"
                    fi
                    
                    if [ "$ssl_state" = "Ready" ]; then
                        record_test_result "SSL Configuration ($hostname)" "PASS" "SSL state: $ssl_state" "integration" "Domain: $hostname"
                    else
                        record_test_result "SSL Configuration ($hostname)" "FAIL" "SSL state: $ssl_state" "integration" "Domain: $hostname"
                    fi
                else
                    record_test_result "Custom Domain Configuration ($hostname)" "FAIL" "Custom domain not configured in Azure" "integration" "SWA: $swa_name"
                fi
            else
                record_test_result "Azure Static Web App ($hostname)" "FAIL" "Static Web App not found" "integration" "SWA: $swa_name, RG: $resource_group"
            fi
        else
            record_test_result "Azure CLI Access" "WARN" "Azure CLI not available or not logged in - skipping Azure integration tests" "integration" "Install Azure CLI and run 'az login'"
        fi
    done
}

# Function to generate comprehensive test report
generate_test_report() {
    if [ "$REPORT" = false ]; then
        return 0
    fi
    
    print_step "Generating comprehensive domain and SSL validation report"
    
    local report_file="$REPORT_DIR/domain-ssl-validation-report-${ENVIRONMENT}-${DOMAIN}-$(date +%Y%m%d-%H%M%S).json"
    
    local report_data="{
        \"environment\": \"$ENVIRONMENT\",
        \"domain\": \"$DOMAIN\",
        \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
        \"test_configuration\": {
            \"comprehensive\": $COMPREHENSIVE,
            \"dns\": $DNS,
            \"ssl\": $SSL,
            \"accessibility\": $ACCESSIBILITY,
            \"performance\": $PERFORMANCE,
            \"security\": $SECURITY,
            \"integration\": $INTEGRATION
        },
        \"summary\": {
            \"total_tests\": $TOTAL_TESTS,
            \"passed\": $PASSED_TESTS,
            \"failed\": $FAILED_TESTS,
            \"warnings\": $WARNING_TESTS,
            \"success_rate\": $(echo "scale=2; $PASSED_TESTS * 100 / $TOTAL_TESTS" | bc -l 2>/dev/null || echo "0")
        },
        \"test_categories\": {
            \"dns\": $(echo "${TEST_RESULTS[*]}" | grep -c '\"category\":\"dns\"' || echo "0"),
            \"ssl\": $(echo "${TEST_RESULTS[*]}" | grep -c '\"category\":\"ssl\"' || echo "0"),
            \"accessibility\": $(echo "${TEST_RESULTS[*]}" | grep -c '\"category\":\"accessibility\"' || echo "0"),
            \"performance\": $(echo "${TEST_RESULTS[*]}" | grep -c '\"category\":\"performance\"' || echo "0"),
            \"security\": $(echo "${TEST_RESULTS[*]}" | grep -c '\"category\":\"security\"' || echo "0"),
            \"integration\": $(echo "${TEST_RESULTS[*]}" | grep -c '\"category\":\"integration\"' || echo "0")
        },
        \"tests\": [$(IFS=,; echo "${TEST_RESULTS[*]}")]
    }"
    
    echo "$report_data" | jq '.' > "$report_file" 2>/dev/null || echo "$report_data" > "$report_file"
    print_success "Domain and SSL validation report generated: $report_file"
}

# Function to process single environment
process_environment() {
    local env="$1"
    
    print_header "TESTING DOMAIN AND SSL VALIDATION - $env ENVIRONMENT"
    
    # Test DNS configuration
    if [ "$DNS" = true ]; then
        test_dns_configuration "$env"
    fi
    
    # Test SSL certificates
    if [ "$SSL" = true ]; then
        test_ssl_certificates "$env"
    fi
    
    # Test domain accessibility
    if [ "$ACCESSIBILITY" = true ]; then
        test_domain_accessibility "$env"
    fi
    
    # Test performance
    if [ "$PERFORMANCE" = true ]; then
        test_performance "$env"
    fi
    
    # Test security headers
    if [ "$SECURITY" = true ]; then
        test_security_headers "$env"
    fi
    
    # Test Azure integration
    if [ "$INTEGRATION" = true ]; then
        test_azure_integration "$env"
    fi
}

# Main function
main() {
    print_header "TAKTMATE DOMAIN ACCESSIBILITY AND SSL CERTIFICATE VALIDATION"
    print_status "Environment: $ENVIRONMENT"
    print_status "Domain: $DOMAIN"
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
    print_header "DOMAIN AND SSL VALIDATION SUMMARY"
    echo "Total Tests: $TOTAL_TESTS"
    echo "Passed: $PASSED_TESTS"
    echo "Failed: $FAILED_TESTS"
    echo "Warnings: $WARNING_TESTS"
    
    if [ $TOTAL_TESTS -gt 0 ]; then
        local success_rate=$(echo "scale=1; $PASSED_TESTS * 100 / $TOTAL_TESTS" | bc -l 2>/dev/null || echo "0")
        echo "Success Rate: ${success_rate}%"
    fi
    
    if [ $FAILED_TESTS -gt 0 ]; then
        print_header "SOME DOMAIN/SSL TESTS FAILED! ❌"
        echo ""
        echo "Common issues and solutions:"
        echo "1. DNS propagation may still be in progress (up to 48 hours)"
        echo "2. SSL certificates may take up to 24 hours to provision"
        echo "3. Custom domains may need configuration in Azure Static Web Apps"
        echo "4. Check Azure CLI authentication for integration tests"
        echo "5. Verify domain accessibility and security configuration"
        exit 1
    elif [ $WARNING_TESTS -gt 0 ]; then
        print_header "DOMAIN/SSL VALIDATION COMPLETED WITH WARNINGS! ⚠️"
        echo ""
        echo "Review warnings above - some may be expected during initial setup"
        exit 0
    else
        print_header "ALL DOMAIN AND SSL VALIDATION TESTS PASSED! ✅"
        exit 0
    fi
}

# Execute main function
main "$@"
