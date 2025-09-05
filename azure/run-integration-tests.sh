#!/bin/bash

# TaktMate Integration Testing Suite
# Usage: ./run-integration-tests.sh [environment] [domain] [options]
# Example: ./run-integration-tests.sh production taktconnect.com --comprehensive --report

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
    echo "TaktMate Integration Testing Suite"
    echo ""
    echo "Usage: $0 [environment] [domain] [options]"
    echo ""
    echo "Environments:"
    echo "  production  - Test production environment integration"
    echo "  staging     - Test staging environment integration"
    echo "  development - Test development environment integration"
    echo "  all         - Test all environments"
    echo ""
    echo "Domains:"
    echo "  taktconnect.com - Primary domain for TaktMate application"
    echo "  taktmate.com    - Alternative domain (if available)"
    echo ""
    echo "Options:"
    echo "  --comprehensive Run all integration tests"
    echo "  --dns           Test DNS configuration and propagation"
    echo "  --domains       Test Static Web App domain configuration"
    echo "  --ssl           Test SSL certificate management"
    echo "  --b2c           Test Azure AD B2C authentication"
    echo "  --validation    Test domain accessibility and SSL validity"
    echo "  --report        Generate comprehensive integration report"
    echo "  --parallel      Run tests in parallel (faster)"
    echo "  --verbose       Enable verbose output"
    echo "  --help          Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 production taktconnect.com --comprehensive --report"
    echo "  $0 all taktconnect.com --dns --domains --ssl --parallel"
    echo "  $0 staging taktconnect.com --b2c --validation --verbose"
}

# Parse arguments
ENVIRONMENT=""
DOMAIN=""
COMPREHENSIVE=false
DNS=false
DOMAINS=false
SSL=false
B2C=false
VALIDATION=false
REPORT=false
PARALLEL=false
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
            DOMAINS=true
            SSL=true
            B2C=true
            VALIDATION=true
            shift
            ;;
        --dns)
            DNS=true
            shift
            ;;
        --domains)
            DOMAINS=true
            shift
            ;;
        --ssl)
            SSL=true
            shift
            ;;
        --b2c)
            B2C=true
            shift
            ;;
        --validation)
            VALIDATION=true
            shift
            ;;
        --report)
            REPORT=true
            shift
            ;;
        --parallel)
            PARALLEL=true
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

# Integration test results tracking
TOTAL_TEST_SUITES=0
PASSED_TEST_SUITES=0
FAILED_TEST_SUITES=0
WARNING_TEST_SUITES=0
INTEGRATION_RESULTS=()

# Function to record integration test result
record_integration_result() {
    local test_suite="$1"
    local status="$2"
    local message="$3"
    local details="${4:-}"
    
    TOTAL_TEST_SUITES=$((TOTAL_TEST_SUITES + 1))
    
    case "$status" in
        "PASS")
            PASSED_TEST_SUITES=$((PASSED_TEST_SUITES + 1))
            print_success "$test_suite: $message"
            ;;
        "FAIL")
            FAILED_TEST_SUITES=$((FAILED_TEST_SUITES + 1))
            print_error "$test_suite: $message"
            ;;
        "WARN")
            WARNING_TEST_SUITES=$((WARNING_TEST_SUITES + 1))
            print_warning "$test_suite: $message"
            ;;
    esac
    
    if [ "$VERBOSE" = true ] && [ -n "$details" ]; then
        print_status "  Details: $details"
    fi
    
    if [ "$REPORT" = true ]; then
        local result_data="{\"test_suite\":\"$test_suite\",\"status\":\"$status\",\"message\":\"$message\",\"details\":\"$details\",\"environment\":\"$ENVIRONMENT\",\"domain\":\"$DOMAIN\",\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}"
        INTEGRATION_RESULTS+=("$result_data")
    fi
}

