#!/bin/bash

# TaktMate CORS Functionality Testing Script
# Usage: ./test-cors-functionality.sh [environment] [domain] [options]
# Example: ./test-cors-functionality.sh production taktconnect.com --comprehensive --report

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
    echo "TaktMate CORS Functionality Testing"
    echo ""
    echo "Usage: $0 [environment] [domain] [options]"
    echo ""
    echo "Environments:"
    echo "  production  - Test production CORS configuration"
    echo "  staging     - Test staging CORS configuration"
    echo "  development - Test development CORS configuration"
    echo "  all         - Test all environments"
    echo ""
    echo "Domains:"
    echo "  taktconnect.com - Primary domain for TaktMate application"
    echo "  taktmate.com    - Alternative domain (if available)"
    echo ""
    echo "Options:"
    echo "  --comprehensive Test all CORS functionality aspects"
    echo "  --preflight     Test CORS preflight OPTIONS requests"
    echo "  --headers       Test CORS headers in responses"
    echo "  --origins       Test allowed and blocked origins"
    echo "  --methods       Test allowed HTTP methods"
    echo "  --credentials   Test credentials support"
    echo "  --browser       Test browser-specific CORS scenarios"
    echo "  --report        Generate detailed CORS test report"
    echo "  --verbose       Enable verbose output"
    echo "  --help          Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 production taktconnect.com --comprehensive --report"
    echo "  $0 all taktconnect.com --preflight --headers --origins"
    echo "  $0 staging taktconnect.com --browser --credentials --verbose"
}

# Parse arguments
ENVIRONMENT=""
DOMAIN=""
COMPREHENSIVE=false
PREFLIGHT=false
HEADERS=false
ORIGINS=false
METHODS=false
CREDENTIALS=false
BROWSER=false
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
            PREFLIGHT=true
            HEADERS=true
            ORIGINS=true
            METHODS=true
            CREDENTIALS=true
            BROWSER=true
            shift
            ;;
        --preflight)
            PREFLIGHT=true
            shift
            ;;
        --headers)
            HEADERS=true
            shift
            ;;
        --origins)
            ORIGINS=true
            shift
            ;;
        --methods)
            METHODS=true
            shift
            ;;
        --credentials)
            CREDENTIALS=true
            shift
            ;;
        --browser)
            BROWSER=true
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
CORS_TEST_RESULTS=()

# Function to record test result
record_cors_test_result() {
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
        CORS_TEST_RESULTS+=("$test_data")
    fi
}

# Function to get environment-specific configuration
get_environment_config() {
    local env="$1"
    
    case "$env" in
        "production")
            echo "https://app.${DOMAIN}:https://api.${DOMAIN}"
            echo "https://www.${DOMAIN}:https://taktmate-api-prod.azurewebsites.net"
            ;;
        "staging")
            echo "https://staging.${DOMAIN}:https://api-staging.${DOMAIN}"
            echo "https://staging.${DOMAIN}:https://taktmate-api-staging.azurewebsites.net"
            ;;
        "development")
            echo "http://localhost:3000:http://localhost:3001"
            echo "https://dev.${DOMAIN}:https://taktmate-api-dev.azurewebsites.net"
            ;;
    esac
}

