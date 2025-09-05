#!/bin/bash

# Test Azure App Service deployment
# Usage: ./test-app-service.sh [environment] [app-service-url]
# Example: ./test-app-service.sh production https://taktmate-api-prod.azurewebsites.net

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
APP_SERVICE_URL=${2:-""}

# Determine URL based on environment if not provided
if [ -z "$APP_SERVICE_URL" ]; then
    case $ENVIRONMENT in
        "production")
            APP_SERVICE_URL="https://taktmate-api-prod.azurewebsites.net"
            ;;
        "staging")
            APP_SERVICE_URL="https://taktmate-api-staging.azurewebsites.net"
            ;;
        "development")
            APP_SERVICE_URL="http://localhost:3001"
            ;;
        *)
            print_error "Unknown environment: $ENVIRONMENT"
            exit 1
            ;;
    esac
fi

print_status "Testing Azure App Service deployment"
print_status "Environment: $ENVIRONMENT"
print_status "App Service URL: $APP_SERVICE_URL"

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
    "curl -s -o /dev/null -w '%{http_code}' '$APP_SERVICE_URL' | grep -q '404'" \
    "App Service is accessible (404 expected for root path)"

# Test 2: Health endpoint
run_test "Health Endpoint" \
    "curl -s -o /dev/null -w '%{http_code}' '$APP_SERVICE_URL/api/health' | grep -q '200'" \
    "Health endpoint returns 200"

# Test 3: Health endpoint response
HEALTH_RESPONSE=$(curl -s "$APP_SERVICE_URL/api/health" 2>/dev/null || echo "")
if echo "$HEALTH_RESPONSE" | grep -q "status"; then
    print_success "Health Response - Valid JSON response received"
    ((TESTS_PASSED++))
else
    print_error "Health Response - Invalid or no response"
    FAILED_TESTS+=("Health Response")
    ((TESTS_FAILED++))
fi

# Test 4: HTTPS enforcement (only for HTTPS URLs)
if [[ "$APP_SERVICE_URL" == https* ]]; then
    HTTP_URL=$(echo "$APP_SERVICE_URL" | sed 's/https/http/')
    run_test "HTTPS Enforcement" \
        "curl -s -I '$HTTP_URL' | grep -q '301\|302'" \
        "HTTP redirects to HTTPS"
fi

# Test 5: Security Headers
run_test "Security Headers - X-Frame-Options" \
    "curl -s -I '$APP_SERVICE_URL/api/health' | grep -qi 'x-frame-options'" \
    "X-Frame-Options header present"

run_test "Security Headers - X-Content-Type-Options" \
    "curl -s -I '$APP_SERVICE_URL/api/health' | grep -qi 'x-content-type-options'" \
    "X-Content-Type-Options header present"

# Test 6: API endpoints
run_test "Auth Config Endpoint" \
    "curl -s -o /dev/null -w '%{http_code}' '$APP_SERVICE_URL/api/auth/config' | grep -q '200'" \
    "Auth config endpoint accessible"

# Test 7: CORS headers (test with OPTIONS request)
run_test "CORS Headers" \
    "curl -s -I -X OPTIONS '$APP_SERVICE_URL/api/health' | grep -qi 'access-control-allow'" \
    "CORS headers present"

# Test 8: Response time performance
print_status "Running performance tests..."

RESPONSE_TIME=$(curl -s -o /dev/null -w '%{time_total}' "$APP_SERVICE_URL/api/health")
if (( $(echo "$RESPONSE_TIME < 2.0" | bc -l) )); then
    print_success "Response Time - ${RESPONSE_TIME}s (< 2s)"
    ((TESTS_PASSED++))
else
    print_warning "Response Time - ${RESPONSE_TIME}s (> 2s)"
    FAILED_TESTS+=("Response Time")
    ((TESTS_FAILED++))
fi

# Test 9: Application Insights integration
print_status "Testing Application Insights integration..."

# Check if Application Insights headers are present
AI_HEADERS=$(curl -s -I "$APP_SERVICE_URL/api/health" | grep -i "request-id\|request-context" || echo "")
if [ ! -z "$AI_HEADERS" ]; then
    print_success "Application Insights - Telemetry headers present"
    ((TESTS_PASSED++))
