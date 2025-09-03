#!/bin/bash

# TaktMate CORS Configuration Management Script
# Usage: ./configure-cors-settings.sh [environment] [domain] [options]
# Example: ./configure-cors-settings.sh production taktconnect.com --update --validate

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
    echo "TaktMate CORS Configuration Management"
    echo ""
    echo "Usage: $0 [environment] [domain] [options]"
    echo ""
    echo "Environments:"
    echo "  production  - Configure CORS for production environment"
    echo "  staging     - Configure CORS for staging environment"
    echo "  development - Configure CORS for development environment"
    echo "  all         - Configure CORS for all environments"
    echo ""
    echo "Domains:"
    echo "  taktconnect.com - Primary domain for TaktMate application"
    echo "  taktmate.com    - Alternative domain (if available)"
    echo ""
    echo "Options:"
    echo "  --update        Update backend CORS configuration"
    echo "  --validate      Validate CORS configuration and test endpoints"
    echo "  --generate      Generate environment-specific CORS configuration files"
    echo "  --azure         Update Azure App Service CORS settings"
    echo "  --test          Test CORS functionality across all domains"
    echo "  --report        Generate CORS configuration report"
    echo "  --dry-run       Show what would be changed without making changes"
    echo "  --verbose       Enable verbose output"
    echo "  --help          Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 production taktconnect.com --update --validate --azure"
    echo "  $0 all taktconnect.com --generate --test --report"
    echo "  $0 staging taktconnect.com --validate --test --verbose"
}

# Parse arguments
ENVIRONMENT=""
DOMAIN=""
UPDATE=false
VALIDATE=false
GENERATE=false
AZURE=false
TEST=false
REPORT=false
DRY_RUN=false
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
        --update)
            UPDATE=true
            shift
            ;;
        --validate)
            VALIDATE=true
            shift
            ;;
        --generate)
            GENERATE=true
            shift
            ;;
        --azure)
            AZURE=true
            shift
            ;;
        --test)
            TEST=true
            shift
            ;;
        --report)
            REPORT=true
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
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$PROJECT_ROOT/backend"
REPORT_DIR="$SCRIPT_DIR/reports"

# Create reports directory if needed
if [ "$REPORT" = true ]; then
    mkdir -p "$REPORT_DIR"
fi

# CORS configuration results tracking
CORS_RESULTS=()

# Function to record CORS result
record_cors_result() {
    local operation="$1"
    local status="$2"
    local message="$3"
    local details="${4:-}"
    
    case "$status" in
        "PASS")
            print_success "$operation: $message"
            ;;
        "FAIL")
            print_error "$operation: $message"
            ;;
        "WARN")
            print_warning "$operation: $message"
            ;;
    esac
    
    if [ "$VERBOSE" = true ] && [ -n "$details" ]; then
        print_status "  Details: $details"
    fi
    
    if [ "$REPORT" = true ]; then
        local result_data="{\"operation\":\"$operation\",\"status\":\"$status\",\"message\":\"$message\",\"details\":\"$details\",\"environment\":\"$ENVIRONMENT\",\"domain\":\"$DOMAIN\",\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}"
        CORS_RESULTS+=("$result_data")
    fi
}

# Function to get environment-specific domains
get_environment_domains() {
    local env="$1"
    local base_domain="$2"
    
    case "$env" in
        "production")
            echo "https://app.${base_domain}"
            echo "https://www.${base_domain}"
            ;;
        "staging")
            echo "https://staging.${base_domain}"
            ;;
        "development")
            echo "https://dev.${base_domain}"
            echo "http://localhost:3000"
            echo "http://127.0.0.1:3000"
            ;;
    esac
}