# Function to test CORS preflight requests
test_cors_preflight() {
    local env="$1"
    
    print_step "Testing CORS preflight requests for $env environment"
    
    local config_lines=($(get_environment_config "$env"))
    
    for config_line in "${config_lines[@]}"; do
        IFS=':' read -r frontend_url backend_url <<< "$config_line"
        
        if ! command -v curl &>/dev/null; then
            record_cors_test_result "CORS Testing Tools" "WARN" "curl not available - skipping preflight tests" "preflight"
            continue
        fi
        
        # Test OPTIONS preflight request
        local preflight_response=$(curl -s -i \
            -X OPTIONS \
            -H "Origin: $frontend_url" \
            -H "Access-Control-Request-Method: POST" \
            -H "Access-Control-Request-Headers: Content-Type,Authorization" \
            "$backend_url/test" \
            --max-time 15 2>/dev/null || echo "HTTP/1.1 000 Connection Failed")
        
        # Extract status code
        local status_code=$(echo "$preflight_response" | head -1 | grep -o '[0-9][0-9][0-9]' | head -1)
        
        if [ "$status_code" = "200" ] || [ "$status_code" = "204" ]; then
            record_cors_test_result "Preflight Request ($(basename $frontend_url) → $(basename $backend_url))" "PASS" "Preflight successful (HTTP $status_code)" "preflight" "Origin: $frontend_url"
            
            # Check for required CORS headers in preflight response
            if echo "$preflight_response" | grep -qi "access-control-allow-origin"; then
                record_cors_test_result "Preflight Allow-Origin ($(basename $frontend_url) → $(basename $backend_url))" "PASS" "Access-Control-Allow-Origin header present" "preflight" "Response includes CORS headers"
            else
                record_cors_test_result "Preflight Allow-Origin ($(basename $frontend_url) → $(basename $backend_url))" "FAIL" "Access-Control-Allow-Origin header missing" "preflight" "No CORS headers in preflight response"
            fi
            
            if echo "$preflight_response" | grep -qi "access-control-allow-methods"; then
                local allowed_methods=$(echo "$preflight_response" | grep -i "access-control-allow-methods" | cut -d':' -f2 | tr -d '\r\n' | xargs)
                record_cors_test_result "Preflight Allow-Methods ($(basename $frontend_url) → $(basename $backend_url))" "PASS" "Methods: $allowed_methods" "preflight" "Allowed methods specified"
            else
                record_cors_test_result "Preflight Allow-Methods ($(basename $frontend_url) → $(basename $backend_url))" "WARN" "Access-Control-Allow-Methods header missing" "preflight" "Methods not specified in preflight"
            fi
            
            if echo "$preflight_response" | grep -qi "access-control-allow-headers"; then
                local allowed_headers=$(echo "$preflight_response" | grep -i "access-control-allow-headers" | cut -d':' -f2 | tr -d '\r\n' | xargs)
                record_cors_test_result "Preflight Allow-Headers ($(basename $frontend_url) → $(basename $backend_url))" "PASS" "Headers: $allowed_headers" "preflight" "Allowed headers specified"
            else
                record_cors_test_result "Preflight Allow-Headers ($(basename $frontend_url) → $(basename $backend_url))" "WARN" "Access-Control-Allow-Headers header missing" "preflight" "Headers not specified in preflight"
            fi
            
        elif [ "$status_code" = "000" ]; then
            record_cors_test_result "Preflight Request ($(basename $frontend_url) → $(basename $backend_url))" "WARN" "Backend not accessible" "preflight" "Connection failed to $backend_url"
        else
            record_cors_test_result "Preflight Request ($(basename $frontend_url) → $(basename $backend_url))" "FAIL" "Preflight failed (HTTP $status_code)" "preflight" "Origin: $frontend_url"
        fi
    done
}

# Function to test CORS headers in responses
test_cors_headers() {
    local env="$1"
    
    print_step "Testing CORS headers in responses for $env environment"
    
    local config_lines=($(get_environment_config "$env"))
    
    for config_line in "${config_lines[@]}"; do
        IFS=':' read -r frontend_url backend_url <<< "$config_line"
        
        if ! command -v curl &>/dev/null; then
            record_cors_test_result "CORS Headers Testing Tools" "WARN" "curl not available - skipping header tests" "headers"
            continue
        fi
        
        # Test actual request with Origin header
        local response_headers=$(curl -s -I \
            -H "Origin: $frontend_url" \
            "$backend_url/test" \
            --max-time 15 2>/dev/null || echo "")
        
        if [ -n "$response_headers" ]; then
            # Check for Access-Control-Allow-Origin
            if echo "$response_headers" | grep -qi "access-control-allow-origin"; then
                local allow_origin=$(echo "$response_headers" | grep -i "access-control-allow-origin" | cut -d':' -f2 | tr -d '\r\n' | xargs)
                if [ "$allow_origin" = "$frontend_url" ] || [ "$allow_origin" = "*" ]; then
                    record_cors_test_result "CORS Allow-Origin ($(basename $frontend_url) → $(basename $backend_url))" "PASS" "Origin allowed: $allow_origin" "headers" "Matches request origin"
                else
                    record_cors_test_result "CORS Allow-Origin ($(basename $frontend_url) → $(basename $backend_url))" "WARN" "Origin mismatch: $allow_origin" "headers" "Expected: $frontend_url"
                fi
            else
                record_cors_test_result "CORS Allow-Origin ($(basename $frontend_url) → $(basename $backend_url))" "FAIL" "Access-Control-Allow-Origin header missing" "headers" "No CORS origin header"
            fi
            
            # Check for Access-Control-Allow-Credentials
            if echo "$response_headers" | grep -qi "access-control-allow-credentials"; then
                local allow_credentials=$(echo "$response_headers" | grep -i "access-control-allow-credentials" | cut -d':' -f2 | tr -d '\r\n' | xargs)
                record_cors_test_result "CORS Allow-Credentials ($(basename $frontend_url) → $(basename $backend_url))" "PASS" "Credentials: $allow_credentials" "headers" "Credentials support configured"
            else
                record_cors_test_result "CORS Allow-Credentials ($(basename $frontend_url) → $(basename $backend_url))" "WARN" "Access-Control-Allow-Credentials header missing" "headers" "No credentials support indicated"
            fi
            
            # Check for Access-Control-Expose-Headers
            if echo "$response_headers" | grep -qi "access-control-expose-headers"; then
                local expose_headers=$(echo "$response_headers" | grep -i "access-control-expose-headers" | cut -d':' -f2 | tr -d '\r\n' | xargs)
                record_cors_test_result "CORS Expose-Headers ($(basename $frontend_url) → $(basename $backend_url))" "PASS" "Exposed headers: $expose_headers" "headers" "Custom headers exposed to frontend"
            else
                record_cors_test_result "CORS Expose-Headers ($(basename $frontend_url) → $(basename $backend_url))" "WARN" "Access-Control-Expose-Headers header missing" "headers" "No custom headers exposed"
            fi
            
        else
            record_cors_test_result "CORS Headers ($(basename $frontend_url) → $(basename $backend_url))" "FAIL" "Could not retrieve response headers" "headers" "Connection failed to $backend_url"
        fi
    done
}

