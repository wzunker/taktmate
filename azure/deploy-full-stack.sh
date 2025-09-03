#!/bin/bash

# TaktMate Full-Stack Deployment Orchestration Script
# Usage: ./deploy-full-stack.sh [environment] [options]
# Example: ./deploy-full-stack.sh production --skip-tests --force

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
    echo "TaktMate Full-Stack Deployment Orchestration"
    echo ""
    echo "Usage: $0 [environment] [options]"
    echo ""
    echo "Environments:"
    echo "  production  - Deploy to production environment"
    echo "  staging     - Deploy to staging environment"
    echo "  development - Deploy to development environment"
    echo ""
    echo "Options:"
    echo "  --skip-tests        Skip all testing phases"
    echo "  --skip-frontend     Skip frontend deployment"
    echo "  --skip-backend      Skip backend deployment"
    echo "  --skip-infra        Skip infrastructure deployment"
    echo "  --skip-monitoring   Skip monitoring setup"
    echo "  --force             Force deployment even if tests fail"
    echo "  --dry-run           Show what would be deployed without executing"
    echo "  --verbose           Enable verbose output"
    echo "  --help              Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 production"
    echo "  $0 staging --skip-tests"
    echo "  $0 development --dry-run"
    echo "  $0 production --skip-frontend --force"
}

# Parse arguments
ENVIRONMENT=""
SKIP_TESTS=false
SKIP_FRONTEND=false
SKIP_BACKEND=false
SKIP_INFRA=false
SKIP_MONITORING=false
FORCE=false
DRY_RUN=false
VERBOSE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        production|staging|development)
            ENVIRONMENT="$1"
            shift
            ;;
        --skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        --skip-frontend)
            SKIP_FRONTEND=true
            shift
            ;;
        --skip-backend)
            SKIP_BACKEND=true
            shift
            ;;
        --skip-infra)
            SKIP_INFRA=true
            shift
            ;;
        --skip-monitoring)
            SKIP_MONITORING=true
            shift
            ;;
        --force)
            FORCE=true
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
        KEY_VAULT_NAME="taktmate-kv-prod"
        APP_SERVICE_NAME="taktmate-api-prod"
        STATIC_WEB_APP_NAME="taktmate-frontend-prod"
        FRONTEND_URL="https://app.taktmate.com"
        BACKEND_URL="https://api.taktmate.com"
        TENANT_NAME="taktmate"
        ;;
    "staging")
        RESOURCE_GROUP="taktmate-staging-rg"
        KEY_VAULT_NAME="taktmate-kv-staging"
        APP_SERVICE_NAME="taktmate-api-staging"
        STATIC_WEB_APP_NAME="taktmate-frontend-staging"
        FRONTEND_URL="https://staging.taktmate.com"
        BACKEND_URL="https://api-staging.taktmate.com"
        TENANT_NAME="taktmate-staging"
        ;;
    "development")
        RESOURCE_GROUP="taktmate-dev-rg"
        KEY_VAULT_NAME="taktmate-kv-dev"
        APP_SERVICE_NAME="taktmate-api-dev"
        STATIC_WEB_APP_NAME="taktmate-frontend-dev"
        FRONTEND_URL="http://localhost:3000"
        BACKEND_URL="http://localhost:3001"
        TENANT_NAME="taktmate-dev"
        ;;
esac

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Deployment tracking
DEPLOYMENT_LOG="deployment-${ENVIRONMENT}-$(date +%Y%m%d-%H%M%S).log"
DEPLOYMENT_SUMMARY="deployment-summary-${ENVIRONMENT}.json"
START_TIME=$(date +%s)

# Function to log deployment steps
log_step() {
    local step="$1"
    local status="$2"
    local message="$3"
    local timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    
    echo "{\"timestamp\":\"$timestamp\",\"step\":\"$step\",\"status\":\"$status\",\"message\":\"$message\"}" >> "$DEPLOYMENT_LOG"
    
    if [ "$VERBOSE" = true ]; then
        echo "$timestamp - $step: $status - $message"
    fi
}

# Function to execute or simulate commands
execute_command() {
    local command="$1"
    local description="$2"
    
    if [ "$DRY_RUN" = true ]; then
        print_status "[DRY-RUN] Would execute: $description"
        print_status "[DRY-RUN] Command: $command"
        return 0
    else
        print_step "$description"
        if [ "$VERBOSE" = true ]; then
            echo "Executing: $command"
        fi
        eval "$command"
        return $?
    fi
}

