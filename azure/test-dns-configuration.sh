#!/bin/bash

# TaktMate DNS Configuration Testing Script
# Usage: ./test-dns-configuration.sh [environment] [domain] [options]
# Example: ./test-dns-configuration.sh production taktconnect.com --comprehensive --report

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
    echo "TaktMate DNS Configuration Testing"
    echo ""
    echo "Usage: $0 [environment] [domain] [options]"
    echo ""
    echo "Environments:"
    echo "  production  - Test production DNS configuration"
    echo "  staging     - Test staging DNS configuration"
    echo "  development - Test development DNS configuration"
    echo ""
    echo "Domains:"
    echo "  taktconnect.com - Primary domain for TaktMate application"
    echo "  taktmate.com    - Alternative domain (if available)"
    echo ""
    echo "Options:"
    echo "  --comprehensive     Run comprehensive DNS tests including propagation"
    echo "  --propagation       Test DNS propagation across multiple servers"
    echo "  --ssl               Test SSL certificate configuration"
    echo "  --report            Generate detailed test report"
    echo "  --verbose           Enable verbose output"
    echo "  --help              Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 production taktconnect.com --comprehensive --report"
    echo "  $0 staging taktconnect.com --propagation --ssl"
    echo "  $0 production taktconnect.com --verbose"
}

# Parse arguments
ENVIRONMENT=""
DOMAIN=""
COMPREHENSIVE=false
PROPAGATION=false
SSL=false
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
            PROPAGATION=true
            SSL=true
            shift
            ;;
        --propagation)
            PROPAGATION=true
            shift
            ;;
        --ssl)
            SSL=true
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
        FRONTEND_FULL_DOMAIN="${SUBDOMAIN}.${DOMAIN}"
        BACKEND_FULL_DOMAIN="api.${DOMAIN}"
        WWW_DOMAIN="www.${DOMAIN}"
        ;;
    "staging")
        SUBDOMAIN="staging"
        RESOURCE_GROUP="taktmate-staging-rg"
        FRONTEND_FULL_DOMAIN="${SUBDOMAIN}.${DOMAIN}"
        BACKEND_FULL_DOMAIN="api-staging.${DOMAIN}"
        WWW_DOMAIN=""
        ;;
    "development")
        SUBDOMAIN="dev"
        RESOURCE_GROUP="taktmate-dev-rg"
        FRONTEND_FULL_DOMAIN="${SUBDOMAIN}.${DOMAIN}"
        BACKEND_FULL_DOMAIN="api-dev.${DOMAIN}"
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

# Function to test DNS zone configuration
test_dns_zone() {
    print_step "Testing DNS zone configuration"
    
    # Check if DNS zone exists in Azure
    if az network dns zone show --name "$DOMAIN" --resource-group "$RESOURCE_GROUP" &>/dev/null; then
        record_test_result "DNS Zone Exists" "PASS" "Zone found in Azure: $DOMAIN" "infrastructure"
        
        # Get and display name servers
        local name_servers=$(az network dns zone show --name "$DOMAIN" --resource-group "$RESOURCE_GROUP" --query "nameServers" -o tsv | tr '\n' ' ')
        if [ -n "$name_servers" ]; then
            record_test_result "Name Servers Available" "PASS" "Name servers configured" "infrastructure"
            if [ "$VERBOSE" = true ]; then
                echo "Name servers: $name_servers"
            fi
        else
            record_test_result "Name Servers Available" "FAIL" "No name servers found" "infrastructure"
        fi
    else
        record_test_result "DNS Zone Exists" "FAIL" "Zone not found in Azure: $DOMAIN" "infrastructure"
    fi
}