# Function to test origin validation
test_origin_validation() {
    local env="$1"
    
    print_step "Testing origin validation for $env environment"
    
    local config_lines=($(get_environment_config "$env"))
    
    # Test allowed origins
    for config_line in "${config_lines[@]}"; do
        IFS=':' read -r frontend_url backend_url <<< "$config_line"
        
        # Test allowed origin
        local allowed_response=$(curl -s -o /dev/null -w "%{http_code}" \
            -H "Origin: $frontend_url" \
            "$backend_url/test" \
            --max-time 10 2>/dev/null || echo "000")
        
        if [ "$allowed_response" = "200" ]; then
            record_cors_test_result "Allowed Origin ($(basename $frontend_url))" "PASS" "Origin accepted (HTTP $allowed_response)" "origins" "Origin: $frontend_url"
        elif [ "$allowed_response" = "000" ]; then
            record_cors_test_result "Allowed Origin ($(basename $frontend_url))" "WARN" "Backend not accessible" "origins" "URL: $backend_url"
        else
            record_cors_test_result "Allowed Origin ($(basename $frontend_url))" "FAIL" "Origin rejected (HTTP $allowed_response)" "origins" "Origin: $frontend_url"
        fi
    done
    
    # Test blocked origins
    local blocked_origins=(
        "https://evil.example.com"
        "https://malicious.site"
        "http://unauthorized.domain"
        "https://phishing.example"
    )
    
    for config_line in "${config_lines[@]}"; do
        IFS=':' read -r frontend_url backend_url <<< "$config_line"
        
        # Only test one backend URL to avoid redundancy
        if [[ "$backend_url" == *"localhost"* ]] || [[ "$backend_url" == *"azurewebsites.net"* ]]; then
            for blocked_origin in "${blocked_origins[@]}"; do
                local blocked_response=$(curl -s -o /dev/null -w "%{http_code}" \
                    -H "Origin: $blocked_origin" \
                    "$backend_url/test" \
                    --max-time 10 2>/dev/null || echo "000")
                
                if [ "$blocked_response" = "403" ] || [ "$blocked_response" = "400" ]; then
                    record_cors_test_result "Blocked Origin ($(basename $blocked_origin))" "PASS" "Origin correctly blocked (HTTP $blocked_response)" "origins" "Origin: $blocked_origin"
                elif [ "$blocked_response" = "200" ]; then
                    # In development mode, this might be expected
                    if [ "$env" = "development" ]; then
                        record_cors_test_result "Blocked Origin ($(basename $blocked_origin))" "WARN" "Origin allowed in development mode" "origins" "Origin: $blocked_origin"
                    else
                        record_cors_test_result "Blocked Origin ($(basename $blocked_origin))" "FAIL" "Origin should be blocked but was allowed" "origins" "Origin: $blocked_origin"
                    fi
                elif [ "$blocked_response" = "000" ]; then
                    record_cors_test_result "Blocked Origin ($(basename $blocked_origin))" "WARN" "Backend not accessible" "origins" "URL: $backend_url"
                else
                    record_cors_test_result "Blocked Origin ($(basename $blocked_origin))" "WARN" "Unexpected response (HTTP $blocked_response)" "origins" "Origin: $blocked_origin"
                fi
            done
            break # Only test with one backend URL
        fi
    done
}

