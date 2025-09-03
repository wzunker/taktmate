# DNS Configuration Guide for TaktMate

## Overview
This guide provides comprehensive instructions for configuring DNS records for the TaktMate application custom domains. It covers DNS zone setup, CNAME record configuration, domain validation, and troubleshooting procedures for both `taktconnect.com` and alternative domain configurations.

## 🏗️ DNS Architecture

### Domain Structure
```
┌─────────────────────────────────────────────────────────────┐
│                    TaktMate DNS Architecture                │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────┐ │
│  │   Production    │  │     Staging      │  │ Development │ │
│  │app.taktconnect  │  │staging.taktconnect│  │dev.taktconnect│
│  │     .com        │  │     .com         │  │    .com     │ │
│  └─────────────────┘  └──────────────────┘  └─────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────┐ │
│  │   Frontend      │  │     Backend      │  │ Additional  │ │
│  │   Static Web    │  │   App Service    │  │   Records   │ │
│  │     Apps        │  │                  │  │ (www, etc.) │ │
│  └─────────────────┘  └──────────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### DNS Record Types and Purposes
```yaml
CNAME Records:
  app.taktconnect.com → [static-web-app].azurestaticapps.net
  api.taktconnect.com → [app-service].azurewebsites.net
  www.taktconnect.com → [static-web-app].azurestaticapps.net (production only)

Environment-Specific:
  Production:
    - app.taktconnect.com (frontend)
    - api.taktconnect.com (backend)
    - www.taktconnect.com (redirect)
  
  Staging:
    - staging.taktconnect.com (frontend)
    - api-staging.taktconnect.com (backend)
  
  Development:
    - dev.taktconnect.com (frontend)
    - api-dev.taktconnect.com (backend)
```

## 🛠️ DNS Configuration Tools

### 1. DNS Configuration Script
**File**: `azure/configure-dns-records.sh`

#### Key Features
- **Automated DNS zone creation** with proper Azure integration
- **CNAME record management** for frontend and backend services
- **Environment-specific configuration** (production, staging, development)
- **Backup and restore** capabilities for existing DNS records
- **Validation and testing** integration
- **Name server configuration** guidance

#### Usage Examples
```bash
# Configure production DNS records
./configure-dns-records.sh production taktconnect.com --validate --backup

# Staging environment setup
./configure-dns-records.sh staging taktconnect.com --dry-run --verbose

# Force DNS updates
./configure-dns-records.sh production taktconnect.com --force

# Backup existing records before changes
./configure-dns-records.sh production taktconnect.com --backup --validate
```

### 2. DNS Testing and Validation Script
**File**: `azure/test-dns-configuration.sh`

#### Testing Capabilities
- **DNS zone validation** in Azure
- **CNAME record verification** for all environments
- **DNS resolution testing** across multiple DNS servers
- **DNS propagation monitoring** with global server checks
- **HTTP/HTTPS accessibility** validation
- **SSL certificate verification** (when available)
- **TTL configuration** analysis

#### Usage Examples
```bash
# Comprehensive DNS testing
./test-dns-configuration.sh production taktconnect.com --comprehensive --report

# DNS propagation testing
./test-dns-configuration.sh production taktconnect.com --propagation --verbose

# SSL certificate validation
./test-dns-configuration.sh production taktconnect.com --ssl --report
```

## 📋 Step-by-Step DNS Setup

### Prerequisites
1. **Azure CLI** installed and authenticated
2. **Domain ownership** of `taktconnect.com` (or alternative domain)
3. **Azure resources** deployed (Static Web Apps, App Service)
4. **Resource group** and Azure DNS zone permissions

### Step 1: Domain Preparation
```bash
# Verify domain ownership and access to domain registrar
# Ensure you can modify DNS settings or delegate to Azure DNS

# Check current domain configuration
nslookup taktconnect.com
dig taktconnect.com NS
```

### Step 2: Azure DNS Zone Setup
```bash
# Create DNS zone (if not exists)
az network dns zone create \
  --name taktconnect.com \
  --resource-group taktmate-prod-rg \
  --tags environment=production purpose=taktmate-dns

# Get name servers for domain registrar configuration
az network dns zone show \
  --name taktconnect.com \
  --resource-group taktmate-prod-rg \
  --query nameServers
```

### Step 3: Configure DNS Records
```bash
# Production environment DNS setup
./configure-dns-records.sh production taktconnect.com --validate --backup

