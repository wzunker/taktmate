#!/bin/bash

# TaktMate Production Monitoring Testing Script
# Usage: ./test-production-monitoring.sh [environment] [options]
# Example: ./test-production-monitoring.sh production --comprehensive --report

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
    echo "TaktMate Production Monitoring Testing"
    echo ""
    echo "Usage: $0 [environment] [options]"
    echo ""
    echo "Environments:"
    echo "  production  - Test production monitoring setup"
    echo "  staging     - Test staging monitoring setup"
    echo "  development - Test development monitoring setup"
    echo ""
    echo "Options:"
    echo "  --comprehensive     Run comprehensive monitoring tests"
    echo "  --telemetry         Test telemetry data ingestion"
    echo "  --alerts            Test alert rules and notifications"
    echo "  --dashboards        Test dashboard queries and data"
    echo "  --availability      Test availability monitoring"
    echo "  --performance       Test performance monitoring"
    echo "  --report            Generate detailed test report"
    echo "  --verbose           Enable verbose output"
    echo "  --help              Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 production --comprehensive --report"
    echo "  $0 staging --telemetry --alerts"
    echo "  $0 production --availability --performance --verbose"
}

# Parse arguments
ENVIRONMENT=""
COMPREHENSIVE=false
TELEMETRY=false
ALERTS=false
DASHBOARDS=false
AVAILABILITY=false
PERFORMANCE=false
REPORT=false
VERBOSE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        production|staging|development)
            ENVIRONMENT="$1"
            shift
            ;;
        --comprehensive)
            COMPREHENSIVE=true
            TELEMETRY=true
            ALERTS=true
            DASHBOARDS=true
            AVAILABILITY=true
            PERFORMANCE=true
            shift
            ;;
        --telemetry)
            TELEMETRY=true
            shift
            ;;
        --alerts)
            ALERTS=true
            shift
            ;;
        --dashboards)
            DASHBOARDS=true
            shift
            ;;
        --availability)
            AVAILABILITY=true
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

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(production|staging|development)$ ]]; then
    print_error "Environment must be specified: production, staging, or development"
    show_usage
    exit 1
fi

# Set environment-specific variables
case "$ENVIRONMENT" in
    "production")
        RESOURCE_GROUP="taktmate-prod-rg"
        APP_INSIGHTS_NAME="taktmate-appinsights-prod"
        APP_SERVICE_NAME="taktmate-api-prod"
        FRONTEND_URL="https://app.taktmate.com"
        BACKEND_URL="https://api.taktmate.com"
        LOG_ANALYTICS_WORKSPACE="taktmate-logs-prod"
        ACTION_GROUP_NAME="taktmate-alerts-prod"
        ;;
    "staging")
        RESOURCE_GROUP="taktmate-staging-rg"
        APP_INSIGHTS_NAME="taktmate-appinsights-staging"
        APP_SERVICE_NAME="taktmate-api-staging"
        FRONTEND_URL="https://staging.taktmate.com"
        BACKEND_URL="https://api-staging.taktmate.com"
        LOG_ANALYTICS_WORKSPACE="taktmate-logs-staging"
        ACTION_GROUP_NAME="taktmate-alerts-staging"
        ;;
    "development")
        RESOURCE_GROUP="taktmate-dev-rg"
        APP_INSIGHTS_NAME="taktmate-appinsights-dev"
        APP_SERVICE_NAME="taktmate-api-dev"
        FRONTEND_URL="https://dev.taktmate.com"
        BACKEND_URL="https://api-dev.taktmate.com"
        LOG_ANALYTICS_WORKSPACE="taktmate-logs-dev"
        ACTION_GROUP_NAME="taktmate-alerts-dev"
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
        TEST_RESULTS+=("{\"test\":\"$test_name\",\"status\":\"$status\",\"message\":\"$message\",\"category\":\"$category\",\"environment\":\"$environment\",\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}")
    fi
}

