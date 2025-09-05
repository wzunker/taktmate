#!/usr/bin/env node

/**
 * Alert Deployment and Management Script for TaktMate
 * 
 * This script deploys and manages Application Insights alert rules
 * and action groups for comprehensive application monitoring.
 */

const fs = require('fs');
const path = require('path');

/**
 * Colors for console output
 */
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

/**
 * Log with colors and timestamps
 */
function log(message, color = colors.reset) {
  const timestamp = new Date().toISOString();
  console.log(`${colors.blue}[${timestamp}]${colors.reset} ${color}${message}${colors.reset}`);
}

/**
 * Alert categories and configurations
 */
const alertCategories = [
  {
    name: 'critical-error-alerts',
    displayName: 'Critical Error Alerts',
    description: 'High-severity alerts for critical application errors',
    template: 'critical-error-alerts.json',
    severity: 'critical',
    alerts: [
      'High Error Rate',
      'Unhandled Exceptions',
      'Critical Errors Spike',
      'Authentication Failures',
      'External Service Failures'
    ]
  },
  {
    name: 'performance-alerts',
    displayName: 'Performance Monitoring Alerts',
    description: 'Performance degradation and resource utilization alerts',
    template: 'performance-alerts.json',
    severity: 'warning',
    alerts: [
      'High Response Time',
      'Low Throughput',
      'High Memory Usage',
      'Slow CSV Processing',
      'High CPU Load',
      'Dependency Performance Degradation'
    ]
  },
  {
    name: 'availability-business-alerts',
    displayName: 'Availability and Business Alerts',
    description: 'Service availability and business process monitoring',
    template: 'availability-business-alerts.json',
    severity: 'warning',
    alerts: [
      'Application Unavailable',
      'Service Availability Drop',
      'CSV Processing Failures',
      'Chat Service Degradation',
      'User Activity Drop',
      'Data Processing Volume Drop'
    ]
  }
];

/**
 * Configuration validation
 */
function validateConfiguration() {
  log('🔍 Validating alert deployment configuration...', colors.cyan);
  
  const requiredEnvVars = [
    'AZURE_SUBSCRIPTION_ID',
    'AZURE_RESOURCE_GROUP',
    'APPINSIGHTS_NAME'
  ];
  
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    log(`❌ Missing required environment variables: ${missingVars.join(', ')}`, colors.red);
    log('Please set the following environment variables:', colors.yellow);
    missingVars.forEach(varName => {
      log(`  export ${varName}=<your-value>`, colors.blue);
    });
    return false;
  }
  
  // Validate alert templates exist
  const alertsDir = path.join(__dirname, '..', 'alerts');
  const missingTemplates = alertCategories.filter(category => {
    const templatePath = path.join(alertsDir, category.template);
    return !fs.existsSync(templatePath);
  });
  
  if (missingTemplates.length > 0) {
    log(`❌ Missing alert templates: ${missingTemplates.map(t => t.template).join(', ')}`, colors.red);
    return false;
  }
  
  // Validate action group template
  const actionGroupPath = path.join(alertsDir, 'action-groups.json');
  if (!fs.existsSync(actionGroupPath)) {
    log('❌ Missing action group template: action-groups.json', colors.red);
    return false;
  }
  
  log('✅ Configuration validation passed', colors.green);
  return true;
}

/**
 * Generate Azure CLI deployment command for action groups
 */
function generateActionGroupDeploymentCommand(resourceGroup, subscriptionId, emailRecipients, smsRecipients = [], webhookUrl = '') {
  const templatePath = path.join(__dirname, '..', 'alerts', 'action-groups.json');
  const deploymentName = `taktmate-action-groups-${Date.now()}`;
  
  let parametersJson = {
    actionGroupName: { value: 'TaktMate-Alerts' },
    emailRecipients: { value: emailRecipients }
  };
  
  if (smsRecipients.length > 0) {
    parametersJson.smsRecipients = { value: smsRecipients };
  }
  
  if (webhookUrl) {
    parametersJson.webhookUrl = { value: webhookUrl };
  }
  
  const parametersFile = path.join(__dirname, '..', 'alerts', 'temp-action-groups-params.json');
  fs.writeFileSync(parametersFile, JSON.stringify(parametersJson, null, 2));
  
  return {
    command: `az deployment group create \\
  --resource-group "${resourceGroup}" \\
  --subscription "${subscriptionId}" \\
  --name "${deploymentName}" \\
  --template-file "${templatePath}" \\
  --parameters @"${parametersFile}"`,
    cleanup: () => {
      if (fs.existsSync(parametersFile)) {
        fs.unlinkSync(parametersFile);
      }
    }
  };
}