# Verify configuration
./test-dns-configuration.sh production taktconnect.com --comprehensive
```

### Step 4: Domain Registrar Configuration
1. **Login to domain registrar** (e.g., GoDaddy, Namecheap, etc.)
2. **Navigate to DNS management** for `taktconnect.com`
3. **Update name servers** to Azure DNS name servers:
   ```
   ns1-01.azure-dns.com
   ns2-01.azure-dns.net
   ns3-01.azure-dns.org
   ns4-01.azure-dns.info
   ```
4. **Save changes** and wait for propagation

### Step 5: DNS Propagation Monitoring
```bash
# Monitor DNS propagation
./test-dns-configuration.sh production taktconnect.com --propagation --verbose

# Check specific DNS servers
dig @8.8.8.8 app.taktconnect.com
dig @1.1.1.1 api.taktconnect.com
```

## 🎯 Environment-Specific Configurations

### Production Environment
**Domain**: `taktconnect.com`
**Resource Group**: `taktmate-prod-rg`

#### DNS Records Configuration
```bash
# Frontend (Static Web App)
app.taktconnect.com → taktmate-frontend-prod.azurestaticapps.net

# Backend (App Service)
api.taktconnect.com → taktmate-api-prod.azurewebsites.net

# WWW Redirect (Optional)
www.taktconnect.com → taktmate-frontend-prod.azurestaticapps.net
```

#### Setup Commands
```bash
# Complete production DNS setup
./configure-dns-records.sh production taktconnect.com --validate --backup

# Test production DNS configuration
./test-dns-configuration.sh production taktconnect.com --comprehensive --report
```

### Staging Environment
**Domain**: `taktconnect.com` (staging subdomain)
**Resource Group**: `taktmate-staging-rg`

#### DNS Records Configuration
```bash
# Frontend (Static Web App)
staging.taktconnect.com → taktmate-frontend-staging.azurestaticapps.net

# Backend (App Service)
api-staging.taktconnect.com → taktmate-api-staging.azurewebsites.net
```

#### Setup Commands
```bash
# Staging DNS setup
./configure-dns-records.sh staging taktconnect.com --validate

# Test staging DNS configuration
./test-dns-configuration.sh staging taktconnect.com --comprehensive
```

### Development Environment
**Domain**: `taktconnect.com` (dev subdomain)
**Resource Group**: `taktmate-dev-rg`

#### DNS Records Configuration
```bash
# Frontend (Static Web App)
dev.taktconnect.com → taktmate-frontend-dev.azurestaticapps.net

# Backend (App Service)
api-dev.taktconnect.com → taktmate-api-dev.azurewebsites.net
```

#### Setup Commands
```bash
# Development DNS setup
./configure-dns-records.sh development taktconnect.com --dry-run --verbose

# Test development DNS configuration
./test-dns-configuration.sh development taktconnect.com --propagation
```

## 🔍 DNS Record Details

### CNAME Record Configuration

#### Frontend CNAME Records
```dns
# Production
app.taktconnect.com.     300    IN    CNAME    taktmate-frontend-prod.azurestaticapps.net.

# Staging
staging.taktconnect.com. 300    IN    CNAME    taktmate-frontend-staging.azurestaticapps.net.

# Development
dev.taktconnect.com.     300    IN    CNAME    taktmate-frontend-dev.azurestaticapps.net.
```

#### Backend CNAME Records
```dns
# Production
api.taktconnect.com.         300    IN    CNAME    taktmate-api-prod.azurewebsites.net.

# Staging
api-staging.taktconnect.com. 300    IN    CNAME    taktmate-api-staging.azurewebsites.net.

# Development
api-dev.taktconnect.com.     300    IN    CNAME    taktmate-api-dev.azurewebsites.net.
```

#### Additional Records (Production)
```dns
# WWW Redirect
www.taktconnect.com.     300    IN    CNAME    taktmate-frontend-prod.azurestaticapps.net.

# Domain Verification (if needed)
_taktmate-verify.taktconnect.com.    300    IN    TXT    "taktmate-domain-verification-token"
```

### TTL (Time To Live) Configuration
```yaml
Recommended TTL Values:
  Initial Setup: 300 seconds (5 minutes) - for quick changes during setup
  Production: 3600 seconds (1 hour) - balance between caching and flexibility
  Long-term: 86400 seconds (24 hours) - for stable, rarely-changing records

TTL Strategy:
  - Use low TTL during initial setup and testing
  - Increase TTL once DNS configuration is stable
  - Lower TTL before planned DNS changes
  - Monitor DNS query performance and costs
```

## 🧪 Testing and Validation

### DNS Testing Categories

#### 1. Infrastructure Testing
```bash
# Test DNS zone existence
az network dns zone show --name taktconnect.com --resource-group taktmate-prod-rg

# Verify name servers
az network dns zone show --name taktconnect.com --resource-group taktmate-prod-rg --query nameServers

