#!/bin/bash

# Test Azure Static Web App deployment
# Usage: ./test-static-web-app.sh [environment] [domain]
# Example: ./test-static-web-app.sh production app.taktmate.com

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

# Default values
ENVIRONMENT=${1:-"staging"}
DOMAIN=${2:-""}

# Determine domain based on environment if not provided
if [ -z "$DOMAIN" ]; then
    case $ENVIRONMENT in
        "production")
            DOMAIN="app.taktmate.com"
            ;;
        "staging")
            DOMAIN="staging.taktmate.com"
            ;;
        "development")
            DOMAIN="localhost:3000"
            ;;
        *)
            print_error "Unknown environment: $ENVIRONMENT"
            exit 1
            ;;
    esac
fi

BASE_URL="https://$DOMAIN"
if [ "$ENVIRONMENT" = "development" ]; then
    BASE_URL="http://$DOMAIN"
fi

print_status "Testing Azure Static Web App deployment"
print_status "Environment: $ENVIRONMENT"
print_status "Domain: $DOMAIN"
print_status "Base URL: $BASE_URL"

# Test results
TESTS_PASSED=0
TESTS_FAILED=0
FAILED_TESTS=()

# Function to run test
run_test() {
    local test_name="$1"
    local test_command="$2"
    local expected_result="$3"
    
    print_status "Running test: $test_name"
    
    if eval "$test_command"; then
        if [ ! -z "$expected_result" ]; then
            print_success "$test_name - $expected_result"
        else
            print_success "$test_name - PASSED"
        fi
        ((TESTS_PASSED++))
    else
        print_error "$test_name - FAILED"
        FAILED_TESTS+=("$test_name")
        ((TESTS_FAILED++))
    fi
    echo ""
}

# Test 1: Basic connectivity
run_test "Basic Connectivity" \
    "curl -s -o /dev/null -w '%{http_code}' '$BASE_URL' | grep -q '200'" \
    "Site is accessible"

# Test 2: SSL Certificate (only for HTTPS)
if [[ "$BASE_URL" == https* ]]; then
    run_test "SSL Certificate" \
        "curl -s -I '$BASE_URL' | grep -q 'HTTP/2 200'" \
        "SSL certificate is valid"
fi

# Test 3: Security Headers
run_test "Security Headers - X-Frame-Options" \
    "curl -s -I '$BASE_URL' | grep -qi 'x-frame-options'" \
    "X-Frame-Options header present"

run_test "Security Headers - X-Content-Type-Options" \
    "curl -s -I '$BASE_URL' | grep -qi 'x-content-type-options'" \
    "X-Content-Type-Options header present"

run_test "Security Headers - X-XSS-Protection" \
    "curl -s -I '$BASE_URL' | grep -qi 'x-xss-protection'" \
    "X-XSS-Protection header present"

# Test 4: SPA Routing
run_test "SPA Routing - /login" \
    "curl -s -o /dev/null -w '%{http_code}' '$BASE_URL/login' | grep -q '200'" \
    "Login route returns 200"

run_test "SPA Routing - /dashboard" \
    "curl -s -o /dev/null -w '%{http_code}' '$BASE_URL/dashboard' | grep -q '200'" \
    "Dashboard route returns 200"

run_test "SPA Routing - Random path" \
    "curl -s -o /dev/null -w '%{http_code}' '$BASE_URL/random-path-that-does-not-exist' | grep -q '200'" \
    "Random path returns 200 (SPA fallback)"

# Test 5: Static Assets
run_test "Static Assets - Favicon" \
    "curl -s -o /dev/null -w '%{http_code}' '$BASE_URL/favicon.ico' | grep -q '200'" \
    "Favicon is accessible"

run_test "Static Assets - Robots.txt" \
    "curl -s -o /dev/null -w '%{http_code}' '$BASE_URL/robots.txt' | grep -q '200'" \
    "Robots.txt is accessible"

run_test "Static Assets - Manifest" \
    "curl -s -o /dev/null -w '%{http_code}' '$BASE_URL/manifest.json' | grep -q '200'" \
    "Manifest.json is accessible"