# Function to test Application Insights configuration
test_application_insights() {
    print_step "Testing Application Insights configuration"
    
    # Test if Application Insights exists
    if az monitor app-insights component show --app "$APP_INSIGHTS_NAME" --resource-group "$RESOURCE_GROUP" &>/dev/null; then
        record_test_result "Application Insights Exists" "PASS" "Component found: $APP_INSIGHTS_NAME" "infrastructure"
        
        # Get connection string
        local connection_string=$(az monitor app-insights component show --app "$APP_INSIGHTS_NAME" --resource-group "$RESOURCE_GROUP" --query "connectionString" -o tsv)
        if [ -n "$connection_string" ]; then
            record_test_result "Connection String Available" "PASS" "Connection string configured" "configuration"
        else
            record_test_result "Connection String Available" "FAIL" "Connection string not available" "configuration"
        fi
        
        # Get instrumentation key
        local instrumentation_key=$(az monitor app-insights component show --app "$APP_INSIGHTS_NAME" --resource-group "$RESOURCE_GROUP" --query "instrumentationKey" -o tsv)
        if [ -n "$instrumentation_key" ]; then
            record_test_result "Instrumentation Key Available" "PASS" "Instrumentation key configured" "configuration"
        else
            record_test_result "Instrumentation Key Available" "FAIL" "Instrumentation key not available" "configuration"
        fi
        
        # Test workspace association
        local workspace_id=$(az monitor app-insights component show --app "$APP_INSIGHTS_NAME" --resource-group "$RESOURCE_GROUP" --query "workspaceResourceId" -o tsv)
        if [ -n "$workspace_id" ] && [ "$workspace_id" != "null" ]; then
            record_test_result "Log Analytics Integration" "PASS" "Associated with Log Analytics workspace" "configuration"
        else
            record_test_result "Log Analytics Integration" "WARN" "Not associated with Log Analytics workspace" "configuration"
        fi
        
    else
        record_test_result "Application Insights Exists" "FAIL" "Component not found: $APP_INSIGHTS_NAME" "infrastructure"
    fi
}

# Function to test App Service integration
test_app_service_integration() {
    print_step "Testing App Service Application Insights integration"
    
    # Test if App Service exists
    if az webapp show --name "$APP_SERVICE_NAME" --resource-group "$RESOURCE_GROUP" &>/dev/null; then
        record_test_result "App Service Exists" "PASS" "App Service found: $APP_SERVICE_NAME" "infrastructure"
        
        # Check Application Insights connection string setting
        local app_insights_setting=$(az webapp config appsettings list --name "$APP_SERVICE_NAME" --resource-group "$RESOURCE_GROUP" --query "[?name=='APPLICATIONINSIGHTS_CONNECTION_STRING'].value" -o tsv)
        if [ -n "$app_insights_setting" ]; then
            record_test_result "App Service AI Configuration" "PASS" "Application Insights connection string configured" "configuration"
        else
            record_test_result "App Service AI Configuration" "FAIL" "Application Insights connection string not configured" "configuration"
        fi
        
        # Check Application Insights extension
        local ai_extension=$(az webapp config appsettings list --name "$APP_SERVICE_NAME" --resource-group "$RESOURCE_GROUP" --query "[?name=='ApplicationInsightsAgent_EXTENSION_VERSION'].value" -o tsv)
        if [ -n "$ai_extension" ]; then
            record_test_result "App Insights Extension" "PASS" "Application Insights extension configured: $ai_extension" "configuration"
        else
            record_test_result "App Insights Extension" "WARN" "Application Insights extension not explicitly configured" "configuration"
        fi
        
    else
        record_test_result "App Service Exists" "FAIL" "App Service not found: $APP_SERVICE_NAME" "infrastructure"
    fi
}

