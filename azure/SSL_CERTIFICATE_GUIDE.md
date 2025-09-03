# SSL Certificate Configuration Guide for TaktMate

## Overview
This guide provides comprehensive instructions for SSL certificate management in Azure Static Web Apps and App Services for the TaktMate application. It covers automatic SSL provisioning, certificate monitoring, renewal processes, and security best practices across all environments.

## 🔒 SSL Certificate Architecture

### Azure SSL Certificate Management
```
┌─────────────────────────────────────────────────────────────┐
│                  TaktMate SSL Architecture                  │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────┐ │
│  │   Frontend      │  │     Backend      │  │ Certificate │ │
│  │ Static Web Apps │  │   App Service    │  │ Authority   │ │
│  │                 │  │                  │  │             │ │
│  │ • Let's Encrypt │  │ • Let's Encrypt  │  │Let's Encrypt│ │
│  │ • Auto Renewal  │  │ • Auto Renewal   │  │  DigiCert   │ │
│  │ • Multi-Domain  │  │ • SNI Support    │  │             │ │
│  └─────────────────┘  └──────────────────┘  └─────────────┘ │
├─────────────────────────────────────────────────────────────┤
│                      Certificate Lifecycle                 │
├─────────────────────────────────────────────────────────────┤
│  Domain Added → DNS Validation → Cert Issuance → Auto Renewal │
│       ↓              ↓              ↓              ↓       │
│   1-5 minutes    5-30 minutes   Immediate    ~30 days before│
│                                                    expiry   │
└─────────────────────────────────────────────────────────────┘
```

### SSL Certificate Features by Service
```yaml
Azure Static Web Apps:
  Certificate Authority: Let's Encrypt (primary), DigiCert (fallback)
  Validation Method: DNS validation (automatic)
  Renewal: Automatic, ~30 days before expiration
  Multi-Domain Support: Yes (apex + www)
  Wildcard Support: No
  Custom Certificate Upload: No
  TLS Versions: TLS 1.2, TLS 1.3
  Certificate Transparency: Automatic logging

Azure App Service:
  Certificate Authority: Let's Encrypt (managed), Custom (uploaded)
  Validation Method: DNS/HTTP validation
  Renewal: Automatic for managed certificates
  SNI Support: Yes
  IP-based SSL: Available (additional cost)
  Custom Certificate Upload: Yes
  TLS Versions: TLS 1.0, 1.1, 1.2, 1.3 (configurable)
  Certificate Binding: SNI or IP-based
```

## 🛠️ SSL Certificate Management Tools

### 1. SSL Certificate Management Script
**File**: `azure/configure-ssl-certificates.sh`

#### Key Features
- **Multi-environment SSL monitoring** across all TaktMate domains
- **Certificate expiration tracking** with configurable thresholds
- **SSL security analysis** including protocol and cipher testing
- **Performance testing** for SSL handshake and connection times
- **Azure Static Web App integration** for certificate status checking
- **Automated alerting** for certificate issues and renewals

#### Usage Examples
```bash
# Monitor all environments with alerts
./configure-ssl-certificates.sh all taktconnect.com --monitor --alert

# Comprehensive SSL analysis for production
./configure-ssl-certificates.sh production taktconnect.com --validate --security --performance --report

# SSL security audit for staging
./configure-ssl-certificates.sh staging taktconnect.com --security --verbose
```

### 2. SSL Renewal Monitoring Script
**File**: `azure/ssl-renewal-monitor.sh`

#### Monitoring Capabilities
- **Continuous SSL certificate monitoring** with configurable intervals
- **Automatic renewal detection** and verification
- **Multi-channel alerting** (email, webhook, Slack integration)
- **Certificate lifecycle tracking** from issuance to expiration
- **Health status reporting** with detailed logging
- **Daemon mode support** for production monitoring

#### Usage Examples
```bash
# Continuous monitoring with hourly checks
./ssl-renewal-monitor.sh --continuous --interval 3600 --alert

# Email alerts for certificate issues
./ssl-renewal-monitor.sh --continuous --alert --email admin@taktconnect.com

# Slack webhook integration
./ssl-renewal-monitor.sh --continuous --webhook https://hooks.slack.com/...
```

