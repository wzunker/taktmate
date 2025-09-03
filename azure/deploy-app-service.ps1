# PowerShell script for Azure App Service deployment
# Usage: .\deploy-app-service.ps1 -Environment "production" -ResourceGroup "taktmate-prod-rg" -SubscriptionId "your-subscription-id"

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

Write-ColoredOutput "Starting Azure App Service deployment..." -Type "Info"
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
$templateFile = Join-Path $scriptDir "app-service-template.json"
$parametersFile = Join-Path $scriptDir "app-service-parameters-$Environment.json"

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
$deploymentName = "taktmate-app-service-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
Write-ColoredOutput "Deploying template with deployment name: $deploymentName" -Type "Info"

$deploymentOutput = az deployment group create `
    --resource-group $ResourceGroup `
    --name $deploymentName `
    --template-file $templateFile `
    --parameters "@$parametersFile" `
    --query "properties.outputs" `
    --output json | ConvertFrom-Json

if ($LASTEXITCODE -eq 0) {
    Write-ColoredOutput "App Service deployed successfully!" -Type "Success"
    
    # Extract outputs
    $appServiceUrl = $deploymentOutput.appServiceUrl.value
    $appServiceName = $deploymentOutput.appServiceName.value
    $instrumentationKey = $deploymentOutput.applicationInsightsInstrumentationKey.value
    $connectionString = $deploymentOutput.applicationInsightsConnectionString.value
    
    Write-Host ""
    Write-ColoredOutput "Deployment Details:" -Type "Success"
    Write-Host "  App Service URL: $appServiceUrl"
    Write-Host "  App Service Name: $appServiceName"
    Write-Host ""
    
    # Save Application Insights details
    $insightsFile = Join-Path $scriptDir ".app-insights-$Environment"
    @"
INSTRUMENTATION_KEY=$instrumentationKey
CONNECTION_STRING=$connectionString
"@ | Out-File -FilePath $insightsFile -Encoding UTF8
    Write-ColoredOutput "Application Insights details saved to: $insightsFile" -Type "Success"
    
    # Test health endpoint
    Write-ColoredOutput "Testing health endpoint..." -Type "Info"
    $healthUrl = "$appServiceUrl/api/health"
    
    # Wait for deployment to be ready
    Write-ColoredOutput "Waiting for app service to be ready..." -Type "Info"
    Start-Sleep -Seconds 30
    
    # Test the health endpoint
    try {
        $response = Invoke-WebRequest -Uri $healthUrl -Method GET -TimeoutSec 10
        if ($response.StatusCode -eq 200) {
            Write-ColoredOutput "Health endpoint is responding: $healthUrl" -Type "Success"
        }
    } catch {
        Write-ColoredOutput "Health endpoint not yet responding: $healthUrl" -Type "Warning"
        Write-ColoredOutput "This is normal for new deployments. The app may need time to start." -Type "Warning"
    }
    
    Write-Host ""
    Write-ColoredOutput "Next Steps:" -Type "Info"
    Write-Host "1. Configure environment variables in the Azure portal"
    Write-Host "2. Set up deployment slots for blue-green deployments"
    Write-Host "3. Configure custom domain DNS records if using custom domain"
    Write-Host "4. Update frontend API base URL to point to: $appServiceUrl"
    Write-Host "5. Configure CORS settings for frontend domain"
    
    # Check if custom domain is configured
    $parametersContent = Get-Content $parametersFile | ConvertFrom-Json
    $customDomain = $parametersContent.parameters.customDomainName.value
    if ($customDomain -and $customDomain -ne "") {
        $customUrl = $deploymentOutput.customDomainUrl.value
        if ($customUrl) {
            Write-Host "6. Verify custom domain: $customUrl"
            Write-Host "   - Add CNAME record: $customDomain -> $appServiceName.azurewebsites.net"
            Write-Host "   - SSL certificate will be automatically managed"
        }
    }
    
    # Display environment variables that need to be set
    Write-Host ""
    Write-ColoredOutput "Required Environment Variables:" -Type "Info"
    Write-Host "Set these in Azure Portal > App Service > Configuration:"
    Write-Host ""
    Write-Host "# Azure AD B2C Configuration"
    Write-Host "AZURE_AD_B2C_TENANT_NAME=your-tenant.onmicrosoft.com"
    Write-Host "AZURE_AD_B2C_CLIENT_ID=your-client-id"
    Write-Host "AZURE_AD_B2C_CLIENT_SECRET=your-client-secret"
    Write-Host "AZURE_AD_B2C_POLICY_NAME=B2C_1_signupsignin"
    Write-Host ""
    Write-Host "# OpenAI Configuration"
    Write-Host "OPENAI_API_KEY=your-openai-key"
    Write-Host "OPENAI_API_ENDPOINT=your-azure-openai-endpoint"
    Write-Host ""
    Write-Host "# CORS Configuration"
    Write-Host "ALLOWED_ORIGINS=https://app.taktmate.com,https://staging.taktmate.com"
    Write-Host ""
    Write-Host "# Application Insights (automatically configured)"
    Write-Host "APPLICATIONINSIGHTS_CONNECTION_STRING=$connectionString"
    
} else {
    Write-ColoredOutput "Deployment failed" -Type "Error"
    exit 1
}

Write-ColoredOutput "App Service deployment completed successfully!" -Type "Success"
