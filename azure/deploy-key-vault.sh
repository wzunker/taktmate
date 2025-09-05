#!/bin/bash

# Deploy Azure Key Vault for TaktMate API Key Management
# Usage: ./deploy-key-vault.sh [environment] [resource-group] [subscription] [admin-object-id] [app-service-name]
# Example: ./deploy-key-vault.sh production taktmate-prod-rg your-subscription-id your-admin-object-id taktmate-api-prod

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
ADMIN_OBJECT_ID=${4:-""}
APP_SERVICE_NAME=${5:-"taktmate-api-${ENVIRONMENT}"}
LOCATION="East US 2"

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(production|staging|development)$ ]]; then
    print_error "Invalid environment. Must be one of: production, staging, development"
    exit 1
fi

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE_FILE="${SCRIPT_DIR}/key-vault-template.json"
PARAMETERS_FILE="${SCRIPT_DIR}/key-vault-parameters-${ENVIRONMENT}.json"

print_status "Starting Azure Key Vault deployment..."
print_status "Environment: $ENVIRONMENT"
print_status "Resource Group: $RESOURCE_GROUP"
print_status "App Service: $APP_SERVICE_NAME"
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

# Get admin object ID if not provided
if [ -z "$ADMIN_OBJECT_ID" ]; then
    print_status "Getting current user object ID..."
    ADMIN_OBJECT_ID=$(az ad signed-in-user show --query "id" -o tsv)
    if [ -z "$ADMIN_OBJECT_ID" ]; then
        print_error "Could not determine admin object ID. Please provide it as parameter 4."
        exit 1
    fi
fi
print_status "Admin Object ID: $ADMIN_OBJECT_ID"

# Check if resource group exists
if ! az group show --name "$RESOURCE_GROUP" &> /dev/null; then
    print_warning "Resource group '$RESOURCE_GROUP' does not exist. Creating it..."
    az group create --name "$RESOURCE_GROUP" --location "$LOCATION"
    print_success "Resource group created successfully"
else
    print_status "Resource group '$RESOURCE_GROUP' already exists"
fi