# Function to get backend API URLs
get_backend_api_urls() {
    local env="$1"
    local base_domain="$2"
    
    case "$env" in
        "production")
            echo "https://api.${base_domain}"
            echo "https://taktmate-api-prod.azurewebsites.net"
            ;;
        "staging")
            echo "https://api-staging.${base_domain}"
            echo "https://taktmate-api-staging.azurewebsites.net"
            ;;
        "development")
            echo "http://localhost:3001"
            echo "https://taktmate-api-dev.azurewebsites.net"
            ;;
    esac
}

# Function to generate CORS configuration
generate_cors_configuration() {
    local env="$1"
    
    print_step "Generating CORS configuration for $env environment"
    
    local frontend_domains=($(get_environment_domains "$env" "$DOMAIN"))
    local backend_urls=($(get_backend_api_urls "$env" "$DOMAIN"))
    
    # Generate JavaScript CORS configuration
    local cors_config_file="$BACKEND_DIR/config/cors-${env}.js"
    
    if [ "$DRY_RUN" = true ]; then
        print_status "DRY RUN: Would create $cors_config_file"
        return 0
    fi
    
    cat > "$cors_config_file" << EOF
// TaktMate CORS Configuration for $env Environment
// Generated on $(date -u +%Y-%m-%dT%H:%M:%SZ)

const corsConfiguration = {
    // Frontend origins allowed to make requests to the backend
    allowedOrigins: [
$(for domain in "${frontend_domains[@]}"; do echo "        '$domain',"; done)
        // Development origins (always included for testing)
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        // Environment variable override
        process.env.FRONTEND_URL,
        process.env.CORS_ORIGIN_OVERRIDE
    ].filter(Boolean).filter((value, index, self) => self.indexOf(value) === index), // Remove duplicates

    // Backend API URLs (for reference and validation)
    backendUrls: [
$(for url in "${backend_urls[@]}"; do echo "        '$url',"; done)
    ],

    // CORS options for Express.js cors middleware
    corsOptions: {
        origin: function(origin, callback) {
            // Allow requests with no origin (mobile apps, Postman, etc.)
            if (!origin) {
                return callback(null, true);
            }
            
            // Check if origin is in allowed list
            if (corsConfiguration.allowedOrigins.includes(origin)) {
                return callback(null, true);
            }
            
            // For development, be more permissive
            if (process.env.NODE_ENV === 'development') {
                console.log('CORS: Allowing origin in development mode:', origin);
                return callback(null, true);
            }
            
            // Log blocked origin for debugging
            console.warn('CORS: Blocked origin:', origin);
            return callback(new Error('Not allowed by CORS policy'), false);
        },
        credentials: true, // Allow cookies and authorization headers
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD', 'PATCH'],
        allowedHeaders: [
            'Content-Type',
            'Authorization',
            'X-Requested-With',
            'Accept',
            'Origin',
            'Cache-Control',
            'X-File-Name',
            'X-File-Size',
            'X-File-Type',
            // Azure AD B2C headers
            'X-MS-CLIENT-PRINCIPAL-ID',
            'X-MS-CLIENT-PRINCIPAL-NAME',
            'X-MS-CLIENT-PRINCIPAL',
            // Custom application headers
            'X-API-Version',
            'X-Request-ID',
            'X-Correlation-ID'
        ],
        exposedHeaders: [
            'X-Total-Count',
            'X-Page-Count',
            'X-Request-ID',
            'X-Correlation-ID',
            'X-Rate-Limit-Limit',
            'X-Rate-Limit-Remaining',
            'X-Rate-Limit-Reset'
        ],
        optionsSuccessStatus: 200, // Some legacy browsers (IE11, various SmartTVs) choke on 204
        maxAge: 86400 // 24 hours - cache preflight response
    },

    // Environment-specific settings
    environment: '$env',
    domain: '$DOMAIN',
    
    // Security settings
    security: {
        // Strict origin checking for production
        strictOriginCheck: $([ "$env" = "production" ] && echo "true" || echo "false"),
        
        // Log CORS violations
        logViolations: true,
        
        // Rate limiting for preflight requests
        preflightRateLimit: {
            windowMs: 60000, // 1 minute
            max: $([ "$env" = "production" ] && echo "100" || echo "1000") // requests per window
        }
    },

    // Validation function
    validate: function() {
        const requiredOrigins = corsConfiguration.allowedOrigins.filter(origin => origin && !origin.includes('localhost'));
        
        if (requiredOrigins.length === 0) {
            console.warn('CORS: No production origins configured');
            return false;
        }
        
        console.log('CORS: Configuration validated successfully');
        console.log('CORS: Allowed origins:', requiredOrigins.length);
        
        return true;
    }
};

module.exports = corsConfiguration;
EOF

    if [ -f "$cors_config_file" ]; then
        record_cors_result "CORS Configuration Generation" "PASS" "Generated configuration for $env environment" "File: $cors_config_file"
    else
        record_cors_result "CORS Configuration Generation" "FAIL" "Failed to generate configuration for $env environment" "File: $cors_config_file"
    fi
}