# Function to test HTTP methods
test_http_methods() {
    local env="$1"
    
    print_step "Testing HTTP methods for $env environment"
    
    local config_lines=($(get_environment_config "$env"))
    local methods=("GET" "POST" "PUT" "DELETE" "PATCH" "HEAD")
    
    for config_line in "${config_lines[@]}"; do
        IFS=':' read -r frontend_url backend_url <<< "$config_line"
        
        for method in "${methods[@]}"; do
            # Test preflight for non-simple methods
            if [ "$method" != "GET" ] && [ "$method" != "HEAD" ] && [ "$method" != "POST" ]; then
                local preflight_response=$(curl -s -o /dev/null -w "%{http_code}" \
                    -X OPTIONS \
                    -H "Origin: $frontend_url" \
                    -H "Access-Control-Request-Method: $method" \
                    "$backend_url/test" \
                    --max-time 10 2>/dev/null || echo "000")
                
                if [ "$preflight_response" = "200" ] || [ "$preflight_response" = "204" ]; then
                    record_cors_test_result "Method Preflight $method ($(basename $frontend_url) → $(basename $backend_url))" "PASS" "Method allowed in preflight" "methods" "Method: $method"
                elif [ "$preflight_response" = "000" ]; then
                    record_cors_test_result "Method Preflight $method ($(basename $frontend_url) → $(basename $backend_url))" "WARN" "Backend not accessible" "methods" "URL: $backend_url"
                else
                    record_cors_test_result "Method Preflight $method ($(basename $frontend_url) → $(basename $backend_url))" "FAIL" "Method not allowed in preflight" "methods" "Method: $method"
                fi
            fi
            
            # Test actual method (only for safe methods to avoid side effects)
            if [ "$method" = "GET" ] || [ "$method" = "HEAD" ] || [ "$method" = "OPTIONS" ]; then
                local method_response=$(curl -s -o /dev/null -w "%{http_code}" \
                    -X "$method" \
                    -H "Origin: $frontend_url" \
                    "$backend_url/test" \
                    --max-time 10 2>/dev/null || echo "000")
                
                if [ "$method_response" = "200" ] || [ "$method_response" = "204" ]; then
                    record_cors_test_result "Method $method ($(basename $frontend_url) → $(basename $backend_url))" "PASS" "Method successful (HTTP $method_response)" "methods" "Method: $method"
                elif [ "$method_response" = "000" ]; then
                    record_cors_test_result "Method $method ($(basename $frontend_url) → $(basename $backend_url))" "WARN" "Backend not accessible" "methods" "URL: $backend_url"
                elif [ "$method_response" = "405" ]; then
                    record_cors_test_result "Method $method ($(basename $frontend_url) → $(basename $backend_url))" "WARN" "Method not allowed by endpoint" "methods" "Method: $method"
                else
                    record_cors_test_result "Method $method ($(basename $frontend_url) → $(basename $backend_url))" "FAIL" "Method failed (HTTP $method_response)" "methods" "Method: $method"
                fi
            fi
        done
        
        # Only test with first backend URL to avoid redundancy
        break
    done
}