/**
 * Generate Azure CLI deployment command for alert category
 */
function generateAlertDeploymentCommand(category, resourceGroup, subscriptionId, appInsightsName, actionGroupResourceId) {
  const templatePath = path.join(__dirname, '..', 'alerts', category.template);
  const deploymentName = `taktmate-${category.name}-${Date.now()}`;
  
  return `az deployment group create \\
  --resource-group "${resourceGroup}" \\
  --subscription "${subscriptionId}" \\
  --name "${deploymentName}" \\
  --template-file "${templatePath}" \\
  --parameters \\
    applicationInsightsName="${appInsightsName}" \\
    actionGroupResourceId="${actionGroupResourceId}" \\
    alertNamePrefix="TaktMate"`;
}

/**
 * Generate PowerShell deployment command
 */
function generatePowerShellCommand(category, resourceGroup, appInsightsName, actionGroupResourceId) {
  const templatePath = path.join(__dirname, '..', 'alerts', category.template);
  const deploymentName = `taktmate-${category.name}-${Date.now()}`;
  
  return `New-AzResourceGroupDeployment \\
  -ResourceGroupName "${resourceGroup}" \\
  -Name "${deploymentName}" \\
  -TemplateFile "${templatePath}" \\
  -applicationInsightsName "${appInsightsName}" \\
  -actionGroupResourceId "${actionGroupResourceId}" \\
  -alertNamePrefix "TaktMate"`;
}

/**
 * Generate deployment script
 */
function generateDeploymentScript(format = 'bash') {
  const subscriptionId = process.env.AZURE_SUBSCRIPTION_ID;
  const resourceGroup = process.env.AZURE_RESOURCE_GROUP;
  const appInsightsName = process.env.APPINSIGHTS_NAME;
  const emailRecipients = JSON.parse(process.env.ALERT_EMAIL_RECIPIENTS || '[{"name":"DevOps Team","emailAddress":"devops@taktmate.com"}]');
  const smsRecipients = JSON.parse(process.env.ALERT_SMS_RECIPIENTS || '[]');
  const webhookUrl = process.env.ALERT_WEBHOOK_URL || '';
  
  let script = '';
  
  if (format === 'bash') {
    script += '#!/bin/bash\n\n';
    script += '# TaktMate Alert Rules Deployment Script\n';
    script += '# Generated automatically - do not edit manually\n\n';
    script += 'set -e\n\n';
    script += 'echo "🚨 Deploying TaktMate Application Insights Alert Rules..."\n\n';
    
    // Deploy action groups first
    script += 'echo "📧 Deploying Action Groups..."\n';
    const actionGroupDeployment = generateActionGroupDeploymentCommand(resourceGroup, subscriptionId, emailRecipients, smsRecipients, webhookUrl);
    script += actionGroupDeployment.command + '\n\n';
    
    script += 'echo "⏳ Waiting for action groups deployment to complete..."\n';
    script += 'sleep 30\n\n';
    
    // Get action group resource ID
    script += '# Get action group resource ID\n';
    script += `ACTION_GROUP_ID=$(az monitor action-group show --name "TaktMate-Alerts" --resource-group "${resourceGroup}" --query "id" -o tsv)\n`;
    script += 'echo "Action Group ID: $ACTION_GROUP_ID"\n\n';
    
    // Deploy alert categories
    alertCategories.forEach((category, index) => {
      script += `echo "🚨 Deploying ${category.displayName}..."\n`;
      script += generateAlertDeploymentCommand(category, resourceGroup, subscriptionId, appInsightsName, '$ACTION_GROUP_ID');
      script += '\n\n';
      
      if (index < alertCategories.length - 1) {
        script += 'echo "⏳ Waiting 15 seconds before next deployment..."\n';
        script += 'sleep 15\n\n';
      }
    });
    
    script += 'echo "✅ All alert rules deployed successfully!"\n';
    script += 'echo "🌐 Access your alerts in the Azure Portal under Monitor > Alerts"\n';
    
  } else if (format === 'powershell') {
    script += '# TaktMate Alert Rules Deployment Script\n';
    script += '# Generated automatically - do not edit manually\n\n';
    script += 'Write-Host "🚨 Deploying TaktMate Application Insights Alert Rules..." -ForegroundColor Cyan\n\n';
    
    // Deploy action groups first
    script += 'Write-Host "📧 Deploying Action Groups..." -ForegroundColor Yellow\n';
    // PowerShell action group deployment would be more complex, so provide placeholder
    script += '# Action group deployment (implement based on your PowerShell setup)\n\n';
    
    alertCategories.forEach((category, index) => {
      script += `Write-Host "🚨 Deploying ${category.displayName}..." -ForegroundColor Yellow\n`;
      script += generatePowerShellCommand(category, resourceGroup, appInsightsName, '$ActionGroupResourceId');
      script += '\n\n';
      
      if (index < alertCategories.length - 1) {
        script += 'Write-Host "⏳ Waiting 15 seconds before next deployment..." -ForegroundColor Blue\n';
        script += 'Start-Sleep -Seconds 15\n\n';
      }
    });
    
    script += 'Write-Host "✅ All alert rules deployed successfully!" -ForegroundColor Green\n';
    script += 'Write-Host "🌐 Access your alerts in the Azure Portal under Monitor > Alerts" -ForegroundColor Cyan\n';
  }
  
  return script;
}