# Function to update backend CORS configuration
update_backend_cors() {
    local env="$1"
    
    print_step "Updating backend CORS configuration for $env environment"
    
    local backend_index="$BACKEND_DIR/index.js"
    
    if [ ! -f "$backend_index" ]; then
        record_cors_result "Backend Update" "FAIL" "Backend index.js not found" "Path: $backend_index"
        return 1
    fi
    
    if [ "$DRY_RUN" = true ]; then
        print_status "DRY RUN: Would update CORS configuration in $backend_index"
        return 0
    fi
    
    # Create backup
    cp "$backend_index" "$backend_index.cors-backup-$(date +%Y%m%d-%H%M%S)"
    
    # Generate updated CORS configuration
    local frontend_domains=($(get_environment_domains "$env" "$DOMAIN"))
    local cors_origins_array=""
    
    for domain in "${frontend_domains[@]}"; do
        cors_origins_array+="\n  '$domain',"
    done
    
    # Update CORS origins in backend
    if command -v node &>/dev/null; then
        cat > "/tmp/update_cors.js" << EOF
const fs = require('fs');
const path = '$backend_index';

let content = fs.readFileSync(path, 'utf8');

// Find and replace CORS origins section
const corsOriginsRegex = /const corsOrigins = \[[\s\S]*?\];/;
const newCorsOrigins = \`const corsOrigins = [${cors_origins_array}
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  process.env.FRONTEND_URL,
  process.env.CORS_ORIGIN_OVERRIDE
].filter(Boolean).filter((value, index, self) => self.indexOf(value) === index);\`;

if (corsOriginsRegex.test(content)) {
    content = content.replace(corsOriginsRegex, newCorsOrigins);
    fs.writeFileSync(path, content, 'utf8');
    console.log('CORS origins updated successfully');
} else {
    console.error('CORS origins section not found');
    process.exit(1);
}
EOF
        
        if node "/tmp/update_cors.js"; then
            record_cors_result "Backend CORS Update" "PASS" "Updated CORS origins in backend" "Environment: $env"
        else
            record_cors_result "Backend CORS Update" "FAIL" "Failed to update CORS origins" "Environment: $env"
        fi
        
        rm -f "/tmp/update_cors.js"
    else
        record_cors_result "Backend CORS Update" "WARN" "Node.js not available - manual update required" "Environment: $env"
    fi
}

# Function to configure Azure App Service CORS
configure_azure_cors() {
    local env="$1"
    
    print_step "Configuring Azure App Service CORS for $env environment"
    
    local frontend_domains=($(get_environment_domains "$env" "$DOMAIN"))
    local app_service_name
    local resource_group
    
    case "$env" in
        "production")
            app_service_name="taktmate-api-prod"
            resource_group="taktmate-prod-rg"
            ;;
        "staging")
            app_service_name="taktmate-api-staging"
            resource_group="taktmate-staging-rg"
            ;;
        "development")
            app_service_name="taktmate-api-dev"
            resource_group="taktmate-dev-rg"
            ;;
    esac
    
    if ! command -v az &>/dev/null; then
        record_cors_result "Azure CORS Configuration" "WARN" "Azure CLI not available" "Install Azure CLI to configure App Service CORS"
        return 0
    fi
    
    if ! az account show &>/dev/null; then
        record_cors_result "Azure CORS Configuration" "WARN" "Not logged into Azure CLI" "Run 'az login' to authenticate"
        return 0
    fi
    
    if [ "$DRY_RUN" = true ]; then
        print_status "DRY RUN: Would configure CORS for App Service: $app_service_name"
        return 0
    fi
    
    # Check if App Service exists
    if ! az webapp show --name "$app_service_name" --resource-group "$resource_group" &>/dev/null; then
        record_cors_result "Azure CORS Configuration" "WARN" "App Service not found: $app_service_name" "Create App Service first"
        return 0
    fi
    
    # Configure CORS origins
    local cors_origins_json=""
    for domain in "${frontend_domains[@]}"; do
        cors_origins_json+="\"$domain\","
    done
    cors_origins_json="${cors_origins_json%,}" # Remove trailing comma
    
    if az webapp cors add --resource-group "$resource_group" --name "$app_service_name" --allowed-origins $cors_origins_json &>/dev/null; then
        record_cors_result "Azure CORS Configuration" "PASS" "Configured CORS for App Service" "App Service: $app_service_name"
    else
        record_cors_result "Azure CORS Configuration" "FAIL" "Failed to configure CORS for App Service" "App Service: $app_service_name"
    fi
    
    # Enable credentials if needed
    if az webapp cors credentials --resource-group "$resource_group" --name "$app_service_name" --enable &>/dev/null; then
        record_cors_result "Azure CORS Credentials" "PASS" "Enabled CORS credentials support" "App Service: $app_service_name"
    else
        record_cors_result "Azure CORS Credentials" "WARN" "Could not enable CORS credentials" "App Service: $app_service_name"
    fi
}

# Function to validate CORS configuration
validate_cors_configuration() {
    local env="$1"
    
    print_step "Validating CORS configuration for $env environment"
    
    local frontend_domains=($(get_environment_domains "$env" "$DOMAIN"))
    local backend_urls=($(get_backend_api_urls "$env" "$DOMAIN"))
    
    # Validate backend CORS configuration file
    local cors_config_file="$BACKEND_DIR/config/cors-${env}.js"
    if [ -f "$cors_config_file" ]; then
        record_cors_result "CORS Config File" "PASS" "Configuration file exists" "File: $cors_config_file"
        
        # Validate configuration syntax if Node.js is available
        if command -v node &>/dev/null; then
            if node -c "$cors_config_file" 2>/dev/null; then
                record_cors_result "CORS Config Syntax" "PASS" "Configuration syntax is valid" "File: $cors_config_file"
            else
                record_cors_result "CORS Config Syntax" "FAIL" "Configuration syntax error" "File: $cors_config_file"
            fi
        fi
    else
        record_cors_result "CORS Config File" "FAIL" "Configuration file not found" "File: $cors_config_file"
    fi
    
    # Validate backend index.js CORS configuration
    local backend_index="$BACKEND_DIR/index.js"
    if [ -f "$backend_index" ]; then
        # Check if CORS origins include custom domains
        for domain in "${frontend_domains[@]}"; do
            if grep -q "$domain" "$backend_index"; then
                record_cors_result "Backend CORS Origin ($domain)" "PASS" "Domain included in CORS origins" "Domain: $domain"
            else
                record_cors_result "Backend CORS Origin ($domain)" "WARN" "Domain not found in CORS origins" "Domain: $domain"
            fi
        done
        
        # Check for CORS middleware configuration
        if grep -q "app.use(cors(" "$backend_index"; then
            record_cors_result "CORS Middleware" "PASS" "CORS middleware configured" "File: $backend_index"
        else
            record_cors_result "CORS Middleware" "FAIL" "CORS middleware not found" "File: $backend_index"
        fi
    else
        record_cors_result "Backend Validation" "FAIL" "Backend index.js not found" "Path: $backend_index"
    fi
}

# Function to test CORS functionality
test_cors_functionality() {
    local env="$1"
    
    print_step "Testing CORS functionality for $env environment"
    
    local frontend_domains=($(get_environment_domains "$env" "$DOMAIN"))
    local backend_urls=($(get_backend_api_urls "$env" "$DOMAIN"))
    
    if ! command -v curl &>/dev/null; then
        record_cors_result "CORS Testing Tools" "WARN" "curl not available - skipping CORS tests" "Install curl to test CORS functionality"
        return 0
    fi
    
    # Test CORS for each frontend domain against each backend URL
    for frontend_domain in "${frontend_domains[@]}"; do
        for backend_url in "${backend_urls[@]}"; do
            # Skip localhost combinations that don't make sense
            if [[ "$frontend_domain" == *"localhost"* && "$backend_url" == *"azurewebsites.net"* ]]; then
                continue
            fi
            
            # Test preflight OPTIONS request
            local preflight_response=$(curl -s -o /dev/null -w "%{http_code}" \
                -X OPTIONS \
                -H "Origin: $frontend_domain" \
                -H "Access-Control-Request-Method: POST" \
                -H "Access-Control-Request-Headers: Content-Type,Authorization" \
                "$backend_url/test" \
                --max-time 10 2>/dev/null || echo "000")
            
            if [ "$preflight_response" = "200" ] || [ "$preflight_response" = "204" ]; then
                record_cors_result "CORS Preflight ($frontend_domain → $(basename $backend_url))" "PASS" "Preflight successful (HTTP $preflight_response)" "Origin: $frontend_domain"
            elif [ "$preflight_response" = "000" ]; then
                record_cors_result "CORS Preflight ($frontend_domain → $(basename $backend_url))" "WARN" "Backend not accessible" "URL: $backend_url"
            else
                record_cors_result "CORS Preflight ($frontend_domain → $(basename $backend_url))" "FAIL" "Preflight failed (HTTP $preflight_response)" "Origin: $frontend_domain"
            fi
            
            # Test actual request with CORS headers
            local cors_headers=$(curl -s -I \
                -H "Origin: $frontend_domain" \
                "$backend_url/test" \
                --max-time 10 2>/dev/null | grep -i "access-control" || echo "")
            
            if [ -n "$cors_headers" ]; then
                record_cors_result "CORS Headers ($frontend_domain → $(basename $backend_url))" "PASS" "CORS headers present" "Headers found: $(echo "$cors_headers" | wc -l)"
            elif [ "$preflight_response" != "000" ]; then
                record_cors_result "CORS Headers ($frontend_domain → $(basename $backend_url))" "WARN" "No CORS headers found" "Origin: $frontend_domain"
            fi
        done
    done
}

# Function to generate CORS report
generate_cors_report() {
    if [ "$REPORT" = false ]; then
        return 0
    fi
    
    print_step "Generating CORS configuration report"
    
    local report_file="$REPORT_DIR/cors-configuration-report-${ENVIRONMENT}-${DOMAIN}-$(date +%Y%m%d-%H%M%S).json"
    
    local frontend_domains=($(get_environment_domains "$ENVIRONMENT" "$DOMAIN"))
    local backend_urls=($(get_backend_api_urls "$ENVIRONMENT" "$DOMAIN"))
    
    local report_data="{
        \"environment\": \"$ENVIRONMENT\",
        \"domain\": \"$DOMAIN\",
        \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
        \"configuration\": {
            \"frontend_domains\": [$(printf '\"%s\",' "${frontend_domains[@]}" | sed 's/,$//')],,
            \"backend_urls\": [$(printf '\"%s\",' "${backend_urls[@]}" | sed 's/,$//')],,
            \"operations\": {
                \"update\": $UPDATE,
                \"validate\": $VALIDATE,
                \"generate\": $GENERATE,
                \"azure\": $AZURE,
                \"test\": $TEST
            }
        },
        \"results\": [$(IFS=,; echo "${CORS_RESULTS[*]}")]
    }"
    
    echo "$report_data" | jq '.' > "$report_file" 2>/dev/null || echo "$report_data" > "$report_file"
    record_cors_result "CORS Report Generation" "PASS" "Report generated successfully" "File: $report_file"
}

# Function to process single environment
process_environment() {
    local env="$1"
    
    print_header "CONFIGURING CORS SETTINGS - $env ENVIRONMENT"
    
    # Generate CORS configuration
    if [ "$GENERATE" = true ]; then
        generate_cors_configuration "$env"
    fi
    
    # Update backend CORS
    if [ "$UPDATE" = true ]; then
        update_backend_cors "$env"
    fi
    
    # Configure Azure CORS
    if [ "$AZURE" = true ]; then
        configure_azure_cors "$env"
    fi
    
    # Validate CORS configuration
    if [ "$VALIDATE" = true ]; then
        validate_cors_configuration "$env"
    fi
    
    # Test CORS functionality
    if [ "$TEST" = true ]; then
        test_cors_functionality "$env"
    fi
}

# Main function
main() {
    print_header "TAKTMATE CORS CONFIGURATION MANAGEMENT"
    print_status "Environment: $ENVIRONMENT"
    print_status "Domain: $DOMAIN"
    print_status "Operations: Update=$UPDATE, Validate=$VALIDATE, Generate=$GENERATE, Azure=$AZURE, Test=$TEST"
    print_status "Dry Run: $DRY_RUN"
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
    
    # Generate report
    generate_cors_report
    
    # Summary
    print_header "CORS CONFIGURATION SUMMARY"
    
    local total_operations=${#CORS_RESULTS[@]}
    local passed_operations=$(echo "${CORS_RESULTS[*]}" | grep -c '"status":"PASS"' || echo "0")
    local failed_operations=$(echo "${CORS_RESULTS[*]}" | grep -c '"status":"FAIL"' || echo "0")
    local warning_operations=$(echo "${CORS_RESULTS[*]}" | grep -c '"status":"WARN"' || echo "0")
    
    echo "Total Operations: $total_operations"
    echo "Passed: $passed_operations"
    echo "Failed: $failed_operations"
    echo "Warnings: $warning_operations"
    
    if [ $total_operations -gt 0 ]; then
        local success_rate=$(echo "scale=1; $passed_operations * 100 / $total_operations" | bc -l 2>/dev/null || echo "0")
        echo "Success Rate: ${success_rate}%"
    fi
    
    if [ $failed_operations -gt 0 ]; then
        print_header "SOME CORS CONFIGURATION OPERATIONS FAILED! ❌"
        echo ""
        echo "Common issues and solutions:"
        echo "1. Ensure backend server is running and accessible"
        echo "2. Check Azure CLI authentication and permissions"
        echo "3. Verify domain names and URLs are correct"
        echo "4. Review backend CORS configuration syntax"
        echo "5. Test CORS manually with browser developer tools"
        exit 1
    elif [ $warning_operations -gt 0 ]; then
        print_header "CORS CONFIGURATION COMPLETED WITH WARNINGS! ⚠️"
        echo ""
        echo "Review warnings above - some may be expected during setup"
        exit 0
    else
        print_header "ALL CORS CONFIGURATION OPERATIONS COMPLETED SUCCESSFULLY! ✅"
        exit 0
    fi
}

# Execute main function
main "$@"
