# PowerShell script for Azure Key Vault deployment
# Usage: .\deploy-key-vault.ps1 -Environment "production" -ResourceGroup "taktmate-prod-rg" -SubscriptionId "your-subscription-id" -AdminObjectId "your-object-id" -AppServiceName "taktmate-api-prod"

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("production", "staging", "development")]
    [string]$Environment = "staging",
    
    [Parameter(Mandatory=$false)]
    [string]$ResourceGroup = "taktmate-$Environment-rg",
    
    [Parameter(Mandatory=$false)]
    [string]$SubscriptionId,
    
    [Parameter(Mandatory=$false)]
    [string]$AdminObjectId,
    
    [Parameter(Mandatory=$false)]
    [string]$AppServiceName = "taktmate-api-$Environment",
    
    [Parameter(Mandatory=$false)]
    [string]$Location = "East US 2"
)

# Set error action preference
$ErrorActionPreference = "Stop"

# Colors for output
function Write-ColoredOutput {
    param(
        [Parameter(Mandatory=$true)]
        [string]$Message,
        [Parameter(Mandatory=$false)]
        [ValidateSet("Info", "Success", "Warning", "Error")]
        [string]$Type = "Info"
    )
    
    $color = switch ($Type) {
        "Info"    { "Cyan" }
        "Success" { "Green" }
        "Warning" { "Yellow" }
        "Error"   { "Red" }
    }
    
    Write-Host "[$Type] $Message" -ForegroundColor $color
}

Write-ColoredOutput "Starting Azure Key Vault deployment..." -Type "Info"
Write-ColoredOutput "Environment: $Environment" -Type "Info"
Write-ColoredOutput "Resource Group: $ResourceGroup" -Type "Info"
Write-ColoredOutput "App Service: $AppServiceName" -Type "Info"
Write-ColoredOutput "Location: $Location" -Type "Info"

# Check if Azure CLI is installed
try {
    $azVersion = az version --output json | ConvertFrom-Json
    Write-ColoredOutput "Azure CLI version: $($azVersion.'azure-cli')" -Type "Info"
} catch {
    Write-ColoredOutput "Azure CLI is not installed. Please install it first." -Type "Error"
    exit 1
}

# Check if logged in to Azure
try {
    $account = az account show --output json | ConvertFrom-Json
    Write-ColoredOutput "Logged in as: $($account.user.name)" -Type "Info"
} catch {
    Write-ColoredOutput "Not logged in to Azure CLI. Please run 'az login' first." -Type "Error"
    exit 1
}

# Set subscription if provided
if ($SubscriptionId) {
    Write-ColoredOutput "Setting subscription to: $SubscriptionId" -Type "Info"
    az account set --subscription $SubscriptionId
}

# Get current subscription info
$currentSubscription = az account show --query "name" --output tsv
Write-ColoredOutput "Using subscription: $currentSubscription" -Type "Info"

# Get admin object ID if not provided
if (-not $AdminObjectId) {
    Write-ColoredOutput "Getting current user object ID..." -Type "Info"
    $AdminObjectId = az ad signed-in-user show --query "id" --output tsv
    if (-not $AdminObjectId) {
        Write-ColoredOutput "Could not determine admin object ID. Please provide it as parameter." -Type "Error"
        exit 1
    }
}
Write-ColoredOutput "Admin Object ID: $AdminObjectId" -Type "Info"

# Get script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$templateFile = Join-Path $scriptDir "key-vault-template.json"
$parametersFile = Join-Path $scriptDir "key-vault-parameters-$Environment.json"

# Verify files exist
if (!(Test-Path $templateFile)) {
    Write-ColoredOutput "Template file not found: $templateFile" -Type "Error"
    exit 1
}

if (!(Test-Path $parametersFile)) {
    Write-ColoredOutput "Parameters file not found: $parametersFile" -Type "Error"
    exit 1
}

# Check if resource group exists
$rgExists = az group exists --name $ResourceGroup --output tsv
if ($rgExists -eq "false") {
    Write-ColoredOutput "Resource group '$ResourceGroup' does not exist. Creating it..." -Type "Warning"
    az group create --name $ResourceGroup --location $Location --output none
    Write-ColoredOutput "Resource group created successfully" -Type "Success"
} else {
    Write-ColoredOutput "Resource group '$ResourceGroup' already exists" -Type "Info"
}