# Function to test CNAME records
test_cname_records() {
    print_step "Testing CNAME record configuration"
    
    # Test frontend CNAME record
    if az network dns record-set cname show --name "$SUBDOMAIN" --zone-name "$DOMAIN" --resource-group "$RESOURCE_GROUP" &>/dev/null; then
        local frontend_target=$(az network dns record-set cname show --name "$SUBDOMAIN" --zone-name "$DOMAIN" --resource-group "$RESOURCE_GROUP" --query "cname" -o tsv)
        record_test_result "Frontend CNAME Record" "PASS" "$FRONTEND_FULL_DOMAIN → $frontend_target" "dns_records"
    else
        record_test_result "Frontend CNAME Record" "FAIL" "CNAME record not found for $FRONTEND_FULL_DOMAIN" "dns_records"
    fi
    
    # Test backend CNAME record
    local backend_subdomain=""
    case "$ENVIRONMENT" in
        "production") backend_subdomain="api" ;;
        "staging") backend_subdomain="api-staging" ;;
        "development") backend_subdomain="api-dev" ;;
    esac
    
    if az network dns record-set cname show --name "$backend_subdomain" --zone-name "$DOMAIN" --resource-group "$RESOURCE_GROUP" &>/dev/null; then
        local backend_target=$(az network dns record-set cname show --name "$backend_subdomain" --zone-name "$DOMAIN" --resource-group "$RESOURCE_GROUP" --query "cname" -o tsv)
        record_test_result "Backend CNAME Record" "PASS" "$BACKEND_FULL_DOMAIN → $backend_target" "dns_records"
    else
        record_test_result "Backend CNAME Record" "FAIL" "CNAME record not found for $BACKEND_FULL_DOMAIN" "dns_records"
    fi
    
    # Test www CNAME record (production only)
    if [ "$ENVIRONMENT" = "production" ] && [ -n "$WWW_DOMAIN" ]; then
        if az network dns record-set cname show --name "www" --zone-name "$DOMAIN" --resource-group "$RESOURCE_GROUP" &>/dev/null; then
            local www_target=$(az network dns record-set cname show --name "www" --zone-name "$DOMAIN" --resource-group "$RESOURCE_GROUP" --query "cname" -o tsv)
            record_test_result "WWW CNAME Record" "PASS" "$WWW_DOMAIN → $www_target" "dns_records"
        else
            record_test_result "WWW CNAME Record" "WARN" "WWW CNAME record not found (optional)" "dns_records"
        fi
    fi
}

# Function to test DNS resolution
test_dns_resolution() {
    print_step "Testing DNS resolution"
    
    # Test frontend DNS resolution
    if command -v nslookup &>/dev/null; then
        if nslookup "$FRONTEND_FULL_DOMAIN" &>/dev/null; then
            local resolved_ip=$(nslookup "$FRONTEND_FULL_DOMAIN" | grep -A1 "Name:" | tail -1 | awk '{print $2}' || echo "unknown")
            record_test_result "Frontend DNS Resolution" "PASS" "$FRONTEND_FULL_DOMAIN resolves to $resolved_ip" "dns_resolution"
        else
            record_test_result "Frontend DNS Resolution" "FAIL" "$FRONTEND_FULL_DOMAIN does not resolve" "dns_resolution"
        fi
        
        # Test backend DNS resolution
        if nslookup "$BACKEND_FULL_DOMAIN" &>/dev/null; then
            local backend_resolved_ip=$(nslookup "$BACKEND_FULL_DOMAIN" | grep -A1 "Name:" | tail -1 | awk '{print $2}' || echo "unknown")
            record_test_result "Backend DNS Resolution" "PASS" "$BACKEND_FULL_DOMAIN resolves to $backend_resolved_ip" "dns_resolution"
        else
            record_test_result "Backend DNS Resolution" "FAIL" "$BACKEND_FULL_DOMAIN does not resolve" "dns_resolution"
        fi
        
        # Test www DNS resolution (production only)
        if [ "$ENVIRONMENT" = "production" ] && [ -n "$WWW_DOMAIN" ]; then
            if nslookup "$WWW_DOMAIN" &>/dev/null; then
                local www_resolved_ip=$(nslookup "$WWW_DOMAIN" | grep -A1 "Name:" | tail -1 | awk '{print $2}' || echo "unknown")
                record_test_result "WWW DNS Resolution" "PASS" "$WWW_DOMAIN resolves to $www_resolved_ip" "dns_resolution"
            else
                record_test_result "WWW DNS Resolution" "WARN" "$WWW_DOMAIN does not resolve (optional)" "dns_resolution"
            fi
        fi
    else
        record_test_result "DNS Resolution Tools" "WARN" "nslookup not available - skipping resolution tests" "dns_resolution"
    fi
}