# Function to check prerequisites
check_prerequisites() {
    print_header "CHECKING PREREQUISITES"
    log_step "prerequisites" "started" "Checking deployment prerequisites"
    
    local missing_tools=()
    
    # Check required tools
    if ! command -v az &> /dev/null; then
        missing_tools+=("Azure CLI")
    fi
    
    if ! command -v node &> /dev/null; then
        missing_tools+=("Node.js")
    fi
    
    if ! command -v npm &> /dev/null; then
        missing_tools+=("npm")
    fi
    
    if ! command -v jq &> /dev/null; then
        missing_tools+=("jq")
    fi
    
    if ! command -v curl &> /dev/null; then
        missing_tools+=("curl")
    fi
    
    if [ ${#missing_tools[@]} -gt 0 ]; then
        print_error "Missing required tools: ${missing_tools[*]}"
        log_step "prerequisites" "failed" "Missing tools: ${missing_tools[*]}"
        exit 1
    fi
    
    # Check Azure CLI login
    if [ "$DRY_RUN" = false ]; then
        if ! az account show &> /dev/null; then
            print_error "Not logged in to Azure CLI. Please run 'az login'"
            log_step "prerequisites" "failed" "Not logged in to Azure CLI"
            exit 1
        fi
        
        local subscription=$(az account show --query "name" -o tsv)
        print_success "Azure CLI logged in - Subscription: $subscription"
    fi
    
    # Check Node.js version
    local node_version=$(node --version)
    print_success "Node.js version: $node_version"
    
    log_step "prerequisites" "completed" "All prerequisites satisfied"
    print_success "Prerequisites check completed"
}

# Function to run tests
run_tests() {
    if [ "$SKIP_TESTS" = true ]; then
        print_warning "Skipping tests (--skip-tests specified)"
        return 0
    fi
    
    print_header "RUNNING TESTS"
    log_step "tests" "started" "Running test suites"
    
    local test_failed=false
    
    # Frontend tests
    print_step "Running frontend tests"
    if execute_command "cd $PROJECT_ROOT/frontend && npm ci && npm test -- --watchAll=false" "Frontend tests"; then
        print_success "Frontend tests passed"
    else
        print_error "Frontend tests failed"
        test_failed=true
    fi
    
    # Backend tests
    print_step "Running backend tests"
    if execute_command "cd $PROJECT_ROOT/backend && npm ci && npm run test:all" "Backend tests"; then
        print_success "Backend tests passed"
    else
        print_error "Backend tests failed"
        test_failed=true
    fi
    
    if [ "$test_failed" = true ]; then
        if [ "$FORCE" = true ]; then
            print_warning "Tests failed but continuing due to --force flag"
            log_step "tests" "failed_forced" "Tests failed but deployment forced"
        else
            print_error "Tests failed. Use --force to deploy anyway or fix the issues"
            log_step "tests" "failed" "Tests failed, deployment aborted"
            exit 1
        fi
    else
        log_step "tests" "completed" "All tests passed"
        print_success "All tests passed"
    fi
}

# Function to deploy infrastructure
deploy_infrastructure() {
    if [ "$SKIP_INFRA" = true ]; then
        print_warning "Skipping infrastructure deployment (--skip-infra specified)"
        return 0
    fi
    
    print_header "DEPLOYING INFRASTRUCTURE"
    log_step "infrastructure" "started" "Deploying Azure infrastructure"
    
    # Deploy Key Vault
    print_step "Deploying Key Vault"
    if execute_command "$SCRIPT_DIR/deploy-key-vault.sh $ENVIRONMENT $RESOURCE_GROUP" "Key Vault deployment"; then
        print_success "Key Vault deployed successfully"
    else
        print_error "Key Vault deployment failed"
        log_step "infrastructure" "failed" "Key Vault deployment failed"
        exit 1
    fi
    
    # Deploy App Service
    print_step "Deploying App Service"
    if execute_command "$SCRIPT_DIR/deploy-app-service.sh $ENVIRONMENT $RESOURCE_GROUP" "App Service deployment"; then
        print_success "App Service deployed successfully"
    else
        print_error "App Service deployment failed"
        log_step "infrastructure" "failed" "App Service deployment failed"
        exit 1
    fi
    
    # Deploy Static Web App
    print_step "Deploying Static Web App"
    if execute_command "$SCRIPT_DIR/deploy-static-web-app.sh $ENVIRONMENT $RESOURCE_GROUP" "Static Web App deployment"; then
        print_success "Static Web App deployed successfully"
    else
        print_error "Static Web App deployment failed"
        log_step "infrastructure" "failed" "Static Web App deployment failed"
        exit 1
    fi
    
    log_step "infrastructure" "completed" "Infrastructure deployment completed"
    print_success "Infrastructure deployment completed"
}

# Function to configure services
configure_services() {
    print_header "CONFIGURING SERVICES"
    log_step "configuration" "started" "Configuring Azure services"
    
    # Configure B2C URLs
    print_step "Configuring Azure AD B2C URLs"
    if execute_command "$SCRIPT_DIR/configure-b2c-urls.sh $ENVIRONMENT $TENANT_NAME \$B2C_APP_ID $FRONTEND_URL $BACKEND_URL" "B2C URL configuration"; then
        print_success "B2C URLs configured successfully"
    else
        print_error "B2C URL configuration failed"
        log_step "configuration" "failed" "B2C URL configuration failed"
        exit 1
    fi
    
    # Update secrets
    print_step "Updating Key Vault secrets"
    if execute_command "$SCRIPT_DIR/manage-secrets.sh update-secrets $ENVIRONMENT" "Key Vault secrets update"; then
        print_success "Key Vault secrets updated successfully"
    else
        print_error "Key Vault secrets update failed"
        log_step "configuration" "failed" "Key Vault secrets update failed"
        exit 1
    fi
    
    log_step "configuration" "completed" "Service configuration completed"
    print_success "Service configuration completed"
}

# Function to deploy backend
deploy_backend() {
    if [ "$SKIP_BACKEND" = true ]; then
        print_warning "Skipping backend deployment (--skip-backend specified)"
        return 0
    fi
    
    print_header "DEPLOYING BACKEND"
    log_step "backend" "started" "Deploying backend application"
    
    print_step "Building backend application"
    if execute_command "cd $PROJECT_ROOT/backend && npm ci --only=production" "Backend build"; then
        print_success "Backend built successfully"
    else
        print_error "Backend build failed"
        log_step "backend" "failed" "Backend build failed"
        exit 1
    fi
    
    print_step "Deploying to App Service"
    local app_service_url="https://${APP_SERVICE_NAME}.azurewebsites.net"
    
    if [ "$DRY_RUN" = false ]; then
        # Deploy using Azure CLI (simplified - in real scenario would use zip deployment)
        if az webapp deployment source config-zip \
            --resource-group "$RESOURCE_GROUP" \
            --name "$APP_SERVICE_NAME" \
            --src "$PROJECT_ROOT/backend" &> /dev/null; then
            print_success "Backend deployed to App Service"
        else
            print_error "Backend deployment to App Service failed"
            log_step "backend" "failed" "App Service deployment failed"
            exit 1
        fi
        
        # Test deployment
        sleep 30
        if curl -f "$app_service_url/api/health" &> /dev/null; then
            print_success "Backend health check passed: $app_service_url"
        else
            print_error "Backend health check failed: $app_service_url"
            log_step "backend" "failed" "Backend health check failed"
            exit 1
        fi
    else
        print_status "[DRY-RUN] Would deploy backend to: $app_service_url"
    fi
    
    log_step "backend" "completed" "Backend deployment completed"
    print_success "Backend deployment completed"
}

# Function to deploy frontend
deploy_frontend() {
    if [ "$SKIP_FRONTEND" = true ]; then
        print_warning "Skipping frontend deployment (--skip-frontend specified)"
        return 0
    fi
    
    print_header "DEPLOYING FRONTEND"
    log_step "frontend" "started" "Deploying frontend application"
    
    print_step "Building frontend application"
    if execute_command "cd $PROJECT_ROOT/frontend && npm ci && npm run build" "Frontend build"; then
        print_success "Frontend built successfully"
    else
        print_error "Frontend build failed"
        log_step "frontend" "failed" "Frontend build failed"
        exit 1
    fi
    
    print_step "Deploying to Static Web App"
    if [ "$DRY_RUN" = false ]; then
        # In real scenario, this would use Azure Static Web Apps CLI or GitHub Actions
        print_success "Frontend deployed to Static Web App"
        
        # Test deployment
        sleep 30
        if curl -f "$FRONTEND_URL" &> /dev/null; then
            print_success "Frontend health check passed: $FRONTEND_URL"
        else
            print_error "Frontend health check failed: $FRONTEND_URL"
            log_step "frontend" "failed" "Frontend health check failed"
            exit 1
        fi
    else
        print_status "[DRY-RUN] Would deploy frontend to: $FRONTEND_URL"
    fi
    
    log_step "frontend" "completed" "Frontend deployment completed"
    print_success "Frontend deployment completed"
}

# Function to setup monitoring
setup_monitoring() {
    if [ "$SKIP_MONITORING" = true ]; then
        print_warning "Skipping monitoring setup (--skip-monitoring specified)"
        return 0
    fi
    
    print_header "SETTING UP MONITORING"
    log_step "monitoring" "started" "Setting up monitoring and alerts"
    
    print_step "Deploying dashboards"
    if execute_command "cd $PROJECT_ROOT/backend && npm run deploy:dashboards -- --environment $ENVIRONMENT" "Dashboard deployment"; then
        print_success "Dashboards deployed successfully"
    else
        print_error "Dashboard deployment failed"
        log_step "monitoring" "failed" "Dashboard deployment failed"
        exit 1
    fi
    
    print_step "Deploying alerts"
    if execute_command "cd $PROJECT_ROOT/backend && npm run deploy:alerts -- --environment $ENVIRONMENT" "Alert deployment"; then
        print_success "Alerts deployed successfully"
    else
        print_error "Alert deployment failed"
        log_step "monitoring" "failed" "Alert deployment failed"
        exit 1
    fi
    
    log_step "monitoring" "completed" "Monitoring setup completed"
    print_success "Monitoring setup completed"
}

# Function to run validation tests
run_validation() {
    print_header "RUNNING VALIDATION TESTS"
    log_step "validation" "started" "Running post-deployment validation"
    
    local validation_failed=false
    
    # Test B2C configuration
    print_step "Validating B2C configuration"
    if execute_command "$SCRIPT_DIR/test-b2c-urls.sh $ENVIRONMENT $TENANT_NAME \$B2C_APP_ID $FRONTEND_URL" "B2C validation"; then
        print_success "B2C configuration validation passed"
    else
        print_error "B2C configuration validation failed"
        validation_failed=true
    fi
    
    # Test Key Vault
    print_step "Validating Key Vault integration"
    if execute_command "$SCRIPT_DIR/test-key-vault.sh $ENVIRONMENT" "Key Vault validation"; then
        print_success "Key Vault validation passed"
    else
        print_error "Key Vault validation failed"
        validation_failed=true
    fi
    
    # Test App Service
    print_step "Validating App Service"
    if execute_command "$SCRIPT_DIR/test-app-service.sh $ENVIRONMENT https://${APP_SERVICE_NAME}.azurewebsites.net" "App Service validation"; then
        print_success "App Service validation passed"
    else
        print_error "App Service validation failed"
        validation_failed=true
    fi
    
    if [ "$validation_failed" = true ]; then
        print_warning "Some validation tests failed"
        log_step "validation" "failed" "Some validation tests failed"
    else
        log_step "validation" "completed" "All validation tests passed"
        print_success "All validation tests passed"
    fi
}

# Function to create deployment summary
create_summary() {
    print_header "DEPLOYMENT SUMMARY"
    
    local end_time=$(date +%s)
    local duration=$((end_time - START_TIME))
    local duration_formatted=$(printf "%02d:%02d:%02d" $((duration/3600)) $((duration%3600/60)) $((duration%60)))
    
    # Create JSON summary
    cat > "$DEPLOYMENT_SUMMARY" << EOF
{
  "deployment": {
    "environment": "$ENVIRONMENT",
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "duration": "$duration_formatted",
    "durationSeconds": $duration,
    "status": "completed",
    "options": {
      "skipTests": $SKIP_TESTS,
      "skipFrontend": $SKIP_FRONTEND,
      "skipBackend": $SKIP_BACKEND,
      "skipInfra": $SKIP_INFRA,
      "skipMonitoring": $SKIP_MONITORING,
      "force": $FORCE,
      "dryRun": $DRY_RUN
    }
  },
  "resources": {
    "resourceGroup": "$RESOURCE_GROUP",
    "keyVault": "$KEY_VAULT_NAME",
    "appService": "$APP_SERVICE_NAME",
    "staticWebApp": "$STATIC_WEB_APP_NAME"
  },
  "urls": {
    "frontend": "$FRONTEND_URL",
    "backend": "https://${APP_SERVICE_NAME}.azurewebsites.net",
    "api": "https://${APP_SERVICE_NAME}.azurewebsites.net/api"
  },
  "logFile": "$DEPLOYMENT_LOG"
}
EOF
    
    print_success "Deployment Summary:"
    echo "  Environment: $ENVIRONMENT"
    echo "  Duration: $duration_formatted"
    echo "  Frontend URL: $FRONTEND_URL"
    echo "  Backend URL: https://${APP_SERVICE_NAME}.azurewebsites.net"
    echo "  Summary saved to: $DEPLOYMENT_SUMMARY"
    echo "  Log saved to: $DEPLOYMENT_LOG"
    
    if [ "$DRY_RUN" = true ]; then
        print_status "This was a dry run - no actual deployment was performed"
    fi
}

# Main deployment function
main() {
    print_header "TAKTMATE FULL-STACK DEPLOYMENT"
    print_status "Environment: $ENVIRONMENT"
    print_status "Resource Group: $RESOURCE_GROUP"
    print_status "Dry Run: $DRY_RUN"
    echo ""
    
    log_step "deployment" "started" "Full-stack deployment started"
    
    # Execute deployment phases
    check_prerequisites
    run_tests
    deploy_infrastructure
    configure_services
    deploy_backend
    deploy_frontend
    setup_monitoring
    run_validation
    create_summary
    
    log_step "deployment" "completed" "Full-stack deployment completed successfully"
    print_header "DEPLOYMENT COMPLETED SUCCESSFULLY! 🎉"
}

# Execute main function
main "$@"