# Function to run test with error handling
run_test() {
    local test_name="$1"
    local test_command="$2"
    local test_description="$3"
    
    print_step "Running $test_description"
    
    if [ "$VERBOSE" = true ]; then
        print_status "Command: $test_command"
    fi
    
    # Run the test and capture output
    local test_output
    local test_exit_code
    
    if test_output=$(eval "$test_command" 2>&1); then
        test_exit_code=0
    else
        test_exit_code=$?
    fi
    
    # Analyze test results
    if [ $test_exit_code -eq 0 ]; then
        record_integration_result "$test_name" "PASS" "$test_description completed successfully" "$test_output"
    elif [ $test_exit_code -eq 2 ]; then
        # Exit code 2 typically indicates warnings
        record_integration_result "$test_name" "WARN" "$test_description completed with warnings" "$test_output"
    else
        record_integration_result "$test_name" "FAIL" "$test_description failed" "$test_output"
    fi
    
    return $test_exit_code
}

# Function to run DNS configuration tests
run_dns_tests() {
    local env="$1"
    
    if [ "$DNS" = false ]; then
        return 0
    fi
    
    print_header "DNS CONFIGURATION TESTS - $env"
    
    # Test DNS configuration
    run_test "DNS Configuration" \
        "$SCRIPT_DIR/test-dns-configuration.sh $env $DOMAIN --comprehensive --report" \
        "DNS configuration and propagation testing"
    
    return $?
}

# Function to run Static Web App domain tests
run_domain_tests() {
    local env="$1"
    
    if [ "$DOMAINS" = false ]; then
        return 0
    fi
    
    print_header "STATIC WEB APP DOMAIN TESTS - $env"
    
    # Test Static Web App domains
    run_test "Static Web App Domains" \
        "$SCRIPT_DIR/test-static-web-app-domains.sh $env $DOMAIN --comprehensive --report" \
        "Static Web App custom domain testing"
    
    return $?
}

# Function to run SSL certificate tests
run_ssl_tests() {
    local env="$1"
    
    if [ "$SSL" = false ]; then
        return 0
    fi
    
    print_header "SSL CERTIFICATE TESTS - $env"
    
    # Test SSL certificates
    run_test "SSL Certificate Management" \
        "$SCRIPT_DIR/configure-ssl-certificates.sh $env $DOMAIN --monitor --validate --security --performance --report" \
        "SSL certificate management and validation"
    
    return $?
}

# Function to run Azure AD B2C tests
run_b2c_tests() {
    local env="$1"
    
    if [ "$B2C" = false ]; then
        return 0
    fi
    
    print_header "AZURE AD B2C TESTS - $env"
    
    # Test B2C configuration
    run_test "B2C Configuration Validation" \
        "$SCRIPT_DIR/update-b2c-redirect-urls.sh $env $DOMAIN --validate --test" \
        "Azure AD B2C redirect URL validation"
    
    # Test B2C authentication
    run_test "B2C Authentication Testing" \
        "$SCRIPT_DIR/test-b2c-authentication.sh $env $DOMAIN --comprehensive --report" \
        "Azure AD B2C authentication flow testing"
    
    return $?
}

# Function to run domain and SSL validation tests
run_validation_tests() {
    local env="$1"
    
    if [ "$VALIDATION" = false ]; then
        return 0
    fi
    
    print_header "DOMAIN AND SSL VALIDATION TESTS - $env"
    
    # Test domain accessibility and SSL validity
    run_test "Domain and SSL Validation" \
        "$SCRIPT_DIR/test-domain-ssl-validation.sh $env $DOMAIN --comprehensive --report" \
        "Comprehensive domain accessibility and SSL certificate validation"
    
    return $?
}

