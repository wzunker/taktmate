#!/bin/bash

# Deploy Azure Static Web App for TaktMate Frontend
# Usage: ./deploy-static-web-app.sh [environment] [resource-group] [subscription]
# Example: ./deploy-static-web-app.sh production taktmate-prod-rg your-subscription-id

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
TEMPLATE_FILE="${SCRIPT_DIR}/static-web-app-template.json"
PARAMETERS_FILE="${SCRIPT_DIR}/static-web-app-parameters-${ENVIRONMENT}.json"

print_status "Starting Azure Static Web App deployment..."
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
DEPLOYMENT_NAME="taktmate-static-web-app-$(date +%Y%m%d-%H%M%S)"
print_status "Deploying template with deployment name: $DEPLOYMENT_NAME"

DEPLOYMENT_OUTPUT=$(az deployment group create \
    --resource-group "$RESOURCE_GROUP" \
    --name "$DEPLOYMENT_NAME" \
    --template-file "$TEMPLATE_FILE" \
    --parameters "@${PARAMETERS_FILE}" \
    --query "properties.outputs" \
    --output json)

if [ $? -eq 0 ]; then
    print_success "Static Web App deployed successfully!"
    
    # Extract outputs
    DEFAULT_DOMAIN=$(echo "$DEPLOYMENT_OUTPUT" | jq -r '.staticWebAppDefaultDomain.value')
    STATIC_WEB_APP_ID=$(echo "$DEPLOYMENT_OUTPUT" | jq -r '.staticWebAppId.value')
    DEPLOYMENT_TOKEN=$(echo "$DEPLOYMENT_OUTPUT" | jq -r '.deploymentToken.value')
    
    echo ""
    print_success "Deployment Details:"
    echo "  Default Domain: https://$DEFAULT_DOMAIN"
    echo "  Resource ID: $STATIC_WEB_APP_ID"
    echo ""
    
    # Save deployment token securely
    TOKEN_FILE="${SCRIPT_DIR}/.deployment-token-${ENVIRONMENT}"
    echo "$DEPLOYMENT_TOKEN" > "$TOKEN_FILE"
    chmod 600 "$TOKEN_FILE"
    print_success "Deployment token saved to: $TOKEN_FILE"
    
    echo ""
    print_status "Next Steps:"
    echo "1. Add the deployment token to your GitHub repository secrets as 'AZURE_STATIC_WEB_APPS_API_TOKEN'"
    echo "2. Configure your GitHub repository in the Azure portal if needed"
    echo "3. Set up custom domain DNS records if using a custom domain"
    echo "4. Configure Microsoft Entra External ID redirect URLs to include the new domain"
    
    # Check if custom domain is configured
    CUSTOM_DOMAIN=$(jq -r '.parameters.customDomainName.value' "$PARAMETERS_FILE")
    if [ "$CUSTOM_DOMAIN" != "" ] && [ "$CUSTOM_DOMAIN" != "null" ]; then
        echo "5. Verify custom domain: $CUSTOM_DOMAIN"
        echo "   - Add CNAME record: $CUSTOM_DOMAIN -> $DEFAULT_DOMAIN"
        echo "   - SSL certificate will be automatically provisioned"
    fi
    
else
    print_error "Deployment failed"
    exit 1
fi

print_status "Deployment completed successfully!"