# Enable managed identity for App Service if it exists
print_status "Checking App Service managed identity..."
if az webapp show --name "$APP_SERVICE_NAME" --resource-group "$RESOURCE_GROUP" &> /dev/null; then
    # Enable system-assigned managed identity
    print_status "Enabling system-assigned managed identity for App Service..."
    APP_SERVICE_PRINCIPAL_ID=$(az webapp identity assign \
        --name "$APP_SERVICE_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --query "principalId" -o tsv)
    
    if [ ! -z "$APP_SERVICE_PRINCIPAL_ID" ]; then
        print_success "App Service managed identity enabled: $APP_SERVICE_PRINCIPAL_ID"
    else
        print_error "Failed to enable App Service managed identity"
        exit 1
    fi
else
    print_warning "App Service '$APP_SERVICE_NAME' not found. Using placeholder for principal ID."
    APP_SERVICE_PRINCIPAL_ID="placeholder-app-service-principal-id"
fi

# Update parameters file with actual values
print_status "Updating parameters file with actual values..."
TEMP_PARAMS_FILE=$(mktemp)
jq --arg adminId "$ADMIN_OBJECT_ID" \
   --arg appServiceId "$APP_SERVICE_PRINCIPAL_ID" \
   '.parameters.administratorObjectId.value = $adminId | .parameters.appServicePrincipalId.value = $appServiceId' \
   "$PARAMETERS_FILE" > "$TEMP_PARAMS_FILE"

# Validate template
print_status "Validating ARM template..."
if ! az deployment group validate \
    --resource-group "$RESOURCE_GROUP" \
    --template-file "$TEMPLATE_FILE" \
    --parameters "@${TEMP_PARAMS_FILE}" \
    --output none; then
    print_error "Template validation failed"
    rm "$TEMP_PARAMS_FILE"
    exit 1
fi
print_success "Template validation passed"

# Deploy the template
DEPLOYMENT_NAME="taktmate-keyvault-$(date +%Y%m%d-%H%M%S)"
print_status "Deploying template with deployment name: $DEPLOYMENT_NAME"

DEPLOYMENT_OUTPUT=$(az deployment group create \
    --resource-group "$RESOURCE_GROUP" \
    --name "$DEPLOYMENT_NAME" \
    --template-file "$TEMPLATE_FILE" \
    --parameters "@${TEMP_PARAMS_FILE}" \
    --query "properties.outputs" \
    --output json)

# Clean up temporary parameters file
rm "$TEMP_PARAMS_FILE"

if [ $? -eq 0 ]; then
    print_success "Key Vault deployed successfully!"
    
    # Extract outputs
    KEY_VAULT_NAME=$(echo "$DEPLOYMENT_OUTPUT" | jq -r '.keyVaultName.value')
    KEY_VAULT_URI=$(echo "$DEPLOYMENT_OUTPUT" | jq -r '.keyVaultUri.value')
    SECRET_URIS=$(echo "$DEPLOYMENT_OUTPUT" | jq -r '.secretUris.value')
    
    echo ""
    print_success "Deployment Details:"
    echo "  Key Vault Name: $KEY_VAULT_NAME"
    echo "  Key Vault URI: $KEY_VAULT_URI"
    echo ""
    
    # Save Key Vault details
    VAULT_INFO_FILE="${SCRIPT_DIR}/.key-vault-${ENVIRONMENT}"
    cat > "$VAULT_INFO_FILE" << EOF
KEY_VAULT_NAME=$KEY_VAULT_NAME
KEY_VAULT_URI=$KEY_VAULT_URI
SECRET_URIS='$SECRET_URIS'
EOF
    chmod 600 "$VAULT_INFO_FILE"
    print_success "Key Vault details saved to: $VAULT_INFO_FILE"
    
    # Test Key Vault access
    print_status "Testing Key Vault access..."
    if az keyvault secret show --vault-name "$KEY_VAULT_NAME" --name "JWT-Secret" --query "value" -o tsv &> /dev/null; then
        print_success "Key Vault access test passed"
    else
        print_warning "Key Vault access test failed - this may be due to propagation delay"
    fi
    
    # Update App Service configuration with Key Vault references
    if [ "$APP_SERVICE_PRINCIPAL_ID" != "placeholder-app-service-principal-id" ]; then
        print_status "Updating App Service configuration with Key Vault references..."
        
        # Wait for Key Vault to be ready
        sleep 10
        
        # Configure App Service to use Key Vault references
        az webapp config appsettings set \
            --name "$APP_SERVICE_NAME" \
            --resource-group "$RESOURCE_GROUP" \
            --settings \
            "OPENAI_API_KEY=@Microsoft.KeyVault(VaultName=${KEY_VAULT_NAME};SecretName=OpenAI-API-Key)" \
            "OPENAI_API_ENDPOINT=@Microsoft.KeyVault(VaultName=${KEY_VAULT_NAME};SecretName=OpenAI-API-Endpoint)" \
            "AZURE_AD_B2C_CLIENT_ID=@Microsoft.KeyVault(VaultName=${KEY_VAULT_NAME};SecretName=Azure-AD-B2C-Client-ID)" \
            "AZURE_AD_B2C_CLIENT_SECRET=@Microsoft.KeyVault(VaultName=${KEY_VAULT_NAME};SecretName=Azure-AD-B2C-Client-Secret)" \
            "AZURE_AD_B2C_TENANT_NAME=@Microsoft.KeyVault(VaultName=${KEY_VAULT_NAME};SecretName=Azure-AD-B2C-Tenant-Name)" \
            "AZURE_AD_B2C_POLICY_NAME=@Microsoft.KeyVault(VaultName=${KEY_VAULT_NAME};SecretName=Azure-AD-B2C-Policy-Name)" \
            "JWT_SECRET=@Microsoft.KeyVault(VaultName=${KEY_VAULT_NAME};SecretName=JWT-Secret)" \
            "SESSION_SECRET=@Microsoft.KeyVault(VaultName=${KEY_VAULT_NAME};SecretName=Session-Secret)" \
            "ENCRYPTION_KEY=@Microsoft.KeyVault(VaultName=${KEY_VAULT_NAME};SecretName=Encryption-Key)" \
            --output none
        
        print_success "App Service configuration updated with Key Vault references"
    fi
    
    echo ""
    print_status "Next Steps:"
    echo "1. Update the placeholder secrets with actual values:"
    echo "   - OpenAI API Key and Endpoint"
    echo "   - Azure AD B2C Client ID, Secret, and Tenant Name"
    echo "   - Database Connection String (if applicable)"
    echo ""
    echo "2. Use these commands to update secrets:"
    echo "   az keyvault secret set --vault-name $KEY_VAULT_NAME --name 'OpenAI-API-Key' --value 'your-openai-key'"
    echo "   az keyvault secret set --vault-name $KEY_VAULT_NAME --name 'OpenAI-API-Endpoint' --value 'your-openai-endpoint'"
    echo "   az keyvault secret set --vault-name $KEY_VAULT_NAME --name 'Azure-AD-B2C-Client-ID' --value 'your-b2c-client-id'"
    echo "   az keyvault secret set --vault-name $KEY_VAULT_NAME --name 'Azure-AD-B2C-Client-Secret' --value 'your-b2c-client-secret'"
    echo "   az keyvault secret set --vault-name $KEY_VAULT_NAME --name 'Azure-AD-B2C-Tenant-Name' --value 'your-tenant.onmicrosoft.com'"
    echo ""
    echo "3. Verify App Service can access secrets:"
    echo "   az webapp config appsettings list --name $APP_SERVICE_NAME --resource-group $RESOURCE_GROUP"
    echo ""
    echo "4. Test the application endpoints to ensure secrets are loaded correctly"
    
    # Display secret URIs for reference
    echo ""
    print_status "Secret URIs for reference:"
    echo "$SECRET_URIS" | jq -r 'to_entries[] | "  \(.key): \(.value)"'
    
    # Security recommendations
    echo ""
    print_status "Security Recommendations:"
    echo "1. Enable network restrictions if needed (currently allowing all Azure services)"
    echo "2. Review access policies regularly"
    echo "3. Enable Key Vault logging and monitoring"
    echo "4. Consider using Premium SKU for HSM-backed keys in production"
    echo "5. Implement secret rotation policies"
    
else
    print_error "Deployment failed"
    exit 1
fi

print_status "Key Vault deployment completed successfully!"