## 📋 SSL Certificate Lifecycle Management

### Automatic SSL Provisioning Process

#### Phase 1: Domain Configuration
```yaml
Prerequisites:
  - Custom domain configured in Azure Static Web App
  - DNS CNAME record pointing to Azure service
  - Domain validation status: "Ready"

Process:
  1. Domain added to Azure Static Web App
  2. Azure initiates SSL certificate request
  3. DNS validation performed automatically
  4. Certificate issued by Let's Encrypt or DigiCert
  5. Certificate bound to domain
  6. HTTPS traffic enabled
```

#### Phase 2: Certificate Validation
```bash
# Check certificate provisioning status
az staticwebapp hostname show \
  --name taktmate-frontend-prod \
  --resource-group taktmate-prod-rg \
  --hostname app.taktconnect.com \
  --query "{status:status,sslState:sslState,validationStatus:validationStatus}"

# Expected output for successful provisioning:
{
  "status": "Ready",
  "sslState": "Ready", 
  "validationStatus": "Succeeded"
}
```

#### Phase 3: Certificate Monitoring
```bash
# Monitor certificate expiration
./configure-ssl-certificates.sh production taktconnect.com --monitor --verbose

# Continuous renewal monitoring
./ssl-renewal-monitor.sh --continuous --interval 3600 --alert
```

### SSL Certificate Renewal Process

#### Automatic Renewal Timeline
```yaml
Certificate Lifecycle (Let's Encrypt - 90 days):
  Day 0: Certificate issued
  Day 60: Azure begins monitoring for renewal (~30 days before expiry)
  Day 70: First renewal attempt (if needed)
  Day 75: Second renewal attempt (if first failed)
  Day 80: Third renewal attempt (if previous failed)
  Day 85: Critical alert threshold
  Day 90: Certificate expires (if renewal failed)

Renewal Process:
  1. Azure monitors certificate expiration
  2. Renewal initiated ~30 days before expiry
  3. New certificate requested from CA
  4. DNS validation performed
  5. New certificate issued and bound
  6. Old certificate replaced seamlessly
  7. No downtime during renewal
```

#### Renewal Verification
```bash
# Check for recent certificate renewal
check_certificate_renewal() {
  local domain=$1
  local issue_date=$(echo | openssl s_client -servername "$domain" -connect "$domain:443" 2>/dev/null | openssl x509 -noout -startdate | cut -d'=' -f2)
  local days_since_issue=$(( ($(date +%s) - $(date -d "$issue_date" +%s)) / 86400 ))
  
  if [ $days_since_issue -le 7 ]; then
    echo "Certificate for $domain was renewed $days_since_issue days ago"
  else
    echo "Certificate for $domain was issued $days_since_issue days ago"
  fi
}

check_certificate_renewal "app.taktconnect.com"
```

## 🎯 Environment-Specific SSL Configuration

### Production Environment
**Domains**: `app.taktconnect.com`, `www.taktconnect.com`
**Static Web App**: `taktmate-frontend-prod`
**Resource Group**: `taktmate-prod-rg`

#### SSL Configuration Status
```bash
# Check production SSL certificates
./configure-ssl-certificates.sh production taktconnect.com --monitor --validate

# Expected certificate details:
# app.taktconnect.com:
#   - Issuer: Let's Encrypt Authority X3
#   - Valid: 90 days from issue
#   - SANs: app.taktconnect.com
#   - TLS: 1.2, 1.3 supported
# 
# www.taktconnect.com:
#   - Issuer: Let's Encrypt Authority X3
#   - Valid: 90 days from issue
#   - SANs: www.taktconnect.com
#   - TLS: 1.2, 1.3 supported
```

#### Production SSL Monitoring
```bash
# Continuous production monitoring
./ssl-renewal-monitor.sh --continuous --interval 3600 --alert \
  --email admin@taktconnect.com \
  --webhook https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK

# Production certificate health check
./configure-ssl-certificates.sh production taktconnect.com \
  --monitor --security --performance --report
```