# Function to test credentials support
test_credentials_support() {
    local env="$1"
    
    print_step "Testing credentials support for $env environment"
    
    local config_lines=($(get_environment_config "$env"))
    
    for config_line in "${config_lines[@]}"; do
        IFS=':' read -r frontend_url backend_url <<< "$config_line"
        
        # Test request with credentials
        local credentials_response=$(curl -s -i \
            -H "Origin: $frontend_url" \
            -H "Cookie: test-cookie=test-value" \
            "$backend_url/test" \
            --max-time 10 2>/dev/null || echo "")
        
        if [ -n "$credentials_response" ]; then
            # Check if Access-Control-Allow-Credentials is set to true
            if echo "$credentials_response" | grep -qi "access-control-allow-credentials.*true"; then
                record_cors_test_result "Credentials Support ($(basename $frontend_url) → $(basename $backend_url))" "PASS" "Credentials allowed" "credentials" "Access-Control-Allow-Credentials: true"
            elif echo "$credentials_response" | grep -qi "access-control-allow-credentials"; then
                local credentials_value=$(echo "$credentials_response" | grep -i "access-control-allow-credentials" | cut -d':' -f2 | tr -d '\r\n' | xargs)
                record_cors_test_result "Credentials Support ($(basename $frontend_url) → $(basename $backend_url))" "WARN" "Credentials header present but not true: $credentials_value" "credentials" "Value should be 'true'"
            else
                record_cors_test_result "Credentials Support ($(basename $frontend_url) → $(basename $backend_url))" "WARN" "No credentials support indicated" "credentials" "Access-Control-Allow-Credentials header missing"
            fi
        else
            record_cors_test_result "Credentials Support ($(basename $frontend_url) → $(basename $backend_url))" "FAIL" "Could not test credentials support" "credentials" "Connection failed to $backend_url"
        fi
        
        # Only test with first backend URL to avoid redundancy
        break
    done
}

# Function to test browser-specific scenarios
test_browser_scenarios() {
    local env="$1"
    
    print_step "Testing browser-specific CORS scenarios for $env environment"
    
    local config_lines=($(get_environment_config "$env"))
    
    for config_line in "${config_lines[@]}"; do
        IFS=':' read -r frontend_url backend_url <<< "$config_line"
        
        # Test with common browser user agents
        local user_agents=(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0"
        )
        
        for i in "${!user_agents[@]}"; do
            local user_agent="${user_agents[$i]}"
            local browser_names=("Chrome Windows" "Chrome macOS" "Safari macOS" "Firefox Windows")
            local browser_name="${browser_names[$i]}"
            
            local browser_response=$(curl -s -o /dev/null -w "%{http_code}" \
                -H "Origin: $frontend_url" \
                -H "User-Agent: $user_agent" \
                "$backend_url/test" \
                --max-time 10 2>/dev/null || echo "000")
            
            if [ "$browser_response" = "200" ]; then
                record_cors_test_result "Browser Compatibility ($browser_name)" "PASS" "Compatible (HTTP $browser_response)" "browser" "User-Agent: $browser_name"
            elif [ "$browser_response" = "000" ]; then
                record_cors_test_result "Browser Compatibility ($browser_name)" "WARN" "Backend not accessible" "browser" "URL: $backend_url"
            else
                record_cors_test_result "Browser Compatibility ($browser_name)" "WARN" "Unexpected response (HTTP $browser_response)" "browser" "User-Agent: $browser_name"
            fi
        done
        
        # Test CORS with XMLHttpRequest-like headers
        local xhr_response=$(curl -s -i \
            -H "Origin: $frontend_url" \
            -H "X-Requested-With: XMLHttpRequest" \
            -H "Content-Type: application/json" \
            "$backend_url/test" \
            --max-time 10 2>/dev/null || echo "")
        
        if [ -n "$xhr_response" ]; then
            if echo "$xhr_response" | grep -qi "HTTP.*200"; then
                record_cors_test_result "XMLHttpRequest Simulation ($(basename $frontend_url) → $(basename $backend_url))" "PASS" "XHR request successful" "browser" "X-Requested-With header supported"
            else
                record_cors_test_result "XMLHttpRequest Simulation ($(basename $frontend_url) → $(basename $backend_url))" "WARN" "XHR request failed" "browser" "May indicate CORS issues with AJAX"
            fi
        else
            record_cors_test_result "XMLHttpRequest Simulation ($(basename $frontend_url) → $(basename $backend_url))" "FAIL" "Could not simulate XHR request" "browser" "Connection failed"
        fi
        
        # Only test with first backend URL to avoid redundancy
        break
    done
}