else
    print_warning "Application Insights - No telemetry headers found"
    FAILED_TESTS+=("Application Insights")
    ((TESTS_FAILED++))
fi

# Test 10: Environment-specific configuration
print_status "Testing environment-specific configuration..."

# Check Node.js version in response headers or health endpoint
NODE_VERSION=$(curl -s "$APP_SERVICE_URL/api/health" | jq -r '.nodeVersion // empty' 2>/dev/null || echo "")
if [ ! -z "$NODE_VERSION" ]; then
    print_success "Node.js Version - $NODE_VERSION"
    ((TESTS_PASSED++))
else
    print_warning "Node.js Version - Not available in health response"
    FAILED_TESTS+=("Node.js Version")
    ((TESTS_FAILED++))
fi

# Test 11: Error handling
print_status "Testing error handling..."

ERROR_RESPONSE=$(curl -s -w "%{http_code}" "$APP_SERVICE_URL/api/nonexistent" 2>/dev/null || echo "000")
if [[ "$ERROR_RESPONSE" =~ (404|405) ]]; then
    print_success "Error Handling - Proper error codes for invalid endpoints"
    ((TESTS_PASSED++))
else
    print_warning "Error Handling - Unexpected response for invalid endpoint: $ERROR_RESPONSE"
    FAILED_TESTS+=("Error Handling")
    ((TESTS_FAILED++))
fi

# Test 12: JSON content type
run_test "JSON Content Type" \
    "curl -s -I '$APP_SERVICE_URL/api/health' | grep -qi 'content-type.*application/json'" \
    "Health endpoint returns JSON content type"

# Test 13: Rate limiting headers (if implemented)
RATE_LIMIT_HEADERS=$(curl -s -I "$APP_SERVICE_URL/api/health" | grep -i "x-ratelimit\|retry-after" || echo "")
if [ ! -z "$RATE_LIMIT_HEADERS" ]; then
    print_success "Rate Limiting - Rate limit headers present"
    ((TESTS_PASSED++))
else
    print_warning "Rate Limiting - No rate limit headers found (may not be implemented)"
    # Don't count this as a failure since rate limiting might not be implemented yet
fi

# Test 14: Authentication endpoint (should require auth)
AUTH_TEST_RESPONSE=$(curl -s -w "%{http_code}" "$APP_SERVICE_URL/api/files" 2>/dev/null | tail -c 3)
if [[ "$AUTH_TEST_RESPONSE" == "401" ]]; then
    print_success "Authentication - Protected endpoints require authentication"
    ((TESTS_PASSED++))
else
    print_warning "Authentication - Protected endpoint response: $AUTH_TEST_RESPONSE"
    FAILED_TESTS+=("Authentication")
    ((TESTS_FAILED++))
fi

# Test 15: SSL Certificate (for HTTPS URLs)
if [[ "$APP_SERVICE_URL" == https* ]]; then
    DOMAIN=$(echo "$APP_SERVICE_URL" | sed 's|https://||' | sed 's|/.*||')
    SSL_INFO=$(echo | openssl s_client -servername "$DOMAIN" -connect "$DOMAIN:443" 2>/dev/null | openssl x509 -noout -dates 2>/dev/null || echo "")
    
    if [ ! -z "$SSL_INFO" ]; then
        print_success "SSL Certificate - Valid SSL certificate"
        ((TESTS_PASSED++))
    else
        print_error "SSL Certificate - SSL certificate validation failed"
        FAILED_TESTS+=("SSL Certificate")
        ((TESTS_FAILED++))
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

# Additional information
echo ""
print_status "Additional Information:"
echo "Health Endpoint: $APP_SERVICE_URL/api/health"
echo "Auth Config: $APP_SERVICE_URL/api/auth/config"
echo "Environment: $ENVIRONMENT"

if [ ! -z "$HEALTH_RESPONSE" ]; then
    echo ""
    print_status "Health Response:"
    echo "$HEALTH_RESPONSE" | jq . 2>/dev/null || echo "$HEALTH_RESPONSE"
fi

echo ""
if [ $TESTS_FAILED -eq 0 ]; then
    print_success "🎉 All tests passed! App Service is deployed and functioning correctly."
    exit 0
else
    print_error "❌ Some tests failed. Please review the deployment configuration."
    exit 1
fi