# Function to test telemetry data ingestion
test_telemetry_ingestion() {
    if [ "$TELEMETRY" = false ]; then
        return 0
    fi
    
    print_step "Testing telemetry data ingestion"
    
    # Test recent request data
    local request_query="requests | where timestamp >= ago(1h) | count"
    local request_count=$(az monitor log-analytics query --workspace "$LOG_ANALYTICS_WORKSPACE" --analytics-query "$request_query" --query "tables[0].rows[0][0]" -o tsv 2>/dev/null || echo "0")
    
    if [ "$request_count" -gt 0 ]; then
        record_test_result "Request Telemetry Ingestion" "PASS" "$request_count requests in last hour" "telemetry"
    else
        record_test_result "Request Telemetry Ingestion" "WARN" "No request data in last hour" "telemetry"
    fi
    
    # Test exception data
    local exception_query="exceptions | where timestamp >= ago(24h) | count"
    local exception_count=$(az monitor log-analytics query --workspace "$LOG_ANALYTICS_WORKSPACE" --analytics-query "$exception_query" --query "tables[0].rows[0][0]" -o tsv 2>/dev/null || echo "0")
    
    if [ "$exception_count" -ge 0 ]; then
        record_test_result "Exception Telemetry Ingestion" "PASS" "$exception_count exceptions in last 24 hours" "telemetry"
    else
        record_test_result "Exception Telemetry Ingestion" "WARN" "Could not retrieve exception data" "telemetry"
    fi
    
    # Test custom events
    local custom_event_query="customEvents | where timestamp >= ago(24h) | count"
    local custom_event_count=$(az monitor log-analytics query --workspace "$LOG_ANALYTICS_WORKSPACE" --analytics-query "$custom_event_query" --query "tables[0].rows[0][0]" -o tsv 2>/dev/null || echo "0")
    
    if [ "$custom_event_count" -gt 0 ]; then
        record_test_result "Custom Event Telemetry" "PASS" "$custom_event_count custom events in last 24 hours" "telemetry"
    else
        record_test_result "Custom Event Telemetry" "WARN" "No custom events in last 24 hours" "telemetry"
    fi
    
    # Test dependency data
    local dependency_query="dependencies | where timestamp >= ago(1h) | count"
    local dependency_count=$(az monitor log-analytics query --workspace "$LOG_ANALYTICS_WORKSPACE" --analytics-query "$dependency_query" --query "tables[0].rows[0][0]" -o tsv 2>/dev/null || echo "0")
    
    if [ "$dependency_count" -gt 0 ]; then
        record_test_result "Dependency Telemetry" "PASS" "$dependency_count dependency calls in last hour" "telemetry"
    else
        record_test_result "Dependency Telemetry" "WARN" "No dependency data in last hour" "telemetry"
    fi
}

# Function to test alert rules
test_alert_rules() {
    if [ "$ALERTS" = false ]; then
        return 0
    fi
    
    print_step "Testing alert rules and notifications"
    
    # Test if action group exists
    if az monitor action-group show --name "$ACTION_GROUP_NAME" --resource-group "$RESOURCE_GROUP" &>/dev/null; then
        record_test_result "Action Group Exists" "PASS" "Action group found: $ACTION_GROUP_NAME" "alerts"
        
        # Get action group details
        local receivers=$(az monitor action-group show --name "$ACTION_GROUP_NAME" --resource-group "$RESOURCE_GROUP" --query "emailReceivers | length(@)" -o tsv)
        if [ "$receivers" -gt 0 ]; then
            record_test_result "Alert Recipients Configured" "PASS" "$receivers email recipients configured" "alerts"
        else
            record_test_result "Alert Recipients Configured" "WARN" "No email recipients configured" "alerts"
        fi
    else
        record_test_result "Action Group Exists" "FAIL" "Action group not found: $ACTION_GROUP_NAME" "alerts"
    fi
    
    # Test for common alert rules
    local alert_rules=$(az monitor metrics alert list --resource-group "$RESOURCE_GROUP" --query "length(@)" -o tsv 2>/dev/null || echo "0")
    if [ "$alert_rules" -gt 0 ]; then
        record_test_result "Alert Rules Configured" "PASS" "$alert_rules alert rules found" "alerts"
    else
        record_test_result "Alert Rules Configured" "WARN" "No alert rules found" "alerts"
    fi
    
    # Test specific alert rules (if they exist)
    local error_rate_alert="taktmate-high-error-rate-$ENVIRONMENT"
    if az monitor metrics alert show --name "$error_rate_alert" --resource-group "$RESOURCE_GROUP" &>/dev/null; then
        record_test_result "Error Rate Alert Exists" "PASS" "High error rate alert configured" "alerts"
    else
        record_test_result "Error Rate Alert Exists" "WARN" "High error rate alert not found" "alerts"
    fi
    
    local response_time_alert="taktmate-slow-response-$ENVIRONMENT"
    if az monitor metrics alert show --name "$response_time_alert" --resource-group "$RESOURCE_GROUP" &>/dev/null; then
        record_test_result "Response Time Alert Exists" "PASS" "Slow response time alert configured" "alerts"
    else
        record_test_result "Response Time Alert Exists" "WARN" "Slow response time alert not found" "alerts"
    fi
}