# Enable managed identity for App Service if it exists
Write-ColoredOutput "Checking App Service managed identity..." -Type "Info"
$appServiceExists = az webapp show --name $AppServiceName --resource-group $ResourceGroup --output none 2>$null
if ($LASTEXITCODE -eq 0) {
    # Enable system-assigned managed identity
    Write-ColoredOutput "Enabling system-assigned managed identity for App Service..." -Type "Info"
    $appServicePrincipalId = az webapp identity assign `
        --name $AppServiceName `
        --resource-group $ResourceGroup `
        --query "principalId" --output tsv
    
    if ($appServicePrincipalId) {
        Write-ColoredOutput "App Service managed identity enabled: $appServicePrincipalId" -Type "Success"
    } else {
        Write-ColoredOutput "Failed to enable App Service managed identity" -Type "Error"
        exit 1
    }
} else {
    Write-ColoredOutput "App Service '$AppServiceName' not found. Using placeholder for principal ID." -Type "Warning"
    $appServicePrincipalId = "placeholder-app-service-principal-id"
}

# Update parameters file with actual values
Write-ColoredOutput "Updating parameters file with actual values..." -Type "Info"
$parametersContent = Get-Content $parametersFile | ConvertFrom-Json
$parametersContent.parameters.administratorObjectId.value = $AdminObjectId
$parametersContent.parameters.appServicePrincipalId.value = $appServicePrincipalId

$tempParamsFile = [System.IO.Path]::GetTempFileName()
$parametersContent | ConvertTo-Json -Depth 10 | Out-File -FilePath $tempParamsFile -Encoding UTF8

# Validate template
Write-ColoredOutput "Validating ARM template..." -Type "Info"
$validationResult = az deployment group validate `
    --resource-group $ResourceGroup `
    --template-file $templateFile `
    --parameters "@$tempParamsFile" `
    --output none

if ($LASTEXITCODE -ne 0) {
    Write-ColoredOutput "Template validation failed" -Type "Error"
    Remove-Item $tempParamsFile -Force
    exit 1
}
Write-ColoredOutput "Template validation passed" -Type "Success"

# Deploy the template
$deploymentName = "taktmate-keyvault-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
Write-ColoredOutput "Deploying template with deployment name: $deploymentName" -Type "Info"

$deploymentOutput = az deployment group create `
    --resource-group $ResourceGroup `
    --name $deploymentName `
    --template-file $templateFile `
    --parameters "@$tempParamsFile" `
    --query "properties.outputs" `
    --output json | ConvertFrom-Json

# Clean up temporary parameters file
Remove-Item $tempParamsFile -Force

if ($LASTEXITCODE -eq 0) {
    Write-ColoredOutput "Key Vault deployed successfully!" -Type "Success"
    
    # Extract outputs
    $keyVaultName = $deploymentOutput.keyVaultName.value
    $keyVaultUri = $deploymentOutput.keyVaultUri.value
    $secretUris = $deploymentOutput.secretUris.value
    
    Write-Host ""
    Write-ColoredOutput "Deployment Details:" -Type "Success"
    Write-Host "  Key Vault Name: $keyVaultName"
    Write-Host "  Key Vault URI: $keyVaultUri"
    Write-Host ""
    
    # Save Key Vault details
    $vaultInfoFile = Join-Path $scriptDir ".key-vault-$Environment"
    @"
KEY_VAULT_NAME=$keyVaultName
KEY_VAULT_URI=$keyVaultUri
SECRET_URIS='$($secretUris | ConvertTo-Json -Compress)'
"@ | Out-File -FilePath $vaultInfoFile -Encoding UTF8
    Write-ColoredOutput "Key Vault details saved to: $vaultInfoFile" -Type "Success"
    
    # Test Key Vault access
    Write-ColoredOutput "Testing Key Vault access..." -Type "Info"
    $testResult = az keyvault secret show --vault-name $keyVaultName --name "JWT-Secret" --query "value" --output tsv 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-ColoredOutput "Key Vault access test passed" -Type "Success"
    } else {
        Write-ColoredOutput "Key Vault access test failed - this may be due to propagation delay" -Type "Warning"
    }
    
    # Update App Service configuration with Key Vault references
    if ($appServicePrincipalId -ne "placeholder-app-service-principal-id") {
        Write-ColoredOutput "Updating App Service configuration with Key Vault references..." -Type "Info"
        
        # Wait for Key Vault to be ready
        Start-Sleep -Seconds 10
        
        # Configure App Service to use Key Vault references
        az webapp config appsettings set `
            --name $AppServiceName `
            --resource-group $ResourceGroup `
            --settings `
            "OPENAI_API_KEY=@Microsoft.KeyVault(VaultName=$keyVaultName;SecretName=OpenAI-API-Key)" `
            "OPENAI_API_ENDPOINT=@Microsoft.KeyVault(VaultName=$keyVaultName;SecretName=OpenAI-API-Endpoint)" `
            "AZURE_AD_B2C_CLIENT_ID=@Microsoft.KeyVault(VaultName=$keyVaultName;SecretName=Azure-AD-B2C-Client-ID)" `
            "AZURE_AD_B2C_CLIENT_SECRET=@Microsoft.KeyVault(VaultName=$keyVaultName;SecretName=Azure-AD-B2C-Client-Secret)" `
            "AZURE_AD_B2C_TENANT_NAME=@Microsoft.KeyVault(VaultName=$keyVaultName;SecretName=Azure-AD-B2C-Tenant-Name)" `
            "AZURE_AD_B2C_POLICY_NAME=@Microsoft.KeyVault(VaultName=$keyVaultName;SecretName=Azure-AD-B2C-Policy-Name)" `
            "JWT_SECRET=@Microsoft.KeyVault(VaultName=$keyVaultName;SecretName=JWT-Secret)" `
            "SESSION_SECRET=@Microsoft.KeyVault(VaultName=$keyVaultName;SecretName=Session-Secret)" `
            "ENCRYPTION_KEY=@Microsoft.KeyVault(VaultName=$keyVaultName;SecretName=Encryption-Key)" `
            --output none
        
        Write-ColoredOutput "App Service configuration updated with Key Vault references" -Type "Success"
    }
    
    Write-Host ""
    Write-ColoredOutput "Next Steps:" -Type "Info"
    Write-Host "1. Update the placeholder secrets with actual values:"
    Write-Host "   - OpenAI API Key and Endpoint"
    Write-Host "   - Azure AD B2C Client ID, Secret, and Tenant Name"
    Write-Host "   - Database Connection String (if applicable)"
    Write-Host ""
    Write-Host "2. Use these commands to update secrets:"
    Write-Host "   az keyvault secret set --vault-name $keyVaultName --name 'OpenAI-API-Key' --value 'your-openai-key'"
    Write-Host "   az keyvault secret set --vault-name $keyVaultName --name 'OpenAI-API-Endpoint' --value 'your-openai-endpoint'"
    Write-Host "   az keyvault secret set --vault-name $keyVaultName --name 'Azure-AD-B2C-Client-ID' --value 'your-b2c-client-id'"
    Write-Host "   az keyvault secret set --vault-name $keyVaultName --name 'Azure-AD-B2C-Client-Secret' --value 'your-b2c-client-secret'"
    Write-Host "   az keyvault secret set --vault-name $keyVaultName --name 'Azure-AD-B2C-Tenant-Name' --value 'your-tenant.onmicrosoft.com'"
    Write-Host ""
    Write-Host "3. Verify App Service can access secrets:"
    Write-Host "   az webapp config appsettings list --name $AppServiceName --resource-group $ResourceGroup"
    Write-Host ""
    Write-Host "4. Test the application endpoints to ensure secrets are loaded correctly"
    
    # Display secret URIs for reference
    Write-Host ""
    Write-ColoredOutput "Secret URIs for reference:" -Type "Info"
    $secretUris.PSObject.Properties | ForEach-Object {
        Write-Host "  $($_.Name): $($_.Value)"
    }
    
    # Security recommendations
    Write-Host ""
    Write-ColoredOutput "Security Recommendations:" -Type "Info"
    Write-Host "1. Enable network restrictions if needed (currently allowing all Azure services)"
    Write-Host "2. Review access policies regularly"
    Write-Host "3. Enable Key Vault logging and monitoring"
    Write-Host "4. Consider using Premium SKU for HSM-backed keys in production"
    Write-Host "5. Implement secret rotation policies"
    
} else {
    Write-ColoredOutput "Deployment failed" -Type "Error"
    exit 1
}

Write-ColoredOutput "Key Vault deployment completed successfully!" -Type "Success"