/**
 * Generate manual deployment instructions
 */
function generateManualInstructions() {
  const subscriptionId = process.env.AZURE_SUBSCRIPTION_ID;
  const resourceGroup = process.env.AZURE_RESOURCE_GROUP;
  const appInsightsName = process.env.APPINSIGHTS_NAME;
  
  let instructions = '';
  instructions += '# TaktMate Alert Rules Manual Deployment Instructions\n\n';
  instructions += '## Prerequisites\n\n';
  instructions += '1. Install Azure CLI: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli\n';
  instructions += '2. Login to Azure: `az login`\n';
  instructions += `3. Set subscription: \`az account set --subscription "${subscriptionId}"\`\n\n`;
  instructions += '## Step 1: Deploy Action Groups\n\n';
  instructions += 'Deploy the action groups first to handle alert notifications:\n\n';
  instructions += '```bash\n';
  const emailRecipients = JSON.parse(process.env.ALERT_EMAIL_RECIPIENTS || '[{"name":"DevOps Team","emailAddress":"devops@taktmate.com"}]');
  const actionGroupDeployment = generateActionGroupDeploymentCommand(resourceGroup, subscriptionId, emailRecipients);
  instructions += actionGroupDeployment.command + '\n';
  instructions += '```\n\n';
  instructions += '## Step 2: Get Action Group Resource ID\n\n';
  instructions += '```bash\n';
  instructions += `ACTION_GROUP_ID=$(az monitor action-group show --name "TaktMate-Alerts" --resource-group "${resourceGroup}" --query "id" -o tsv)\n`;
  instructions += 'echo "Action Group ID: $ACTION_GROUP_ID"\n';
  instructions += '```\n\n';
  instructions += '## Step 3: Deploy Alert Rules\n\n';
  instructions += 'Deploy each category of alert rules:\n\n';
  
  alertCategories.forEach(category => {
    instructions += `### ${category.displayName}\n\n`;
    instructions += `${category.description}\n\n`;
    instructions += '```bash\n';
    instructions += generateAlertDeploymentCommand(category, resourceGroup, subscriptionId, appInsightsName, '$ACTION_GROUP_ID');
    instructions += '\n```\n\n';
  });
  
  instructions += '## Alert Categories Summary\n\n';
  alertCategories.forEach(category => {
    instructions += `### ${category.displayName} (${category.severity})\n\n`;
    category.alerts.forEach(alert => {
      instructions += `- ${alert}\n`;
    });
    instructions += '\n';
  });
  
  instructions += '## Post-Deployment\n\n';
  instructions += '1. Navigate to the Azure Portal\n';
  instructions += '2. Go to Monitor > Alerts\n';
  instructions += '3. Verify your alert rules are active\n';
  instructions += '4. Test alert notifications\n';
  instructions += '5. Customize thresholds as needed\n\n';
  instructions += '## Troubleshooting\n\n';
  instructions += '- Ensure your Application Insights instance is active and receiving data\n';
  instructions += '- Verify email addresses in action groups are correct\n';
  instructions += '- Check that alert queries return data in Application Insights\n';
  instructions += '- Review Azure CLI/PowerShell output for specific error messages\n';
  
  return instructions;
}