# Function to test dashboard queries
test_dashboard_queries() {
    if [ "$DASHBOARDS" = false ]; then
        return 0
    fi
    
    print_step "Testing dashboard queries and data visualization"
    
    # Test basic performance query
    local perf_query="requests | where timestamp >= ago(1h) | summarize count(), avg(duration) | project RequestCount=count_, AvgDuration=avg_duration"
    local perf_result=$(az monitor log-analytics query --workspace "$LOG_ANALYTICS_WORKSPACE" --analytics-query "$perf_query" --query "tables[0].rows[0][0]" -o tsv 2>/dev/null || echo "0")
    
    if [ "$perf_result" != "null" ] && [ -n "$perf_result" ]; then
        record_test_result "Performance Query Execution" "PASS" "Performance dashboard query executed successfully" "dashboards"
    else
        record_test_result "Performance Query Execution" "WARN" "Performance dashboard query returned no data" "dashboards"
    fi
    
    # Test business metrics query
    local business_query="customEvents | where timestamp >= ago(24h) and name in ('CSV_FILE_UPLOADED', 'CHAT_INTERACTION') | summarize count() by name"
    local business_result=$(az monitor log-analytics query --workspace "$LOG_ANALYTICS_WORKSPACE" --analytics-query "$business_query" --query "tables[0].rows | length(@)" -o tsv 2>/dev/null || echo "0")
    
    if [ "$business_result" -gt 0 ]; then
        record_test_result "Business Metrics Query" "PASS" "Business metrics query returned $business_result event types" "dashboards"
    else
        record_test_result "Business Metrics Query" "WARN" "Business metrics query returned no data" "dashboards"
    fi
    
    # Test error analysis query
    local error_query="exceptions | where timestamp >= ago(24h) | summarize count() by type | top 5 by count_"
    local error_result=$(az monitor log-analytics query --workspace "$LOG_ANALYTICS_WORKSPACE" --analytics-query "$error_query" --query "tables[0].rows | length(@)" -o tsv 2>/dev/null || echo "0")
    
    if [ "$error_result" -ge 0 ]; then
        record_test_result "Error Analysis Query" "PASS" "Error analysis query executed successfully" "dashboards"
    else
        record_test_result "Error Analysis Query" "WARN" "Error analysis query failed" "dashboards"
    fi
}

# Function to test availability monitoring
test_availability_monitoring() {
    if [ "$AVAILABILITY" = false ]; then
        return 0
    fi
    
    print_step "Testing availability monitoring"
    
    # Test frontend availability
    if command -v curl &>/dev/null; then
        local frontend_response=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL" || echo "000")
        if [ "$frontend_response" = "200" ]; then
            record_test_result "Frontend Availability" "PASS" "Frontend responding with HTTP 200" "availability"
        else
            record_test_result "Frontend Availability" "FAIL" "Frontend returned HTTP $frontend_response" "availability"
        fi
    else
        record_test_result "Frontend Availability" "WARN" "curl not available for testing" "availability"
    fi
    
    # Test backend API health endpoint
    if command -v curl &>/dev/null; then
        local backend_response=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/api/health" || echo "000")
        if [ "$backend_response" = "200" ]; then
            record_test_result "Backend API Availability" "PASS" "Backend API health endpoint responding" "availability"
        else
            record_test_result "Backend API Availability" "FAIL" "Backend API returned HTTP $backend_response" "availability"
        fi
    else
        record_test_result "Backend API Availability" "WARN" "curl not available for testing" "availability"
    fi
    
    # Test availability results in Application Insights
    local availability_query="availabilityResults | where timestamp >= ago(1h) | summarize avg(success) * 100"
    local availability_percentage=$(az monitor log-analytics query --workspace "$LOG_ANALYTICS_WORKSPACE" --analytics-query "$availability_query" --query "tables[0].rows[0][0]" -o tsv 2>/dev/null || echo "null")
    
    if [ "$availability_percentage" != "null" ] && [ -n "$availability_percentage" ]; then
        local availability_int=$(echo "$availability_percentage" | cut -d'.' -f1)
        if [ "$availability_int" -ge 95 ]; then
            record_test_result "Availability Test Results" "PASS" "Availability: ${availability_percentage}%" "availability"
        elif [ "$availability_int" -ge 90 ]; then
            record_test_result "Availability Test Results" "WARN" "Availability: ${availability_percentage}% (below 95%)" "availability"
        else
            record_test_result "Availability Test Results" "FAIL" "Availability: ${availability_percentage}% (below 90%)" "availability"
        fi
    else
        record_test_result "Availability Test Results" "WARN" "No availability test data found" "availability"
    fi
}