# Check resource group permissions
az role assignment list --resource-group taktmate-prod-rg --assignee $(az account show --query user.name -o tsv)
```

#### 2. DNS Records Testing
```bash
# Test CNAME record existence
az network dns record-set cname show --name app --zone-name taktconnect.com --resource-group taktmate-prod-rg

# Verify CNAME targets
az network dns record-set cname show --name app --zone-name taktconnect.com --resource-group taktmate-prod-rg --query cname
```

#### 3. DNS Resolution Testing
```bash
# Basic resolution test
nslookup app.taktconnect.com

# Detailed DNS query
dig app.taktconnect.com

# Trace DNS resolution path
dig +trace app.taktconnect.com
```

#### 4. DNS Propagation Testing
```bash
# Test against multiple DNS servers
dig @8.8.8.8 app.taktconnect.com        # Google DNS
dig @1.1.1.1 app.taktconnect.com        # Cloudflare DNS
dig @208.67.222.222 app.taktconnect.com # OpenDNS
dig @9.9.9.9 app.taktconnect.com        # Quad9 DNS
```

#### 5. HTTP/HTTPS Accessibility Testing
```bash
# Test HTTP access
curl -I http://app.taktconnect.com

# Test HTTPS access (after SSL setup)
curl -I https://app.taktconnect.com

# Test API endpoint
curl -I https://api.taktconnect.com/api/health
```

### Automated Testing Workflow
```bash
# Complete DNS testing suite
./test-dns-configuration.sh production taktconnect.com --comprehensive --report

# Continuous monitoring during propagation
while true; do
  ./test-dns-configuration.sh production taktconnect.com --propagation --verbose
  sleep 300  # Check every 5 minutes
done
```

## 🚨 Troubleshooting

### Common Issues and Solutions

#### 1. DNS Zone Creation Fails
**Symptoms**: `az network dns zone create` fails
**Solutions**:
```bash
# Check Azure CLI authentication
az account show

# Verify resource group exists
az group show --name taktmate-prod-rg

# Check permissions
az role assignment list --resource-group taktmate-prod-rg --assignee $(az account show --query user.name -o tsv)

# Verify subscription limits
az network dns zone list --query "length(@)"
```

#### 2. CNAME Record Creation Fails
**Symptoms**: CNAME record creation or update fails
**Solutions**:
```bash
# Check if conflicting records exist
az network dns record-set list --zone-name taktconnect.com --resource-group taktmate-prod-rg --query "[?name=='app']"

# Remove conflicting A records
az network dns record-set a delete --name app --zone-name taktconnect.com --resource-group taktmate-prod-rg --yes

# Verify target hostname exists
nslookup taktmate-frontend-prod.azurestaticapps.net

# Check Azure resource exists
az staticwebapp show --name taktmate-frontend-prod --resource-group taktmate-prod-rg
```

#### 3. DNS Not Propagating
**Symptoms**: DNS changes not visible after several hours
**Solutions**:
```bash
# Verify name servers at registrar match Azure DNS
dig taktconnect.com NS

# Check TTL values
dig app.taktconnect.com | grep -E "^app\.taktconnect\.com"

# Test authoritative DNS servers directly
dig @ns1-01.azure-dns.com app.taktconnect.com

# Clear local DNS cache
sudo dscacheutil -flushcache  # macOS
sudo systemctl restart systemd-resolved  # Ubuntu/Debian
ipconfig /flushdns  # Windows
```

#### 4. Domain Resolution Fails
**Symptoms**: Domain doesn't resolve or resolves to wrong IP
**Solutions**:
```bash
# Check CNAME chain
dig app.taktconnect.com CNAME

# Verify target resolution
dig taktmate-frontend-prod.azurestaticapps.net

# Test from different locations
# Use online DNS propagation checkers
# Test from different networks
```

#### 5. HTTP/HTTPS Access Issues
**Symptoms**: Domain resolves but HTTP/HTTPS requests fail
**Solutions**:
```bash
# Check Azure service status
az staticwebapp show --name taktmate-frontend-prod --resource-group taktmate-prod-rg --query state
az webapp show --name taktmate-api-prod --resource-group taktmate-prod-rg --query state

# Verify custom domain configuration in Azure
az staticwebapp hostname list --name taktmate-frontend-prod --resource-group taktmate-prod-rg
az webapp config hostname list --webapp-name taktmate-api-prod --resource-group taktmate-prod-rg

# Test direct Azure URLs
curl -I https://taktmate-frontend-prod.azurestaticapps.net
curl -I https://taktmate-api-prod.azurewebsites.net/api/health
```

### Debug Commands

#### DNS Configuration Debugging
```bash
# List all DNS records
az network dns record-set list --zone-name taktconnect.com --resource-group taktmate-prod-rg --output table