### Staging Environment
**Domain**: `staging.taktconnect.com`
**Static Web App**: `taktmate-frontend-staging`
**Resource Group**: `taktmate-staging-rg`

#### SSL Configuration Status
```bash
# Check staging SSL certificate
./configure-ssl-certificates.sh staging taktconnect.com --monitor --validate

# Staging-specific monitoring (less frequent)
./ssl-renewal-monitor.sh --continuous --interval 7200 --alert
```

### Development Environment
**Domain**: `dev.taktconnect.com`
**Static Web App**: `taktmate-frontend-dev`
**Resource Group**: `taktmate-dev-rg`

#### SSL Configuration Status
```bash
# Check development SSL certificate
./configure-ssl-certificates.sh development taktconnect.com --monitor

# Development monitoring (daily checks)
./ssl-renewal-monitor.sh --continuous --interval 86400
```

## 🔍 SSL Certificate Testing and Validation

### Certificate Validation Tests

#### 1. Certificate Existence and Validity
```bash
# Test certificate accessibility
echo | openssl s_client -servername app.taktconnect.com -connect app.taktconnect.com:443 -verify_return_error

# Check certificate dates
echo | openssl s_client -servername app.taktconnect.com -connect app.taktconnect.com:443 2>/dev/null | openssl x509 -noout -dates

# Validate certificate chain
echo | openssl s_client -servername app.taktconnect.com -connect app.taktconnect.com:443 -showcerts
```

#### 2. SSL Protocol and Cipher Testing
```bash
# Test TLS 1.2 support
echo | openssl s_client -tls1_2 -servername app.taktconnect.com -connect app.taktconnect.com:443

# Test TLS 1.3 support
echo | openssl s_client -tls1_3 -servername app.taktconnect.com -connect app.taktconnect.com:443

# Check cipher suites
nmap --script ssl-enum-ciphers -p 443 app.taktconnect.com
```

#### 3. Certificate Security Analysis
```bash
# Comprehensive SSL security test
./configure-ssl-certificates.sh production taktconnect.com --security --verbose

# Test results include:
# - Supported TLS versions
# - Cipher strength analysis
# - Certificate chain validation
# - Protocol vulnerability checks
# - Certificate transparency verification
```

### SSL Performance Testing

#### 1. SSL Handshake Performance
```bash
# Measure SSL handshake time
curl -w "DNS: %{time_namelookup}s, Connect: %{time_connect}s, SSL: %{time_appconnect}s, Total: %{time_total}s\n" \
  -o /dev/null -s "https://app.taktconnect.com"

# Performance benchmarking
./configure-ssl-certificates.sh production taktconnect.com --performance --verbose
```

#### 2. SSL Connection Optimization
```yaml
Performance Metrics:
  DNS Resolution: < 100ms (excellent), < 500ms (good)
  SSL Handshake: < 500ms (excellent), < 1000ms (good)
  Total Connection: < 1000ms (excellent), < 2000ms (good)

Optimization Factors:
  - Geographic proximity to Azure region
  - DNS provider performance
  - Client TLS version support
  - Certificate chain length
  - OCSP stapling configuration
```

## 🚨 SSL Certificate Troubleshooting

### Common SSL Issues and Solutions

#### 1. Certificate Not Provisioning
**Symptoms**: Domain shows "Validating" or "Failed" status
**Solutions**:
```bash
# Check domain configuration in Azure
az staticwebapp hostname show \
  --name taktmate-frontend-prod \
  --resource-group taktmate-prod-rg \
  --hostname app.taktconnect.com

# Verify DNS configuration
nslookup app.taktconnect.com
dig app.taktconnect.com CNAME

# Check CNAME points to correct Static Web App
# Expected: app.taktconnect.com → taktmate-frontend-prod.azurestaticapps.net

# Remove and re-add domain if validation fails
az staticwebapp hostname delete \
  --name taktmate-frontend-prod \
  --resource-group taktmate-prod-rg \
  --hostname app.taktconnect.com --yes

# Wait 5 minutes, then re-add
az staticwebapp hostname set \
  --name taktmate-frontend-prod \
  --resource-group taktmate-prod-rg \
  --hostname app.taktconnect.com
```