# Function to generate CORS test report
generate_cors_test_report() {
    if [ "$REPORT" = false ]; then
        return 0
    fi
    
    print_step "Generating CORS functionality test report"
    
    local report_file="$REPORT_DIR/cors-functionality-test-report-${ENVIRONMENT}-${DOMAIN}-$(date +%Y%m%d-%H%M%S).json"
    
    local report_data="{
        \"environment\": \"$ENVIRONMENT\",
        \"domain\": \"$DOMAIN\",
        \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
        \"test_configuration\": {
            \"comprehensive\": $COMPREHENSIVE,
            \"preflight\": $PREFLIGHT,
            \"headers\": $HEADERS,
            \"origins\": $ORIGINS,
            \"methods\": $METHODS,
            \"credentials\": $CREDENTIALS,
            \"browser\": $BROWSER
        },
        \"summary\": {
            \"total_tests\": $TOTAL_TESTS,
            \"passed\": $PASSED_TESTS,
            \"failed\": $FAILED_TESTS,
            \"warnings\": $WARNING_TESTS,
            \"success_rate\": $(echo "scale=2; $PASSED_TESTS * 100 / $TOTAL_TESTS" | bc -l 2>/dev/null || echo "0")
        },
        \"test_categories\": {
            \"preflight\": $(echo "${CORS_TEST_RESULTS[*]}" | grep -c '\"category\":\"preflight\"' || echo "0"),
            \"headers\": $(echo "${CORS_TEST_RESULTS[*]}" | grep -c '\"category\":\"headers\"' || echo "0"),
            \"origins\": $(echo "${CORS_TEST_RESULTS[*]}" | grep -c '\"category\":\"origins\"' || echo "0"),
            \"methods\": $(echo "${CORS_TEST_RESULTS[*]}" | grep -c '\"category\":\"methods\"' || echo "0"),
            \"credentials\": $(echo "${CORS_TEST_RESULTS[*]}" | grep -c '\"category\":\"credentials\"' || echo "0"),
            \"browser\": $(echo "${CORS_TEST_RESULTS[*]}" | grep -c '\"category\":\"browser\"' || echo "0")
        },
        \"tests\": [$(IFS=,; echo "${CORS_TEST_RESULTS[*]}")]
    }"
    
    echo "$report_data" | jq '.' > "$report_file" 2>/dev/null || echo "$report_data" > "$report_file"
    print_success "CORS functionality test report generated: $report_file"
}

# Function to process single environment
process_environment() {
    local env="$1"
    
    print_header "TESTING CORS FUNCTIONALITY - $env ENVIRONMENT"
    
    # Test CORS preflight requests
    if [ "$PREFLIGHT" = true ]; then
        test_cors_preflight "$env"
    fi
    
    # Test CORS headers
    if [ "$HEADERS" = true ]; then
        test_cors_headers "$env"
    fi
    
    # Test origin validation
    if [ "$ORIGINS" = true ]; then
        test_origin_validation "$env"
    fi
    
    # Test HTTP methods
    if [ "$METHODS" = true ]; then
        test_http_methods "$env"
    fi
    
    # Test credentials support
    if [ "$CREDENTIALS" = true ]; then
        test_credentials_support "$env"
    fi
    
    # Test browser scenarios
    if [ "$BROWSER" = true ]; then
        test_browser_scenarios "$env"
    fi
}

# Main function
main() {
    print_header "TAKTMATE CORS FUNCTIONALITY TESTING"
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
    generate_cors_test_report
    
    # Print summary
    print_header "CORS FUNCTIONALITY TEST SUMMARY"
    echo "Total Tests: $TOTAL_TESTS"
    echo "Passed: $PASSED_TESTS"
    echo "Failed: $FAILED_TESTS"
    echo "Warnings: $WARNING_TESTS"
    
    if [ $TOTAL_TESTS -gt 0 ]; then
        local success_rate=$(echo "scale=1; $PASSED_TESTS * 100 / $TOTAL_TESTS" | bc -l 2>/dev/null || echo "0")
        echo "Success Rate: ${success_rate}%"
    fi
    
    if [ $FAILED_TESTS -gt 0 ]; then
        print_header "SOME CORS FUNCTIONALITY TESTS FAILED! ❌"
        echo ""
        echo "Common issues and solutions:"
        echo "1. Ensure backend server is running and accessible"
        echo "2. Check CORS configuration includes all required origins"
        echo "3. Verify preflight requests are handled correctly"
        echo "4. Test with actual frontend application"
        echo "5. Check browser developer tools for CORS errors"
        exit 1
    elif [ $WARNING_TESTS -gt 0 ]; then
        print_header "CORS FUNCTIONALITY TESTS COMPLETED WITH WARNINGS! ⚠️"
        echo ""
        echo "Review warnings above - some may be expected for the environment"
        exit 0
    else
        print_header "ALL CORS FUNCTIONALITY TESTS PASSED! ✅"
        exit 0
    fi
}

# Execute main function
main "$@"