run_test "Static Assets - Sitemap" \
    "curl -s -o /dev/null -w '%{http_code}' '$BASE_URL/sitemap.xml' | grep -q '200'" \
    "Sitemap.xml is accessible"

# Test 6: Content Type Headers
run_test "Content Types - HTML" \
    "curl -s -I '$BASE_URL' | grep -qi 'content-type: text/html'" \
    "HTML content type is correct"

run_test "Content Types - JSON Manifest" \
    "curl -s -I '$BASE_URL/manifest.json' | grep -qi 'content-type: application/json'" \
    "JSON content type is correct"

# Test 7: Performance Tests
print_status "Running performance tests..."

# Test response time
RESPONSE_TIME=$(curl -s -o /dev/null -w '%{time_total}' "$BASE_URL")
if (( $(echo "$RESPONSE_TIME < 2.0" | bc -l) )); then
    print_success "Response Time - ${RESPONSE_TIME}s (< 2s)"
    ((TESTS_PASSED++))
else
    print_warning "Response Time - ${RESPONSE_TIME}s (> 2s)"
    FAILED_TESTS+=("Response Time")
    ((TESTS_FAILED++))
fi

# Test 8: Azure-specific headers
run_test "Azure Static Web Apps Headers" \
    "curl -s -I '$BASE_URL' | grep -qi 'server.*azure'" \
    "Azure server headers present"

# Test 9: Content validation
print_status "Validating page content..."

PAGE_CONTENT=$(curl -s "$BASE_URL")

# Check for React app
if echo "$PAGE_CONTENT" | grep -q "react"; then
    print_success "React App - React artifacts found in page"
    ((TESTS_PASSED++))
else
    print_warning "React App - No React artifacts found"
    FAILED_TESTS+=("React App Content")
    ((TESTS_FAILED++))
fi

# Check for TaktMate title
if echo "$PAGE_CONTENT" | grep -qi "TaktMate"; then
    print_success "Page Title - TaktMate title found"
    ((TESTS_PASSED++))
else
    print_error "Page Title - TaktMate title not found"
    FAILED_TESTS+=("Page Title")
    ((TESTS_FAILED++))
fi

# Check for meta tags
if echo "$PAGE_CONTENT" | grep -q "meta.*description"; then
    print_success "SEO Meta Tags - Description meta tag found"
    ((TESTS_PASSED++))
else
    print_warning "SEO Meta Tags - Description meta tag not found"
    FAILED_TESTS+=("SEO Meta Tags")
    ((TESTS_FAILED++))
fi

# Test 10: API connectivity (if not localhost)
if [ "$ENVIRONMENT" != "development" ]; then
    print_status "Testing API connectivity..."
    
    # Extract API URL from page content or use default
    API_URL=$(echo "$PAGE_CONTENT" | grep -o 'REACT_APP_API_BASE_URL[^"]*' | head -1 | cut -d'=' -f2 || echo "")
    
    if [ ! -z "$API_URL" ] && [ "$API_URL" != "null" ]; then
        run_test "API Connectivity" \
            "curl -s -o /dev/null -w '%{http_code}' '$API_URL/api/health' | grep -q '200'" \
            "API health endpoint is accessible"
    else
        print_warning "API Connectivity - No API URL found in configuration"
    fi
fi

# Summary
echo ""
echo "=================================================="
print_status "TEST SUMMARY"
echo "=================================================="
print_success "Tests Passed: $TESTS_PASSED"
if [ $TESTS_FAILED -gt 0 ]; then
    print_error "Tests Failed: $TESTS_FAILED"
    echo ""
    print_error "Failed Tests:"
    for test in "${FAILED_TESTS[@]}"; do
        echo "  - $test"
    done
else
    print_success "Tests Failed: $TESTS_FAILED"
fi

echo ""
if [ $TESTS_FAILED -eq 0 ]; then
    print_success "🎉 All tests passed! Static Web App is deployed and functioning correctly."
    exit 0
else
    print_error "❌ Some tests failed. Please review the deployment configuration."
    exit 1
fi