# Show specific CNAME record details
az network dns record-set cname show --name app --zone-name taktconnect.com --resource-group taktmate-prod-rg

# Check DNS zone configuration
az network dns zone show --name taktconnect.com --resource-group taktmate-prod-rg

# Verify Azure resource hostnames
az staticwebapp show --name taktmate-frontend-prod --resource-group taktmate-prod-rg --query defaultHostname
az webapp show --name taktmate-api-prod --resource-group taktmate-prod-rg --query defaultHostName
```

#### DNS Resolution Debugging
```bash
# Detailed DNS trace
dig +trace +additional app.taktconnect.com

# Check specific record types
dig app.taktconnect.com A
dig app.taktconnect.com CNAME
dig app.taktconnect.com ANY

# Test authoritative servers
dig @ns1-01.azure-dns.com app.taktconnect.com
dig @ns2-01.azure-dns.net app.taktconnect.com

# Check reverse DNS
dig -x [IP_ADDRESS]
```

## 📊 DNS Monitoring and Maintenance

### DNS Health Monitoring
```bash
# Automated DNS health check
#!/bin/bash
domains=("app.taktconnect.com" "api.taktconnect.com" "www.taktconnect.com")

for domain in "${domains[@]}"; do
  if nslookup "$domain" >/dev/null 2>&1; then
    echo "✅ $domain resolves correctly"
  else
    echo "❌ $domain resolution failed"
    # Send alert
  fi
done
```

### DNS Performance Monitoring
```bash
# Monitor DNS response times
dig app.taktconnect.com | grep "Query time"

# Test from multiple locations
for server in 8.8.8.8 1.1.1.1 208.67.222.222; do
  echo "Testing DNS server: $server"
  time dig @$server app.taktconnect.com +short
done
```

### Regular Maintenance Tasks

#### Weekly DNS Review
1. **DNS Resolution Validation**
   ```bash
   ./test-dns-configuration.sh production taktconnect.com --comprehensive --report
   ```

2. **TTL Optimization Review**
   ```bash
   dig app.taktconnect.com | grep -E "^app\.taktconnect\.com.*[0-9]+.*IN"
   ```

3. **DNS Propagation Check**
   ```bash
   ./test-dns-configuration.sh production taktconnect.com --propagation --verbose
   ```

#### Monthly DNS Assessment
1. **Performance Analysis**
   - DNS query response times
   - Resolution success rates
   - Geographic resolution performance

2. **Security Review**
   - DNS record integrity
   - Unauthorized changes detection
   - DNSSEC consideration (if applicable)

3. **Cost Optimization**
   - DNS query volume analysis
   - TTL optimization opportunities
   - Unused record cleanup

## 📈 Best Practices

### DNS Configuration Best Practices

#### 1. Record Management
- **Use consistent naming**: Follow environment-specific naming conventions
- **Implement proper TTL strategy**: Balance caching with flexibility
- **Document all changes**: Maintain DNS change log
- **Use automation**: Leverage scripts for consistent configuration

#### 2. Security Considerations
- **Limit DNS zone access**: Use Azure RBAC for DNS zone management
- **Monitor DNS changes**: Set up alerts for unauthorized modifications
- **Backup DNS records**: Regular backups before major changes
- **Validate changes**: Always test DNS changes before applying

#### 3. Performance Optimization
- **Optimize TTL values**: Use appropriate TTL for different record types
- **Monitor DNS performance**: Regular response time monitoring
- **Use CDN integration**: Leverage Azure CDN with custom domains
- **Implement health checks**: Monitor domain accessibility

#### 4. Disaster Recovery
- **Document recovery procedures**: Clear steps for DNS restoration
- **Maintain backup DNS providers**: Secondary DNS provider consideration
- **Test recovery procedures**: Regular disaster recovery testing
- **Monitor external dependencies**: Track registrar and DNS provider status

### Integration with Azure Services

#### Static Web Apps Custom Domain
```bash
# Add custom domain to Static Web App
az staticwebapp hostname set \
  --name taktmate-frontend-prod \
  --resource-group taktmate-prod-rg \
  --hostname app.taktconnect.com

# Verify custom domain configuration
az staticwebapp hostname list \
  --name taktmate-frontend-prod \
  --resource-group taktmate-prod-rg
```

#### App Service Custom Domain
```bash
# Add custom domain to App Service
az webapp config hostname add \
  --webapp-name taktmate-api-prod \
  --resource-group taktmate-prod-rg \
  --hostname api.taktconnect.com

# Verify custom domain configuration
az webapp config hostname list \
  --webapp-name taktmate-api-prod \
  --resource-group taktmate-prod-rg
```

This comprehensive DNS configuration ensures reliable, scalable, and maintainable domain management for the TaktMate application across all environments.