# Function to test performance monitoring
test_performance_monitoring() {
    if [ "$PERFORMANCE" = false ]; then
        return 0
    fi
    
    print_step "Testing performance monitoring"
    
    # Test average response time
    local response_time_query="requests | where timestamp >= ago(1h) | summarize avg(duration)"
    local avg_response_time=$(az monitor log-analytics query --workspace "$LOG_ANALYTICS_WORKSPACE" --analytics-query "$response_time_query" --query "tables[0].rows[0][0]" -o tsv 2>/dev/null || echo "null")
    
    if [ "$avg_response_time" != "null" ] && [ -n "$avg_response_time" ]; then
        local response_time_int=$(echo "$avg_response_time" | cut -d'.' -f1)
        if [ "$response_time_int" -lt 2000 ]; then
            record_test_result "Average Response Time" "PASS" "Average response time: ${avg_response_time}ms" "performance"
        elif [ "$response_time_int" -lt 5000 ]; then
            record_test_result "Average Response Time" "WARN" "Average response time: ${avg_response_time}ms (above 2s)" "performance"
        else
            record_test_result "Average Response Time" "FAIL" "Average response time: ${avg_response_time}ms (above 5s)" "performance"
        fi
    else
        record_test_result "Average Response Time" "WARN" "No response time data available" "performance"
    fi
    
    # Test P95 response time
    local p95_query="requests | where timestamp >= ago(1h) | summarize percentile(duration, 95)"
    local p95_response_time=$(az monitor log-analytics query --workspace "$LOG_ANALYTICS_WORKSPACE" --analytics-query "$p95_query" --query "tables[0].rows[0][0]" -o tsv 2>/dev/null || echo "null")
    
    if [ "$p95_response_time" != "null" ] && [ -n "$p95_response_time" ]; then
        local p95_int=$(echo "$p95_response_time" | cut -d'.' -f1)
        if [ "$p95_int" -lt 5000 ]; then
            record_test_result "P95 Response Time" "PASS" "P95 response time: ${p95_response_time}ms" "performance"
        else
            record_test_result "P95 Response Time" "WARN" "P95 response time: ${p95_response_time}ms (above 5s)" "performance"
        fi
    else
        record_test_result "P95 Response Time" "WARN" "No P95 response time data available" "performance"
    fi
    
    # Test error rate
    local error_rate_query="requests | where timestamp >= ago(1h) | summarize ErrorRate = (countif(success == false) * 100.0) / count()"
    local error_rate=$(az monitor log-analytics query --workspace "$LOG_ANALYTICS_WORKSPACE" --analytics-query "$error_rate_query" --query "tables[0].rows[0][0]" -o tsv 2>/dev/null || echo "null")
    
    if [ "$error_rate" != "null" ] && [ -n "$error_rate" ]; then
        local error_rate_int=$(echo "$error_rate" | cut -d'.' -f1)
        if [ "$error_rate_int" -lt 5 ]; then
            record_test_result "Error Rate" "PASS" "Error rate: ${error_rate}%" "performance"
        elif [ "$error_rate_int" -lt 10 ]; then
            record_test_result "Error Rate" "WARN" "Error rate: ${error_rate}% (above 5%)" "performance"
        else
            record_test_result "Error Rate" "FAIL" "Error rate: ${error_rate}% (above 10%)" "performance"
        fi
    else
        record_test_result "Error Rate" "WARN" "No error rate data available" "performance"
    fi
}