#### 2. Certificate Expired or Renewal Failed
**Symptoms**: HTTPS not working, certificate expired error
**Solutions**:
```bash
# Check certificate expiration
echo | openssl s_client -servername app.taktconnect.com -connect app.taktconnect.com:443 2>/dev/null | openssl x509 -noout -dates

# Force certificate renewal (Azure handles automatically)
# Contact Azure support if automatic renewal fails repeatedly

# Temporary workaround: Remove and re-add domain
az staticwebapp hostname delete \
  --name taktmate-frontend-prod \
  --resource-group taktmate-prod-rg \
  --hostname app.taktconnect.com --yes

az staticwebapp hostname set \
  --name taktmate-frontend-prod \
  --resource-group taktmate-prod-rg \
  --hostname app.taktconnect.com
```

#### 3. SSL Certificate Mismatch
**Symptoms**: Browser certificate warnings, hostname mismatch
**Solutions**:
```bash
# Check certificate subject and SANs
echo | openssl s_client -servername app.taktconnect.com -connect app.taktconnect.com:443 2>/dev/null | openssl x509 -noout -subject -ext subjectAltName

# Verify correct hostname configuration
az staticwebapp hostname list \
  --name taktmate-frontend-prod \
  --resource-group taktmate-prod-rg

# Ensure DNS and Azure configuration match exactly
```

#### 4. SSL Performance Issues
**Symptoms**: Slow HTTPS connections, timeouts
**Solutions**:
```bash
# Test SSL performance
./configure-ssl-certificates.sh production taktconnect.com --performance

# Check DNS resolution performance
dig app.taktconnect.com @8.8.8.8
dig app.taktconnect.com @1.1.1.1

# Test from different locations
curl -w "@curl-format.txt" https://app.taktconnect.com
```

### SSL Certificate Monitoring and Alerts

#### 1. Certificate Expiration Monitoring
```bash
# Set up continuous monitoring with alerts
./ssl-renewal-monitor.sh --continuous --interval 3600 \
  --alert --email admin@taktconnect.com

# Configure alert thresholds
CRITICAL_THRESHOLD=7   # Alert when < 7 days until expiry
WARNING_THRESHOLD=30   # Alert when < 30 days until expiry
RENEWAL_THRESHOLD=30   # Monitor renewal process when < 30 days
```

#### 2. Automated Alert Notifications
```yaml
Alert Channels:
  Email:
    - SMTP configuration required
    - Multiple recipients supported
    - HTML/plain text formats
  
  Webhook (Slack/Teams):
    - JSON payload format
    - Color-coded alerts (red/orange/green)
    - Rich message formatting
  
  Custom Integrations:
    - PagerDuty API
    - AWS SNS
    - Azure Monitor alerts
    - Custom monitoring systems
```

#### 3. SSL Health Dashboard
```bash
# Generate SSL certificate report
./configure-ssl-certificates.sh all taktconnect.com \
  --monitor --validate --security --report

# Report includes:
# - Certificate expiration dates
# - Renewal status
# - Security analysis results
# - Performance metrics
# - Historical trends
```

## 📊 SSL Certificate Monitoring and Maintenance

### Daily SSL Operations

#### 1. Certificate Health Check
```bash
#!/bin/bash
# Daily SSL health check script

domains=("app.taktconnect.com" "www.taktconnect.com" "staging.taktconnect.com" "dev.taktconnect.com")

for domain in "${domains[@]}"; do
  # Check certificate accessibility
  if curl -s -I "https://$domain" | grep -q "200 OK"; then
    echo "✅ $domain - HTTPS accessible"
    
    # Check certificate expiration
    expiry_days=$(echo | openssl s_client -servername "$domain" -connect "$domain:443" 2>/dev/null | openssl x509 -noout -dates | grep "notAfter" | cut -d'=' -f2)
    days_until_expiry=$(( ($(date -d "$expiry_days" +%s) - $(date +%s)) / 86400 ))
    
    if [ $days_until_expiry -gt 30 ]; then
      echo "✅ $domain - Certificate valid for $days_until_expiry days"
    elif [ $days_until_expiry -gt 7 ]; then
      echo "⚠️  $domain - Certificate expires in $days_until_expiry days"
    else
      echo "🚨 $domain - Certificate expires in $days_until_expiry days - CRITICAL!"
    fi
  else
    echo "❌ $domain - HTTPS not accessible"
  fi
done
```

