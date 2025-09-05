# PowerShell script for Microsoft Entra External ID Redirect URL Configuration
# Usage: .\configure-entra-external-id-urls.ps1 -Environment "production" -TenantName "taktmate" -AppId "app-id" -FrontendUrl "https://app.taktmate.com" -BackendUrl "https://api.taktmate.com"

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("production", "staging", "development")]
    [string]$Environment,
    
    [Parameter(Mandatory=$true)]
    [string]$TenantName,
    
    [Parameter(Mandatory=$true)]
    [string]$AppId,
    
    [Parameter(Mandatory=$true)]
    [string]$FrontendUrl,
    
    [Parameter(Mandatory=$true)]
    [string]$BackendUrl
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

Write-ColoredOutput "Configuring Microsoft Entra External ID redirect URLs for $Environment environment" -Type "Info"
Write-ColoredOutput "Tenant: $TenantName.onmicrosoft.com" -Type "Info"
Write-ColoredOutput "App ID: $AppId" -Type "Info"
Write-ColoredOutput "Frontend URL: $FrontendUrl" -Type "Info"
Write-ColoredOutput "Backend URL: $BackendUrl" -Type "Info"

# Validate URLs for production/staging
if ($Environment -ne "development") {
    if (-not $FrontendUrl.StartsWith("https://") -or -not $BackendUrl.StartsWith("https://")) {
        Write-ColoredOutput "Production and staging environments must use HTTPS URLs" -Type "Error"
        exit 1
    }
}

# Check prerequisites
try {
    $azVersion = az version --output json | ConvertFrom-Json
    Write-ColoredOutput "Azure CLI version: $($azVersion.'azure-cli')" -Type "Info"
} catch {
    Write-ColoredOutput "Azure CLI is not installed. Please install it first." -Type "Error"
    exit 1
}

try {
    $account = az account show --output json | ConvertFrom-Json
    Write-ColoredOutput "Logged in as: $($account.user.name)" -Type "Info"
} catch {
    Write-ColoredOutput "Not logged in to Azure CLI. Please run 'az login' first." -Type "Error"
    exit 1
}

# Check if we can access the B2C tenant
Write-ColoredOutput "Checking B2C tenant access..." -Type "Info"
$appExists = az ad app show --id $AppId --output none 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-ColoredOutput "Cannot access application $AppId. Please check:" -Type "Error"
    Write-Host "  1. Application ID is correct"
    Write-Host "  2. You have permissions to manage the application"
    Write-Host "  3. You're connected to the correct tenant"
    exit 1
}

# Define redirect URLs based on environment
$redirectUrls = @()
$logoutUrls = @()
$webOrigins = @()

switch ($Environment) {
    "production" {
        $redirectUrls = @(
            $FrontendUrl,
            "$FrontendUrl/",
            "$FrontendUrl/auth/callback",
            "$FrontendUrl/auth/redirect"
        )
        $logoutUrls = @(
            $FrontendUrl,
            "$FrontendUrl/",
            "$FrontendUrl/auth/logout"
        )
        $webOrigins = @(
            $FrontendUrl,
            $BackendUrl
        )
    }
    "staging" {
        $redirectUrls = @(
            $FrontendUrl,
            "$FrontendUrl/",
            "$FrontendUrl/auth/callback",
            "$FrontendUrl/auth/redirect",
            "https://staging.taktmate.com",
            "https://staging.taktmate.com/",
            "https://staging.taktmate.com/auth/callback"
        )
        $logoutUrls = @(
            $FrontendUrl,
            "$FrontendUrl/",
            "$FrontendUrl/auth/logout",
            "https://staging.taktmate.com",
            "https://staging.taktmate.com/"
        )
        $webOrigins = @(
            $FrontendUrl,
            $BackendUrl,
            "https://staging.taktmate.com",
            "https://api-staging.taktmate.com"
        )
    }
    "development" {
        $redirectUrls = @(
            "http://localhost:3000",
            "http://localhost:3000/",
            "http://localhost:3000/auth/callback",
            "http://localhost:3000/auth/redirect",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:3000/",
            "http://127.0.0.1:3000/auth/callback",
            $FrontendUrl,
            "$FrontendUrl/",
            "$FrontendUrl/auth/callback"
        )
        $logoutUrls = @(
            "http://localhost:3000",
            "http://localhost:3000/",
            "http://localhost:3000/auth/logout",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:3000/",
            $FrontendUrl,
            "$FrontendUrl/"
        )
        $webOrigins = @(
            "http://localhost:3000",
            "http://localhost:3001",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:3001",
            $FrontendUrl,
            $BackendUrl
        )
    }
}

# Get current application configuration
Write-ColoredOutput "Getting current application configuration..." -Type "Info"
$currentConfig = az ad app show --id $AppId --output json | ConvertFrom-Json

if ($LASTEXITCODE -ne 0) {
    Write-ColoredOutput "Failed to get current application configuration" -Type "Error"
    exit 1
}

# Extract current redirect URIs
$currentRedirectUris = @()
if ($currentConfig.web.redirectUris) {
    $currentRedirectUris = $currentConfig.web.redirectUris
}

Write-ColoredOutput "Current redirect URIs:" -Type "Info"
if ($currentRedirectUris.Count -gt 0) {
    foreach ($uri in $currentRedirectUris) {
        Write-Host "  - $uri"
    }
} else {
    Write-Host "  - None configured"
}