# Function to run tests in parallel
run_tests_parallel() {
    local env="$1"
    
    print_header "RUNNING INTEGRATION TESTS IN PARALLEL - $env"
    
    local pids=()
    local test_results=()
    
    # Start tests in background
    if [ "$DNS" = true ]; then
        (run_dns_tests "$env") &
        pids+=($!)
        test_results+=("DNS Tests")
    fi
    
    if [ "$DOMAINS" = true ]; then
        (run_domain_tests "$env") &
        pids+=($!)
        test_results+=("Domain Tests")
    fi
    
    if [ "$SSL" = true ]; then
        (run_ssl_tests "$env") &
        pids+=($!)
        test_results+=("SSL Tests")
    fi
    
    if [ "$B2C" = true ]; then
        (run_b2c_tests "$env") &
        pids+=($!)
        test_results+=("B2C Tests")
    fi
    
    if [ "$VALIDATION" = true ]; then
        (run_validation_tests "$env") &
        pids+=($!)
        test_results+=("Validation Tests")
    fi
    
    # Wait for all tests to complete
    local overall_result=0
    for i in "${!pids[@]}"; do
        local pid=${pids[$i]}
        local test_name=${test_results[$i]}
        
        if wait $pid; then
            print_success "$test_name completed successfully"
        else
            local exit_code=$?
            if [ $exit_code -eq 2 ]; then
                print_warning "$test_name completed with warnings"
            else
                print_error "$test_name failed"
                overall_result=1
            fi
        fi
    done
    
    return $overall_result
}

# Function to run tests sequentially
run_tests_sequential() {
    local env="$1"
    
    print_header "RUNNING INTEGRATION TESTS SEQUENTIALLY - $env"
    
    local overall_result=0
    
    # Run tests in sequence
    if [ "$DNS" = true ]; then
        if ! run_dns_tests "$env"; then
            overall_result=1
        fi
    fi
    
    if [ "$DOMAINS" = true ]; then
        if ! run_domain_tests "$env"; then
            overall_result=1
        fi
    fi
    
    if [ "$SSL" = true ]; then
        if ! run_ssl_tests "$env"; then
            overall_result=1
        fi
    fi
    
    if [ "$B2C" = true ]; then
        if ! run_b2c_tests "$env"; then
            overall_result=1
        fi
    fi
    
    if [ "$VALIDATION" = true ]; then
        if ! run_validation_tests "$env"; then
            overall_result=1
        fi
    fi
    
    return $overall_result
}