# Function to test DNS propagation across multiple servers
test_dns_propagation() {
    if [ "$PROPAGATION" = false ]; then
        return 0
    fi
    
    print_step "Testing DNS propagation across multiple servers"
    
    # List of public DNS servers to test against
    local dns_servers=(
        "8.8.8.8"          # Google DNS
        "1.1.1.1"          # Cloudflare DNS
        "208.67.222.222"   # OpenDNS
        "9.9.9.9"          # Quad9 DNS
    )
    
    local dns_server_names=(
        "Google DNS"
        "Cloudflare DNS"
        "OpenDNS"
        "Quad9 DNS"
    )
    
    if command -v dig &>/dev/null; then
        for i in "${!dns_servers[@]}"; do
            local server="${dns_servers[$i]}"
            local server_name="${dns_server_names[$i]}"
            
            # Test frontend domain propagation
            if dig "@$server" "$FRONTEND_FULL_DOMAIN" +short &>/dev/null; then
                local result=$(dig "@$server" "$FRONTEND_FULL_DOMAIN" +short | head -1)
                if [ -n "$result" ]; then
                    record_test_result "Propagation: $server_name (Frontend)" "PASS" "$FRONTEND_FULL_DOMAIN → $result" "propagation"
                else
                    record_test_result "Propagation: $server_name (Frontend)" "FAIL" "No result from $server_name" "propagation"
                fi
            else
                record_test_result "Propagation: $server_name (Frontend)" "FAIL" "Query failed to $server_name" "propagation"
            fi
            
            # Test backend domain propagation
            if dig "@$server" "$BACKEND_FULL_DOMAIN" +short &>/dev/null; then
                local backend_result=$(dig "@$server" "$BACKEND_FULL_DOMAIN" +short | head -1)
                if [ -n "$backend_result" ]; then
                    record_test_result "Propagation: $server_name (Backend)" "PASS" "$BACKEND_FULL_DOMAIN → $backend_result" "propagation"
                else
                    record_test_result "Propagation: $server_name (Backend)" "FAIL" "No result from $server_name" "propagation"
                fi
            else
                record_test_result "Propagation: $server_name (Backend)" "FAIL" "Query failed to $server_name" "propagation"
            fi
        done
    else
        record_test_result "DNS Propagation Tools" "WARN" "dig not available - skipping propagation tests" "propagation"
    fi
}

# Function to test HTTP/HTTPS accessibility
test_http_accessibility() {
    print_step "Testing HTTP/HTTPS accessibility"
    
    if command -v curl &>/dev/null; then
        # Test frontend HTTP accessibility
        local frontend_http_response=$(curl -s -o /dev/null -w "%{http_code}" "http://$FRONTEND_FULL_DOMAIN" --max-time 10 2>/dev/null || echo "000")
        if [ "$frontend_http_response" = "200" ] || [ "$frontend_http_response" = "301" ] || [ "$frontend_http_response" = "302" ]; then
            record_test_result "Frontend HTTP Access" "PASS" "HTTP $frontend_http_response response from $FRONTEND_FULL_DOMAIN" "http_access"
        else
            record_test_result "Frontend HTTP Access" "FAIL" "HTTP $frontend_http_response response from $FRONTEND_FULL_DOMAIN" "http_access"
        fi
        
        # Test frontend HTTPS accessibility
        local frontend_https_response=$(curl -s -o /dev/null -w "%{http_code}" "https://$FRONTEND_FULL_DOMAIN" --max-time 10 2>/dev/null || echo "000")
        if [ "$frontend_https_response" = "200" ] || [ "$frontend_https_response" = "301" ] || [ "$frontend_https_response" = "302" ]; then
            record_test_result "Frontend HTTPS Access" "PASS" "HTTPS $frontend_https_response response from $FRONTEND_FULL_DOMAIN" "http_access"
        else
            record_test_result "Frontend HTTPS Access" "WARN" "HTTPS $frontend_https_response response from $FRONTEND_FULL_DOMAIN (may need SSL setup)" "http_access"
        fi
        
        # Test backend API HTTP accessibility
        local backend_http_response=$(curl -s -o /dev/null -w "%{http_code}" "http://$BACKEND_FULL_DOMAIN/api/health" --max-time 10 2>/dev/null || echo "000")
        if [ "$backend_http_response" = "200" ] || [ "$backend_http_response" = "301" ] || [ "$backend_http_response" = "302" ]; then
            record_test_result "Backend HTTP Access" "PASS" "HTTP $backend_http_response response from $BACKEND_FULL_DOMAIN" "http_access"
        else
            record_test_result "Backend HTTP Access" "FAIL" "HTTP $backend_http_response response from $BACKEND_FULL_DOMAIN" "http_access"
        fi
        
        # Test backend API HTTPS accessibility
        local backend_https_response=$(curl -s -o /dev/null -w "%{http_code}" "https://$BACKEND_FULL_DOMAIN/api/health" --max-time 10 2>/dev/null || echo "000")
        if [ "$backend_https_response" = "200" ] || [ "$backend_https_response" = "301" ] || [ "$backend_https_response" = "302" ]; then
            record_test_result "Backend HTTPS Access" "PASS" "HTTPS $backend_https_response response from $BACKEND_FULL_DOMAIN" "http_access"
        else
            record_test_result "Backend HTTPS Access" "WARN" "HTTPS $backend_https_response response from $BACKEND_FULL_DOMAIN (may need SSL setup)" "http_access"
        fi
    else
        record_test_result "HTTP Accessibility Tools" "WARN" "curl not available - skipping HTTP accessibility tests" "http_access"
    fi
}