/**
 * Generate alert configuration summary
 */
function generateAlertSummary() {
  const subscriptionId = process.env.AZURE_SUBSCRIPTION_ID;
  const resourceGroup = process.env.AZURE_RESOURCE_GROUP;
  const appInsightsName = process.env.APPINSIGHTS_NAME;
  
  let summary = '';
  summary += '# TaktMate Alert Configuration Summary\n\n';
  summary += '## Deployment Configuration\n\n';
  summary += `- **Subscription ID**: ${subscriptionId}\n`;
  summary += `- **Resource Group**: ${resourceGroup}\n`;
  summary += `- **Application Insights**: ${appInsightsName}\n\n`;
  summary += '## Alert Categories\n\n';
  
  alertCategories.forEach(category => {
    summary += `### ${category.displayName}\n\n`;
    summary += `- **Template**: ${category.template}\n`;
    summary += `- **Severity**: ${category.severity}\n`;
    summary += `- **Description**: ${category.description}\n`;
    summary += `- **Alert Count**: ${category.alerts.length}\n\n`;
    summary += '**Alerts:**\n';
    category.alerts.forEach(alert => {
      summary += `- ${alert}\n`;
    });
    summary += '\n';
  });
  
  summary += '## Alert Thresholds and Conditions\n\n';
  summary += '### Critical Error Alerts\n';
  summary += '- **High Error Rate**: > 5% error rate over 5 minutes\n';
  summary += '- **Unhandled Exceptions**: Any unhandled exception detected\n';
  summary += '- **Critical Errors Spike**: 3x increase from baseline with > 2 errors\n';
  summary += '- **Authentication Failures**: > 10 failures or > 5 unique users in 10 minutes\n';
  summary += '- **External Service Failures**: > 5 dependency failures in 10 minutes\n\n';
  
  summary += '### Performance Alerts\n';
  summary += '- **High Response Time**: P95 > 5 seconds for 2 consecutive periods\n';
  summary += '- **Low Throughput**: < 30% of baseline requests per minute\n';
  summary += '- **High Memory Usage**: > 85% memory usage for 2 consecutive periods\n';
  summary += '- **Slow CSV Processing**: > 2x baseline processing time and > 30 seconds\n';
  summary += '- **High CPU Load**: Load average > 90% of CPU count\n';
  summary += '- **Dependency Performance**: > 2x baseline response time and > 5 seconds\n\n';
  
  summary += '### Availability and Business Alerts\n';
  summary += '- **Application Unavailable**: No requests for 10 minutes during business hours\n';
  summary += '- **Service Availability Drop**: < 95% availability with > 10 requests\n';
  summary += '- **CSV Processing Failures**: > 20% failure rate with > 5 uploads\n';
  summary += '- **Chat Service Degradation**: < 80% success rate with > 5 chats\n';
  summary += '- **User Activity Drop**: < 30% of expected user activity\n';
  summary += '- **Data Processing Volume Drop**: < 20% of expected data volume\n\n';
  
  summary += '## Notification Channels\n\n';
  summary += '- **Email**: Primary notification method for all alerts\n';
  summary += '- **SMS**: Optional for critical alerts only\n';
  summary += '- **Webhook**: Integration with Slack/Teams (optional)\n';
  summary += '- **Logic App**: Automated response workflows (optional)\n\n';
  
  summary += '## Action Groups\n\n';
  summary += '- **TaktMate-Alerts**: Standard alerts (email + webhook)\n';
  summary += '- **TaktMate-Alerts-Critical**: Critical alerts (email + SMS + webhook)\n';
  summary += '- **TaktMate-Alerts-Business**: Business alerts (limited email + webhook)\n\n';
  
  return summary;
}

/**
 * Create output directory
 */
function createOutputDirectory() {
  const outputDir = path.join(__dirname, '..', 'alert-deployment');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  return outputDir;
}

/**
 * Main function
 */