# Combine current + new redirect URIs and remove duplicates
$allRedirectUris = @()
$allRedirectUris += $currentRedirectUris
$allRedirectUris += $redirectUrls
$uniqueRedirectUris = $allRedirectUris | Sort-Object | Get-Unique

Write-ColoredOutput "New redirect URIs to be configured:" -Type "Info"
foreach ($uri in $uniqueRedirectUris) {
    Write-Host "  - $uri"
}

Write-ColoredOutput "Logout URL to be configured: $($logoutUrls[0])" -Type "Info"

# Create the web configuration JSON
$webConfig = @{
    redirectUris = $uniqueRedirectUris
    logoutUrl = $logoutUrls[0]
    implicitGrantSettings = @{
        enableIdTokenIssuance = $true
        enableAccessTokenIssuance = $false
    }
} | ConvertTo-Json -Depth 10

# Update the application
Write-ColoredOutput "Updating Microsoft Entra External ID application configuration..." -Type "Info"

$updateResult = az ad app update --id $AppId --web $webConfig --output none
if ($LASTEXITCODE -eq 0) {
    Write-ColoredOutput "Application redirect URLs updated successfully!" -Type "Success"
} else {
    Write-ColoredOutput "Failed to update application configuration" -Type "Error"
    exit 1
}

# Verify the update
Write-ColoredOutput "Verifying configuration update..." -Type "Info"
$updatedConfig = az ad app show --id $AppId --output json | ConvertFrom-Json
$updatedRedirectUris = $updatedConfig.web.redirectUris | Sort-Object
$updatedLogoutUrl = $updatedConfig.web.logoutUrl

Write-ColoredOutput "Verification complete!" -Type "Success"
Write-ColoredOutput "Updated redirect URIs:" -Type "Info"
foreach ($uri in $updatedRedirectUris) {
    Write-Host "  - $uri"
}

Write-ColoredOutput "Updated logout URL: $updatedLogoutUrl" -Type "Info"

# Check for CORS configuration
Write-ColoredOutput "Checking CORS configuration recommendations..." -Type "Info"

switch ($Environment) {
    "production" {
        Write-ColoredOutput "For production, configure CORS in your backend to allow:" -Type "Info"
        Write-Host "  - $FrontendUrl"
    }
    "staging" {
        Write-ColoredOutput "For staging, configure CORS in your backend to allow:" -Type "Info"
        Write-Host "  - $FrontendUrl"
        Write-Host "  - https://staging.taktmate.com"
    }
    "development" {
        Write-ColoredOutput "For development, configure CORS in your backend to allow:" -Type "Info"
        Write-Host "  - http://localhost:3000"
        Write-Host "  - http://127.0.0.1:3000"
        Write-Host "  - $FrontendUrl"
    }
}

# Save configuration for reference
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$configFile = "b2c-config-$Environment-$timestamp.json"

$configData = @{
    environment = $Environment
    tenantName = $TenantName
    appId = $AppId
    frontendUrl = $FrontendUrl
    backendUrl = $BackendUrl
    redirectUris = $updatedRedirectUris
    logoutUrl = $updatedLogoutUrl
    webOrigins = $webOrigins
    timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
} | ConvertTo-Json -Depth 10

$configData | Out-File -FilePath $configFile -Encoding UTF8
Write-ColoredOutput "Configuration saved to: $configFile" -Type "Success"

# Next steps
Write-ColoredOutput "Next Steps:" -Type "Info"
Write-Host "1. Update your frontend environment variables:"
Write-Host "   REACT_APP_REDIRECT_URI=$FrontendUrl/auth/callback"
Write-Host "   REACT_APP_POST_LOGOUT_REDIRECT_URI=$FrontendUrl"
Write-Host ""
Write-Host "2. Update your backend CORS configuration to allow:"
foreach ($origin in $webOrigins) {
    Write-Host "   - $origin"
}
Write-Host ""
Write-Host "3. Test the authentication flow:"
Write-Host "   - Navigate to $FrontendUrl"
Write-Host "   - Click 'Sign In' and verify redirect works"
Write-Host "   - Complete authentication and verify callback works"
Write-Host "   - Test sign out and verify logout redirect works"
Write-Host ""
Write-Host "4. Update Key Vault secrets if needed:"
Write-Host "   az keyvault secret set --vault-name taktmate-kv-$Environment --name 'Azure-AD-B2C-Redirect-URI' --value '$FrontendUrl/auth/callback'"
Write-Host ""

# Environment-specific recommendations
switch ($Environment) {
    "production" {
        Write-Host "5. Production-specific recommendations:"
        Write-Host "   - Verify SSL certificates are valid"
        Write-Host "   - Test from different browsers and devices"
        Write-Host "   - Monitor authentication logs in Microsoft Entra External ID"
        Write-Host "   - Set up alerts for authentication failures"
    }
    "staging" {
        Write-Host "5. Staging-specific recommendations:"
        Write-Host "   - Test with production-like data"
        Write-Host "   - Verify staging environment isolation"
        Write-Host "   - Test user flows and custom policies"
    }
    "development" {
        Write-Host "5. Development-specific recommendations:"
        Write-Host "   - Test with localhost and 127.0.0.1"
        Write-Host "   - Verify hot reload doesn't break auth"
        Write-Host "   - Test with different ports if needed"
    }
}

Write-ColoredOutput "Microsoft Entra External ID redirect URL configuration completed for $Environment environment!" -Type "Success"