# Function to test SSL certificate configuration
test_ssl_certificates() {
    if [ "$SSL" = false ]; then
        return 0
    fi
    
    print_step "Testing SSL certificate configuration"
    
    if command -v openssl &>/dev/null; then
        # Test frontend SSL certificate
        local frontend_ssl_info=$(echo | openssl s_client -servername "$FRONTEND_FULL_DOMAIN" -connect "$FRONTEND_FULL_DOMAIN:443" 2>/dev/null | openssl x509 -noout -dates 2>/dev/null || echo "")
        if [ -n "$frontend_ssl_info" ]; then
            local frontend_expiry=$(echo "$frontend_ssl_info" | grep "notAfter=" | cut -d'=' -f2)
            record_test_result "Frontend SSL Certificate" "PASS" "SSL certificate valid, expires: $frontend_expiry" "ssl"
        else
            record_test_result "Frontend SSL Certificate" "WARN" "SSL certificate not available or invalid" "ssl"
        fi
        
        # Test backend SSL certificate
        local backend_ssl_info=$(echo | openssl s_client -servername "$BACKEND_FULL_DOMAIN" -connect "$BACKEND_FULL_DOMAIN:443" 2>/dev/null | openssl x509 -noout -dates 2>/dev/null || echo "")
        if [ -n "$backend_ssl_info" ]; then
            local backend_expiry=$(echo "$backend_ssl_info" | grep "notAfter=" | cut -d'=' -f2)
            record_test_result "Backend SSL Certificate" "PASS" "SSL certificate valid, expires: $backend_expiry" "ssl"
        else
            record_test_result "Backend SSL Certificate" "WARN" "SSL certificate not available or invalid" "ssl"
        fi
        
        # Test SSL certificate chain
        if echo | openssl s_client -servername "$FRONTEND_FULL_DOMAIN" -connect "$FRONTEND_FULL_DOMAIN:443" -verify_return_error 2>/dev/null >/dev/null; then
            record_test_result "Frontend SSL Chain Validation" "PASS" "SSL certificate chain is valid" "ssl"
        else
            record_test_result "Frontend SSL Chain Validation" "WARN" "SSL certificate chain validation failed" "ssl"
        fi
    else
        record_test_result "SSL Testing Tools" "WARN" "openssl not available - skipping SSL certificate tests" "ssl"
    fi
}

# Function to test DNS record TTL values
test_dns_ttl() {
    print_step "Testing DNS TTL configuration"
    
    if command -v dig &>/dev/null; then
        # Test frontend CNAME TTL
        local frontend_ttl=$(dig "$FRONTEND_FULL_DOMAIN" | grep -E "^$FRONTEND_FULL_DOMAIN" | awk '{print $2}' | head -1)
        if [ -n "$frontend_ttl" ] && [ "$frontend_ttl" -gt 0 ]; then
            if [ "$frontend_ttl" -le 3600 ]; then  # TTL <= 1 hour is good for changes
                record_test_result "Frontend DNS TTL" "PASS" "TTL is $frontend_ttl seconds (good for updates)" "dns_config"
            else
                record_test_result "Frontend DNS TTL" "WARN" "TTL is $frontend_ttl seconds (may slow updates)" "dns_config"
            fi
        else
            record_test_result "Frontend DNS TTL" "WARN" "Could not determine TTL value" "dns_config"
        fi
        
        # Test backend CNAME TTL
        local backend_ttl=$(dig "$BACKEND_FULL_DOMAIN" | grep -E "^$BACKEND_FULL_DOMAIN" | awk '{print $2}' | head -1)
        if [ -n "$backend_ttl" ] && [ "$backend_ttl" -gt 0 ]; then
            if [ "$backend_ttl" -le 3600 ]; then  # TTL <= 1 hour is good for changes
                record_test_result "Backend DNS TTL" "PASS" "TTL is $backend_ttl seconds (good for updates)" "dns_config"
            else
                record_test_result "Backend DNS TTL" "WARN" "TTL is $backend_ttl seconds (may slow updates)" "dns_config"
            fi
        else
            record_test_result "Backend DNS TTL" "WARN" "Could not determine TTL value" "dns_config"
        fi
    else
        record_test_result "DNS TTL Tools" "WARN" "dig not available - skipping TTL tests" "dns_config"
    fi
}

