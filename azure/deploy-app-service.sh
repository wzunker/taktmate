#!/bin/bash

# Deploy Azure App Service for TaktMate Backend API
# Usage: ./deploy-app-service.sh [environment] [resource-group] [subscription]
# Example: ./deploy-app-service.sh production taktmate-prod-rg your-subscription-id

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
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
RESOURCE_GROUP=${2:-"taktmate-${ENVIRONMENT}-rg"}
SUBSCRIPTION=${3:-""}
LOCATION="East US 2"

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(production|staging|development)$ ]]; then
    print_error "Invalid environment. Must be one of: production, staging, development"
    exit 1
fi

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE_FILE="${SCRIPT_DIR}/app-service-template.json"
PARAMETERS_FILE="${SCRIPT_DIR}/app-service-parameters-${ENVIRONMENT}.json"

print_status "Starting Azure App Service deployment..."
print_status "Environment: $ENVIRONMENT"
print_status "Resource Group: $RESOURCE_GROUP"
print_status "Location: $LOCATION"

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    print_error "Azure CLI is not installed. Please install it first."
    exit 1
fi

# Check if logged in to Azure
if ! az account show &> /dev/null; then
    print_error "Not logged in to Azure CLI. Please run 'az login' first."
    exit 1
fi

# Set subscription if provided
if [ ! -z "$SUBSCRIPTION" ]; then
    print_status "Setting subscription to: $SUBSCRIPTION"
    az account set --subscription "$SUBSCRIPTION"
fi

# Get current subscription info
CURRENT_SUBSCRIPTION=$(az account show --query "name" -o tsv)
print_status "Using subscription: $CURRENT_SUBSCRIPTION"

# Check if resource group exists
if ! az group show --name "$RESOURCE_GROUP" &> /dev/null; then
    print_warning "Resource group '$RESOURCE_GROUP' does not exist. Creating it..."
    az group create --name "$RESOURCE_GROUP" --location "$LOCATION"
    print_success "Resource group created successfully"
else
    print_status "Resource group '$RESOURCE_GROUP' already exists"
fi

# Validate template
print_status "Validating ARM template..."
if ! az deployment group validate \
    --resource-group "$RESOURCE_GROUP" \
    --template-file "$TEMPLATE_FILE" \
    --parameters "@${PARAMETERS_FILE}" \
    --output none; then
    print_error "Template validation failed"
    exit 1
fi
print_success "Template validation passed"

# Deploy the template
DEPLOYMENT_NAME="taktmate-app-service-$(date +%Y%m%d-%H%M%S)"
print_status "Deploying template with deployment name: $DEPLOYMENT_NAME"

DEPLOYMENT_OUTPUT=$(az deployment group create \
    --resource-group "$RESOURCE_GROUP" \
    --name "$DEPLOYMENT_NAME" \
    --template-file "$TEMPLATE_FILE" \
    --parameters "@${PARAMETERS_FILE}" \
    --query "properties.outputs" \
    --output json)

if [ $? -eq 0 ]; then
    print_success "App Service deployed successfully!"
    
    # Extract outputs
    APP_SERVICE_URL=$(echo "$DEPLOYMENT_OUTPUT" | jq -r '.appServiceUrl.value')
    APP_SERVICE_NAME=$(echo "$DEPLOYMENT_OUTPUT" | jq -r '.appServiceName.value')
    INSTRUMENTATION_KEY=$(echo "$DEPLOYMENT_OUTPUT" | jq -r '.applicationInsightsInstrumentationKey.value')
    CONNECTION_STRING=$(echo "$DEPLOYMENT_OUTPUT" | jq -r '.applicationInsightsConnectionString.value')
    
    echo ""
    print_success "Deployment Details:"
    echo "  App Service URL: $APP_SERVICE_URL"
    echo "  App Service Name: $APP_SERVICE_NAME"
    echo ""
    
    # Save Application Insights details
    INSIGHTS_FILE="${SCRIPT_DIR}/.app-insights-${ENVIRONMENT}"
    cat > "$INSIGHTS_FILE" << EOF
INSTRUMENTATION_KEY=$INSTRUMENTATION_KEY
CONNECTION_STRING=$CONNECTION_STRING
EOF
    chmod 600 "$INSIGHTS_FILE"
    print_success "Application Insights details saved to: $INSIGHTS_FILE"
    
    # Test health endpoint
    print_status "Testing health endpoint..."
    HEALTH_URL="${APP_SERVICE_URL}/api/health"
    
    # Wait for deployment to be ready
    print_status "Waiting for app service to be ready..."
    sleep 30
    
    # Test the health endpoint
    if curl -s -f "$HEALTH_URL" > /dev/null; then
        print_success "Health endpoint is responding: $HEALTH_URL"
    else
        print_warning "Health endpoint not yet responding: $HEALTH_URL"
        print_warning "This is normal for new deployments. The app may need time to start."
    fi
    
    echo ""
    print_status "Next Steps:"
    echo "1. Configure environment variables in the Azure portal"
    echo "2. Set up deployment slots for blue-green deployments"
    echo "3. Configure custom domain DNS records if using custom domain"
    echo "4. Update frontend API base URL to point to: $APP_SERVICE_URL"
    echo "5. Configure CORS settings for frontend domain"
    
    # Check if custom domain is configured
    CUSTOM_DOMAIN=$(jq -r '.parameters.customDomainName.value' "$PARAMETERS_FILE")
    if [ "$CUSTOM_DOMAIN" != "" ] && [ "$CUSTOM_DOMAIN" != "null" ]; then
        CUSTOM_URL=$(echo "$DEPLOYMENT_OUTPUT" | jq -r '.customDomainUrl.value // empty')
        if [ ! -z "$CUSTOM_URL" ]; then
            echo "6. Verify custom domain: $CUSTOM_URL"
            echo "   - Add CNAME record: $CUSTOM_DOMAIN -> ${APP_SERVICE_NAME}.azurewebsites.net"
            echo "   - SSL certificate will be automatically managed"
        fi
    fi
    
    # Display environment variables that need to be set
    echo ""
    print_status "Required Environment Variables:"
    echo "Set these in Azure Portal > App Service > Configuration:"
    echo ""
    echo "# Azure AD B2C Configuration"
    echo "AZURE_AD_B2C_TENANT_NAME=your-tenant.onmicrosoft.com"
    echo "AZURE_AD_B2C_CLIENT_ID=your-client-id"
    echo "AZURE_AD_B2C_CLIENT_SECRET=your-client-secret"
    echo "AZURE_AD_B2C_POLICY_NAME=B2C_1_signupsignin"
    echo ""
    echo "# OpenAI Configuration"
    echo "OPENAI_API_KEY=your-openai-key"
    echo "OPENAI_API_ENDPOINT=your-azure-openai-endpoint"
    echo ""
    echo "# CORS Configuration"
    echo "ALLOWED_ORIGINS=https://app.taktmate.com,https://staging.taktmate.com"
    echo ""
    echo "# Application Insights (automatically configured)"
    echo "APPLICATIONINSIGHTS_CONNECTION_STRING=$CONNECTION_STRING"
    
else
    print_error "Deployment failed"
    exit 1
fi

print_status "App Service deployment completed successfully!"
