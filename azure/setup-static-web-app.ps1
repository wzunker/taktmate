# PowerShell script for Azure Static Web App deployment
# Usage: .\setup-static-web-app.ps1 -Environment "production" -ResourceGroup "taktmate-prod-rg" -SubscriptionId "your-subscription-id"

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("production", "staging", "development")]
    [string]$Environment = "staging",
    
    [Parameter(Mandatory=$false)]
    [string]$ResourceGroup = "taktmate-$Environment-rg",
    
    [Parameter(Mandatory=$false)]
    [string]$SubscriptionId,
    
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

Write-ColoredOutput "Starting Azure Static Web App deployment..." -Type "Info"
Write-ColoredOutput "Environment: $Environment" -Type "Info"
Write-ColoredOutput "Resource Group: $ResourceGroup" -Type "Info"
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

# Get script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$templateFile = Join-Path $scriptDir "static-web-app-template.json"
$parametersFile = Join-Path $scriptDir "static-web-app-parameters-$Environment.json"

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

# Validate template
Write-ColoredOutput "Validating ARM template..." -Type "Info"
$validationResult = az deployment group validate `
    --resource-group $ResourceGroup `
    --template-file $templateFile `
    --parameters "@$parametersFile" `
    --output none

if ($LASTEXITCODE -ne 0) {
    Write-ColoredOutput "Template validation failed" -Type "Error"
    exit 1
}
Write-ColoredOutput "Template validation passed" -Type "Success"

# Deploy the template
$deploymentName = "taktmate-static-web-app-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
Write-ColoredOutput "Deploying template with deployment name: $deploymentName" -Type "Info"

$deploymentOutput = az deployment group create `
    --resource-group $ResourceGroup `
    --name $deploymentName `
    --template-file $templateFile `
    --parameters "@$parametersFile" `
    --query "properties.outputs" `
    --output json | ConvertFrom-Json

if ($LASTEXITCODE -eq 0) {
    Write-ColoredOutput "Static Web App deployed successfully!" -Type "Success"
    
    # Extract outputs
    $defaultDomain = $deploymentOutput.staticWebAppDefaultDomain.value
    $staticWebAppId = $deploymentOutput.staticWebAppId.value
    $deploymentToken = $deploymentOutput.deploymentToken.value
    
    Write-Host ""
    Write-ColoredOutput "Deployment Details:" -Type "Success"
    Write-Host "  Default Domain: https://$defaultDomain"
    Write-Host "  Resource ID: $staticWebAppId"
    Write-Host ""
    
    # Save deployment token securely
    $tokenFile = Join-Path $scriptDir ".deployment-token-$Environment"
    $deploymentToken | Out-File -FilePath $tokenFile -Encoding UTF8 -NoNewline
    Write-ColoredOutput "Deployment token saved to: $tokenFile" -Type "Success"
    
    Write-Host ""
    Write-ColoredOutput "Next Steps:" -Type "Info"
    Write-Host "1. Add the deployment token to your GitHub repository secrets as 'AZURE_STATIC_WEB_APPS_API_TOKEN'"
    Write-Host "2. Configure your GitHub repository in the Azure portal if needed"
    Write-Host "3. Set up custom domain DNS records if using a custom domain"
    Write-Host "4. Configure Azure AD B2C redirect URLs to include the new domain"
    
    # Check if custom domain is configured
    $parametersContent = Get-Content $parametersFile | ConvertFrom-Json
    $customDomain = $parametersContent.parameters.customDomainName.value
    if ($customDomain -and $customDomain -ne "") {
        Write-Host "5. Verify custom domain: $customDomain"
        Write-Host "   - Add CNAME record: $customDomain -> $defaultDomain"
        Write-Host "   - SSL certificate will be automatically provisioned"
    }
    
} else {
    Write-ColoredOutput "Deployment failed" -Type "Error"
    exit 1
}

Write-ColoredOutput "Deployment completed successfully!" -Type "Success"