function main() {
  const command = process.argv[2] || 'help';
  
  log('🚨 TaktMate Alert Deployment Script', colors.bright);
  log(`Environment: ${process.env.NODE_ENV || 'development'}`, colors.blue);
  
  switch (command) {
    case 'validate':
      if (validateConfiguration()) {
        log('✅ Configuration is valid and ready for deployment', colors.green);
        process.exit(0);
      } else {
        log('❌ Configuration validation failed', colors.red);
        process.exit(1);
      }
      break;
      
    case 'generate':
      if (!validateConfiguration()) {
        process.exit(1);
      }
      
      const outputDir = createOutputDirectory();
      
      // Generate bash deployment script
      const bashScript = generateDeploymentScript('bash');
      const bashPath = path.join(outputDir, 'deploy-alerts.sh');
      fs.writeFileSync(bashPath, bashScript);
      fs.chmodSync(bashPath, '755');
      log(`✅ Generated bash deployment script: ${bashPath}`, colors.green);
      
      // Generate PowerShell deployment script
      const psScript = generateDeploymentScript('powershell');
      const psPath = path.join(outputDir, 'deploy-alerts.ps1');
      fs.writeFileSync(psPath, psScript);
      log(`✅ Generated PowerShell deployment script: ${psPath}`, colors.green);
      
      // Generate manual instructions
      const instructions = generateManualInstructions();
      const instructionsPath = path.join(outputDir, 'ALERT_DEPLOYMENT_INSTRUCTIONS.md');
      fs.writeFileSync(instructionsPath, instructions);
      log(`✅ Generated deployment instructions: ${instructionsPath}`, colors.green);
      
      // Generate alert summary
      const summary = generateAlertSummary();
      const summaryPath = path.join(outputDir, 'ALERT_CONFIGURATION_SUMMARY.md');
      fs.writeFileSync(summaryPath, summary);
      log(`✅ Generated alert configuration summary: ${summaryPath}`, colors.green);
      
      log('\\n🚨 Alert deployment files generated successfully!', colors.cyan);
      log('Next steps:', colors.yellow);
      log('1. Review the generated files in the alert-deployment directory', colors.blue);
      log('2. Configure email recipients and notification channels', colors.blue);
      log('3. Run the deployment script or follow manual instructions', colors.blue);
      log('4. Test alert notifications and adjust thresholds as needed', colors.blue);
      break;
      
    case 'list':
      log('\\n🚨 Available TaktMate Alert Categories:', colors.cyan);
      alertCategories.forEach((category, index) => {
        log(`\\n${index + 1}. ${category.displayName} (${category.severity})`, colors.yellow);
        log(`   Description: ${category.description}`, colors.blue);
        log(`   Template: ${category.template}`, colors.blue);
        log(`   Alerts: ${category.alerts.length}`, colors.blue);
        category.alerts.forEach(alert => {
          log(`     - ${alert}`, colors.blue);
        });
      });
      break;
      
    case 'help':
    default:
      log('\\nUsage: node deploy-alerts.js [command]', colors.yellow);
      log('\\nCommands:', colors.yellow);
      log('  validate  - Validate deployment configuration', colors.blue);
      log('  generate  - Generate deployment scripts and instructions', colors.blue);
      log('  list      - List available alert categories and rules', colors.blue);
      log('  help      - Display this help', colors.blue);
      log('\\nRequired Environment Variables:', colors.yellow);
      log('  AZURE_SUBSCRIPTION_ID       - Your Azure subscription ID', colors.blue);
      log('  AZURE_RESOURCE_GROUP         - Target resource group name', colors.blue);
      log('  APPINSIGHTS_NAME             - Application Insights instance name', colors.blue);
      log('\\nOptional Environment Variables:', colors.yellow);
      log('  ALERT_EMAIL_RECIPIENTS       - JSON array of email recipients', colors.blue);
      log('  ALERT_SMS_RECIPIENTS         - JSON array of SMS recipients', colors.blue);
      log('  ALERT_WEBHOOK_URL            - Webhook URL for Slack/Teams', colors.blue);
      log('\\nExample:', colors.yellow);
      log('  export AZURE_SUBSCRIPTION_ID="12345678-1234-1234-1234-123456789012"', colors.blue);
      log('  export AZURE_RESOURCE_GROUP="taktmate-resources"', colors.blue);
      log('  export APPINSIGHTS_NAME="taktmate-insights"', colors.blue);
      log('  export ALERT_EMAIL_RECIPIENTS=\'[{"name":"DevOps","emailAddress":"devops@taktmate.com"}]\'', colors.blue);
      log('  node deploy-alerts.js generate', colors.blue);
      break;
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = {
  validateConfiguration,
  generateDeploymentScript,
  generateManualInstructions,
  generateAlertSummary,
  alertCategories
};