# Function to generate test report
generate_test_report() {
    if [ "$REPORT" = false ]; then
        return 0
    fi
    
    print_step "Generating DNS test report"
    
    local report_file="$REPORT_DIR/dns-test-report-${ENVIRONMENT}-${DOMAIN}-$(date +%Y%m%d-%H%M%S).json"
    
    local report_data="{
        \"environment\": \"$ENVIRONMENT\",
        \"domain\": \"$DOMAIN\",
        \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
        \"domains_tested\": {
            \"frontend\": \"$FRONTEND_FULL_DOMAIN\",
            \"backend\": \"$BACKEND_FULL_DOMAIN\",
            \"www\": \"$WWW_DOMAIN\"
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
            \"dns_records\": $(echo "${TEST_RESULTS[*]}" | grep -c '"category":"dns_records"' || echo "0"),
            \"dns_resolution\": $(echo "${TEST_RESULTS[*]}" | grep -c '"category":"dns_resolution"' || echo "0"),
            \"propagation\": $(echo "${TEST_RESULTS[*]}" | grep -c '"category":"propagation"' || echo "0"),
            \"http_access\": $(echo "${TEST_RESULTS[*]}" | grep -c '"category":"http_access"' || echo "0"),
            \"ssl\": $(echo "${TEST_RESULTS[*]}" | grep -c '"category":"ssl"' || echo "0"),
            \"dns_config\": $(echo "${TEST_RESULTS[*]}" | grep -c '"category":"dns_config"' || echo "0")
        },
        \"tests\": [$(IFS=,; echo "${TEST_RESULTS[*]}")]
    }"
    
    echo "$report_data" | jq '.' > "$report_file" 2>/dev/null || echo "$report_data" > "$report_file"
    print_success "DNS test report generated: $report_file"
}

# Main function
main() {
    print_header "TAKTMATE DNS CONFIGURATION TESTING"
    print_status "Environment: $ENVIRONMENT"
    print_status "Domain: $DOMAIN"
    print_status "Frontend: $FRONTEND_FULL_DOMAIN"
    print_status "Backend: $BACKEND_FULL_DOMAIN"
    print_status "Comprehensive Testing: $COMPREHENSIVE"
    echo ""
    
    # Execute test phases
    test_dns_zone
    test_cname_records
    test_dns_resolution
    test_dns_propagation
    test_http_accessibility
    test_ssl_certificates
    test_dns_ttl
    generate_test_report
    
    # Print summary
    print_header "DNS TESTING SUMMARY"
    echo "Total Tests: $TOTAL_TESTS"
    echo "Passed: $PASSED_TESTS"
    echo "Failed: $FAILED_TESTS"
    echo "Warnings: $WARNING_TESTS"
    
    if [ $TOTAL_TESTS -gt 0 ]; then
        local success_rate=$(echo "scale=1; $PASSED_TESTS * 100 / $TOTAL_TESTS" | bc -l 2>/dev/null || echo "0")
        echo "Success Rate: ${success_rate}%"
    fi
    
    if [ $FAILED_TESTS -gt 0 ]; then
        print_header "SOME DNS TESTS FAILED! ❌"
        echo ""
        echo "Common issues and solutions:"
        echo "1. DNS propagation may take up to 48 hours"
        echo "2. Ensure name servers are configured at domain registrar"
        echo "3. Custom domains may need to be configured in Azure services"
        echo "4. SSL certificates may need to be set up after DNS propagation"
        exit 1
    elif [ $WARNING_TESTS -gt 0 ]; then
        print_header "DNS TESTS COMPLETED WITH WARNINGS! ⚠️"
        echo ""
        echo "Review warnings above - some may be expected during initial setup"
        exit 0
    else
        print_header "ALL DNS TESTS PASSED! ✅"
        exit 0
    fi
}

# Execute main function
main "$@"