#### 2. Certificate Renewal Monitoring
```bash
# Monitor certificate renewal process
./ssl-renewal-monitor.sh --continuous --interval 3600 \
  --alert --log-file /var/log/taktmate/ssl-monitor.log

# Check renewal logs
tail -f /var/log/taktmate/ssl-monitor.log | grep -E "(RENEWAL|CRITICAL|WARNING)"
```

### Weekly SSL Maintenance

#### 1. Comprehensive SSL Audit
```bash
# Weekly SSL security and performance audit
./configure-ssl-certificates.sh all taktconnect.com \
  --monitor --validate --security --performance --report --verbose

# Review audit results
ls -la azure/reports/ssl-certificate-report-*.json
```

#### 2. SSL Configuration Review
```bash
# Review SSL configuration across all environments
for env in production staging development; do
  echo "=== $env Environment ==="
  ./configure-ssl-certificates.sh $env taktconnect.com --validate --verbose
  echo ""
done
```

### Monthly SSL Assessment

#### 1. Certificate Lifecycle Analysis
```yaml
Monthly Review Items:
  - Certificate issuance patterns
  - Renewal success rates
  - Performance trend analysis
  - Security configuration updates
  - Alert effectiveness review
  - Monitoring system health
```

#### 2. SSL Security Updates
```bash
# Check for SSL security updates and best practices
# Review TLS version support
# Update cipher suite preferences
# Verify certificate transparency logging
# Check for new security headers
```

## 📈 SSL Certificate Best Practices

### Security Best Practices

#### 1. TLS Configuration
```yaml
TLS Version Support:
  Minimum: TLS 1.2 (disable TLS 1.0, 1.1)
  Preferred: TLS 1.3
  Cipher Suites: Modern, secure ciphers only
  Perfect Forward Secrecy: Enabled
  HSTS: Enabled with long max-age
```

#### 2. Certificate Management
```yaml
Certificate Practices:
  Authority: Use trusted CAs (Let's Encrypt, DigiCert)
  Validation: Domain validation sufficient for most cases
  Key Size: 2048-bit RSA minimum, ECDSA preferred
  Renewal: Automated renewal with monitoring
  Backup: Regular certificate configuration backups
  Transparency: Certificate Transparency logging enabled
```

### Performance Optimization

#### 1. SSL Performance Tuning
```yaml
Performance Optimizations:
  OCSP Stapling: Enabled (reduces client validation time)
  Session Resumption: Enabled (faster reconnections)
  HTTP/2: Enabled (multiplexed connections)
  Certificate Chain: Optimized (minimal chain length)
  Caching: Appropriate cache headers
```

#### 2. Monitoring and Alerting
```yaml
Monitoring Strategy:
  Frequency: Hourly for production, daily for non-production
  Thresholds: 30 days warning, 7 days critical
  Channels: Email, Slack, PagerDuty for critical issues
  Metrics: Expiration, performance, security posture
  Automation: Fully automated monitoring and alerting
```

### Integration with CI/CD

#### 1. SSL Certificate Validation in Pipelines
```yaml
# Add to GitHub Actions workflow
- name: Validate SSL Certificates
  run: |
    ./azure/configure-ssl-certificates.sh production taktconnect.com --validate
    ./azure/configure-ssl-certificates.sh staging taktconnect.com --validate
```

#### 2. Deployment Health Checks
```yaml
# Post-deployment SSL verification
- name: Post-Deploy SSL Check
  run: |
    sleep 60  # Wait for DNS propagation
    ./azure/test-static-web-app-domains.sh production taktconnect.com --ssl
```

This comprehensive SSL certificate management system ensures secure, reliable, and automated certificate lifecycle management for the TaktMate application across all environments.