# Function to generate integration test report
generate_integration_report() {
    if [ "$REPORT" = false ]; then
        return 0
    fi
    
    print_step "Generating comprehensive integration test report"
    
    local report_file="$REPORT_DIR/integration-test-report-${ENVIRONMENT}-${DOMAIN}-$(date +%Y%m%d-%H%M%S).json"
    
    # Collect individual test reports
    local individual_reports=()
    if ls "$REPORT_DIR"/*-report-*-$(date +%Y%m%d)*.json 1> /dev/null 2>&1; then
        for report in "$REPORT_DIR"/*-report-*-$(date +%Y%m%d)*.json; do
            if [ -f "$report" ] && [ "$report" != "$report_file" ]; then
                individual_reports+=("\"$(basename "$report")\"")
            fi
        done
    fi
    
    local report_data="{
        \"environment\": \"$ENVIRONMENT\",
        \"domain\": \"$DOMAIN\",
        \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
        \"test_configuration\": {
            \"comprehensive\": $COMPREHENSIVE,
            \"parallel\": $PARALLEL,
            \"dns\": $DNS,
            \"domains\": $DOMAINS,
            \"ssl\": $SSL,
            \"b2c\": $B2C,
            \"validation\": $VALIDATION
        },
        \"summary\": {
            \"total_test_suites\": $TOTAL_TEST_SUITES,
            \"passed\": $PASSED_TEST_SUITES,
            \"failed\": $FAILED_TEST_SUITES,
            \"warnings\": $WARNING_TEST_SUITES,
            \"success_rate\": $(echo "scale=2; $PASSED_TEST_SUITES * 100 / $TOTAL_TEST_SUITES" | bc -l 2>/dev/null || echo "0")
        },
        \"test_suites\": [$(IFS=,; echo "${INTEGRATION_RESULTS[*]}")],
        \"individual_reports\": [$(IFS=,; echo "${individual_reports[*]}")]
    }"
    
    echo "$report_data" | jq '.' > "$report_file" 2>/dev/null || echo "$report_data" > "$report_file"
    print_success "Integration test report generated: $report_file"
}

# Function to display integration summary
display_integration_summary() {
    print_header "INTEGRATION TEST SUMMARY"
    
    echo "Environment: $ENVIRONMENT"
    echo "Domain: $DOMAIN"
    echo "Test Configuration:"
    echo "  DNS Tests: $DNS"
    echo "  Domain Tests: $DOMAINS"
    echo "  SSL Tests: $SSL"
    echo "  B2C Tests: $B2C"
    echo "  Validation Tests: $VALIDATION"
    echo "  Parallel Execution: $PARALLEL"
    echo ""
    
    echo "Test Suite Results:"
    echo "  Total Test Suites: $TOTAL_TEST_SUITES"
    echo "  Passed: $PASSED_TEST_SUITES"
    echo "  Failed: $FAILED_TEST_SUITES"
    echo "  Warnings: $WARNING_TEST_SUITES"
    
    if [ $TOTAL_TEST_SUITES -gt 0 ]; then
        local success_rate=$(echo "scale=1; $PASSED_TEST_SUITES * 100 / $TOTAL_TEST_SUITES" | bc -l 2>/dev/null || echo "0")
        echo "  Success Rate: ${success_rate}%"
    fi
    echo ""
    
    echo "Integration Status:"
    if [ $FAILED_TEST_SUITES -eq 0 ] && [ $WARNING_TEST_SUITES -eq 0 ]; then
        print_success "✅ All integration tests passed successfully"
        echo "TaktMate custom domain integration is fully operational!"
    elif [ $FAILED_TEST_SUITES -eq 0 ]; then
        print_warning "⚠️  Integration tests completed with warnings"
        echo "Review warning messages above for potential improvements"
    else
        print_error "❌ Some integration tests failed"
        echo "Address failed tests before proceeding to production"
    fi
    echo ""
    
    if [ "$REPORT" = true ]; then
        echo "Reports Generated:"
        ls -la "$REPORT_DIR"/*-report-*-$(date +%Y%m%d)*.json 2>/dev/null | tail -10 || echo "  No reports found"
    fi
}

# Function to process single environment
process_environment() {
    local env="$1"
    
    print_header "PROCESSING INTEGRATION TESTS - $env ENVIRONMENT"
    
    local env_result=0
    
    # Run tests (parallel or sequential)
    if [ "$PARALLEL" = true ]; then
        if ! run_tests_parallel "$env"; then
            env_result=1
        fi
    else
        if ! run_tests_sequential "$env"; then
            env_result=1
        fi
    fi
    
    return $env_result
}

# Main function
main() {
    print_header "TAKTMATE INTEGRATION TESTING SUITE"
    print_status "Environment: $ENVIRONMENT"
    print_status "Domain: $DOMAIN"
    print_status "Comprehensive Testing: $COMPREHENSIVE"
    print_status "Parallel Execution: $PARALLEL"
    echo ""
    
    local overall_result=0
    
    # Process environments
    if [ "$ENVIRONMENT" = "all" ]; then
        for env in production staging development; do
            if ! process_environment "$env"; then
                overall_result=1
            fi
            echo ""
        done
    else
        if ! process_environment "$ENVIRONMENT"; then
            overall_result=1
        fi
    fi
    
    # Generate integration report
    generate_integration_report
    
    # Display summary
    display_integration_summary
    
    # Final result
    if [ $overall_result -eq 0 ]; then
        if [ $WARNING_TEST_SUITES -gt 0 ]; then
            print_header "INTEGRATION TESTING COMPLETED WITH WARNINGS! ⚠️"
            exit 0
        else
            print_header "ALL INTEGRATION TESTS PASSED! ✅"
            exit 0
        fi
    else
        print_header "SOME INTEGRATION TESTS FAILED! ❌"
        echo ""
        echo "Integration Test Failure Analysis:"
        echo "1. Check individual test reports for detailed error information"
        echo "2. Verify all prerequisites are met (DNS propagation, SSL certificates, etc.)"
        echo "3. Ensure Azure CLI is authenticated with appropriate permissions"
        echo "4. Check Azure service status and configuration"
        echo "5. Review network connectivity and firewall settings"
        exit 1
    fi
}

# Execute main function
main "$@"