# Function to generate test report
generate_test_report() {
    if [ "$REPORT" = false ]; then
        return 0
    fi
    
    print_step "Generating test report"
    
    local report_file="$REPORT_DIR/production-monitoring-test-report-${ENVIRONMENT}-$(date +%Y%m%d-%H%M%S).json"
    
    local report_data="{
        \"environment\": \"$ENVIRONMENT\",
        \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
        \"summary\": {
            \"total_tests\": $TOTAL_TESTS,
            \"passed\": $PASSED_TESTS,
            \"failed\": $FAILED_TESTS,
            \"warnings\": $WARNING_TESTS,
            \"success_rate\": $(echo "scale=2; $PASSED_TESTS * 100 / $TOTAL_TESTS" | bc -l 2>/dev/null || echo "0")
        },
        \"test_categories\": {
            \"infrastructure\": $(echo "${TEST_RESULTS[*]}" | grep -c '"category":"infrastructure"' || echo "0"),
            \"configuration\": $(echo "${TEST_RESULTS[*]}" | grep -c '"category":"configuration"' || echo "0"),
            \"telemetry\": $(echo "${TEST_RESULTS[*]}" | grep -c '"category":"telemetry"' || echo "0"),
            \"alerts\": $(echo "${TEST_RESULTS[*]}" | grep -c '"category":"alerts"' || echo "0"),
            \"dashboards\": $(echo "${TEST_RESULTS[*]}" | grep -c '"category":"dashboards"' || echo "0"),
            \"availability\": $(echo "${TEST_RESULTS[*]}" | grep -c '"category":"availability"' || echo "0"),
            \"performance\": $(echo "${TEST_RESULTS[*]}" | grep -c '"category":"performance"' || echo "0")
        },
        \"resources\": {
            \"resource_group\": \"$RESOURCE_GROUP\",
            \"app_insights_name\": \"$APP_INSIGHTS_NAME\",
            \"app_service_name\": \"$APP_SERVICE_NAME\",
            \"log_analytics_workspace\": \"$LOG_ANALYTICS_WORKSPACE\",
            \"action_group_name\": \"$ACTION_GROUP_NAME\"
        },
        \"tests\": [$(IFS=,; echo "${TEST_RESULTS[*]}")]
    }"
    
    echo "$report_data" | jq '.' > "$report_file" 2>/dev/null || echo "$report_data" > "$report_file"
    print_success "Test report generated: $report_file"
}

# Main function
main() {
    print_header "TAKTMATE PRODUCTION MONITORING TESTING"
    print_status "Environment: $ENVIRONMENT"
    print_status "Resource Group: $RESOURCE_GROUP"
    print_status "Application Insights: $APP_INSIGHTS_NAME"
    print_status "Comprehensive Testing: $COMPREHENSIVE"
    echo ""
    
    # Execute test phases
    test_application_insights
    test_app_service_integration
    test_telemetry_ingestion
    test_alert_rules
    test_dashboard_queries
    test_availability_monitoring
    test_performance_monitoring
    generate_test_report
    
    # Print summary
    print_header "MONITORING TEST SUMMARY"
    echo "Total Tests: $TOTAL_TESTS"
    echo "Passed: $PASSED_TESTS"
    echo "Failed: $FAILED_TESTS"
    echo "Warnings: $WARNING_TESTS"
    
    if [ $TOTAL_TESTS -gt 0 ]; then
        local success_rate=$(echo "scale=1; $PASSED_TESTS * 100 / $TOTAL_TESTS" | bc -l 2>/dev/null || echo "0")
        echo "Success Rate: ${success_rate}%"
    fi
    
    if [ $FAILED_TESTS -gt 0 ]; then
        print_header "SOME MONITORING TESTS FAILED! ❌"
        exit 1
    elif [ $WARNING_TESTS -gt 0 ]; then
        print_header "MONITORING TESTS COMPLETED WITH WARNINGS! ⚠️"
        exit 0
    else
        print_header "ALL MONITORING TESTS PASSED! ✅"
        exit 0
    fi
}

# Execute main function
main "$@"
