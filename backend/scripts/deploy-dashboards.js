#!/usr/bin/env node

/**
 * Dashboard Deployment Script for TaktMate
 * 
 * This script deploys custom Application Insights dashboards to Azure
 * using Azure Resource Manager templates.
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
 * Dashboard configurations
 */
const dashboards = [
  {
    name: 'overview-dashboard',
    displayName: 'TaktMate - Application Overview',
    description: 'Main application overview with health, performance, and user metrics',
    template: 'overview-dashboard.json'
  },
  {
    name: 'error-monitoring-dashboard',
    displayName: 'TaktMate - Error Monitoring',
    description: 'Comprehensive error tracking and analysis dashboard',
    template: 'error-monitoring-dashboard.json'
  },
  {
    name: 'performance-dashboard',
    displayName: 'TaktMate - Performance Monitoring',
    description: 'Performance metrics, response times, and system resource monitoring',
    template: 'performance-dashboard.json'
  },
  {
    name: 'business-intelligence-dashboard',
    displayName: 'TaktMate - Business Intelligence',
    description: 'User engagement, business metrics, and analytics dashboard',
    template: 'business-intelligence-dashboard.json'
  }
];

/**
 * Configuration validation
 */
function validateConfiguration() {
  log('🔍 Validating deployment configuration...', colors.cyan);
  
  const requiredEnvVars = [
    'AZURE_SUBSCRIPTION_ID',
    'AZURE_RESOURCE_GROUP',
    'APPINSIGHTS_RESOURCE_ID'
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
  
  // Validate dashboard templates exist
  const dashboardsDir = path.join(__dirname, '..', 'dashboards');
  const missingTemplates = dashboards.filter(dashboard => {
    const templatePath = path.join(dashboardsDir, dashboard.template);
    return !fs.existsSync(templatePath);
  });
  
  if (missingTemplates.length > 0) {
    log(`❌ Missing dashboard templates: ${missingTemplates.map(d => d.template).join(', ')}`, colors.red);
    return false;
  }
  
  log('✅ Configuration validation passed', colors.green);
  return true;
}

/**
 * Generate Azure CLI deployment command
 */
function generateDeploymentCommand(dashboard, resourceGroup, subscriptionId, appInsightsResourceId) {
  const templatePath = path.join(__dirname, '..', 'dashboards', dashboard.template);
  const deploymentName = `taktmate-dashboard-${dashboard.name}-${Date.now()}`;
  
  return `az deployment group create \\
  --resource-group "${resourceGroup}" \\
  --subscription "${subscriptionId}" \\
  --name "${deploymentName}" \\
  --template-file "${templatePath}" \\
  --parameters \\
    dashboardName="${dashboard.displayName}" \\
    applicationInsightsResourceId="${appInsightsResourceId}"`;
}

/**
 * Generate PowerShell deployment command
 */
function generatePowerShellCommand(dashboard, resourceGroup, subscriptionId, appInsightsResourceId) {
  const templatePath = path.join(__dirname, '..', 'dashboards', dashboard.template);
  const deploymentName = `taktmate-dashboard-${dashboard.name}-${Date.now()}`;
  
  return `New-AzResourceGroupDeployment \\
  -ResourceGroupName "${resourceGroup}" \\
  -Name "${deploymentName}" \\
  -TemplateFile "${templatePath}" \\
  -dashboardName "${dashboard.displayName}" \\
  -applicationInsightsResourceId "${appInsightsResourceId}"`;
}

/**
 * Generate deployment script
 */
function generateDeploymentScript(format = 'bash') {
  const subscriptionId = process.env.AZURE_SUBSCRIPTION_ID;
  const resourceGroup = process.env.AZURE_RESOURCE_GROUP;
  const appInsightsResourceId = process.env.APPINSIGHTS_RESOURCE_ID;
  
  let script = '';
  
  if (format === 'bash') {
    script += '#!/bin/bash\n\n';
    script += '# TaktMate Dashboard Deployment Script\n';
    script += '# Generated automatically - do not edit manually\n\n';
    script += 'set -e\n\n';
    script += 'echo "🚀 Deploying TaktMate Application Insights Dashboards..."\n\n';
    
    dashboards.forEach((dashboard, index) => {
      script += `echo "📊 Deploying ${dashboard.displayName}..."\n`;
      script += generateDeploymentCommand(dashboard, resourceGroup, subscriptionId, appInsightsResourceId);
      script += '\n\n';
      
      if (index < dashboards.length - 1) {
        script += 'echo "⏳ Waiting 10 seconds before next deployment..."\n';
        script += 'sleep 10\n\n';
      }
    });
    
    script += 'echo "✅ All dashboards deployed successfully!"\n';
    script += 'echo "🌐 Access your dashboards in the Azure Portal under Dashboards"\n';
    
  } else if (format === 'powershell') {
    script += '# TaktMate Dashboard Deployment Script\n';
    script += '# Generated automatically - do not edit manually\n\n';
    script += 'Write-Host "🚀 Deploying TaktMate Application Insights Dashboards..." -ForegroundColor Cyan\n\n';
    
    dashboards.forEach((dashboard, index) => {
      script += `Write-Host "📊 Deploying ${dashboard.displayName}..." -ForegroundColor Yellow\n`;
      script += generatePowerShellCommand(dashboard, resourceGroup, subscriptionId, appInsightsResourceId);
      script += '\n\n';
      
      if (index < dashboards.length - 1) {
        script += 'Write-Host "⏳ Waiting 10 seconds before next deployment..." -ForegroundColor Blue\n';
        script += 'Start-Sleep -Seconds 10\n\n';
      }
    });
    
    script += 'Write-Host "✅ All dashboards deployed successfully!" -ForegroundColor Green\n';
    script += 'Write-Host "🌐 Access your dashboards in the Azure Portal under Dashboards" -ForegroundColor Cyan\n';
  }
  
  return script;
}

/**
 * Generate manual deployment instructions
 */
function generateManualInstructions() {
  const subscriptionId = process.env.AZURE_SUBSCRIPTION_ID;
  const resourceGroup = process.env.AZURE_RESOURCE_GROUP;
  const appInsightsResourceId = process.env.APPINSIGHTS_RESOURCE_ID;
  
  let instructions = '';
  instructions += '# TaktMate Dashboard Manual Deployment Instructions\n\n';
  instructions += '## Prerequisites\n\n';
  instructions += '1. Install Azure CLI: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli\n';
  instructions += '2. Login to Azure: `az login`\n';
  instructions += `3. Set subscription: \`az account set --subscription "${subscriptionId}"\`\n\n`;
  instructions += '## Deployment Commands\n\n';
  instructions += 'Run the following commands to deploy each dashboard:\n\n';
  
  dashboards.forEach(dashboard => {
    instructions += `### ${dashboard.displayName}\n\n`;
    instructions += `${dashboard.description}\n\n`;
    instructions += '```bash\n';
    instructions += generateDeploymentCommand(dashboard, resourceGroup, subscriptionId, appInsightsResourceId);
    instructions += '\n```\n\n';
  });
  
  instructions += '## Alternative: PowerShell Deployment\n\n';
  instructions += 'If you prefer PowerShell, use these commands:\n\n';
  
  dashboards.forEach(dashboard => {
    instructions += `### ${dashboard.displayName}\n\n`;
    instructions += '```powershell\n';
    instructions += generatePowerShellCommand(dashboard, resourceGroup, subscriptionId, appInsightsResourceId);
    instructions += '\n```\n\n';
  });
  
  instructions += '## Post-Deployment\n\n';
  instructions += '1. Navigate to the Azure Portal\n';
  instructions += '2. Go to Dashboards\n';
  instructions += '3. Find your deployed TaktMate dashboards\n';
  instructions += '4. Pin important charts to your main dashboard\n';
  instructions += '5. Set up alerts based on dashboard queries\n\n';
  instructions += '## Troubleshooting\n\n';
  instructions += '- Ensure your Application Insights resource ID is correct\n';
  instructions += '- Verify you have Contributor access to the resource group\n';
  instructions += '- Check that the dashboard templates are valid JSON\n';
  instructions += '- Review Azure CLI/PowerShell output for specific error messages\n';
  
  return instructions;
}

/**
 * Generate dashboard configuration summary
 */
function generateConfigurationSummary() {
  const subscriptionId = process.env.AZURE_SUBSCRIPTION_ID;
  const resourceGroup = process.env.AZURE_RESOURCE_GROUP;
  const appInsightsResourceId = process.env.APPINSIGHTS_RESOURCE_ID;
  
  let summary = '';
  summary += '# TaktMate Dashboard Configuration Summary\n\n';
  summary += '## Deployment Configuration\n\n';
  summary += `- **Subscription ID**: ${subscriptionId}\n`;
  summary += `- **Resource Group**: ${resourceGroup}\n`;
  summary += `- **Application Insights Resource ID**: ${appInsightsResourceId}\n\n`;
  summary += '## Available Dashboards\n\n';
  
  dashboards.forEach(dashboard => {
    summary += `### ${dashboard.displayName}\n\n`;
    summary += `- **Template**: ${dashboard.template}\n`;
    summary += `- **Description**: ${dashboard.description}\n`;
    summary += `- **Components**: Multiple charts and analytics views\n\n`;
  });
  
  summary += '## Dashboard Features\n\n';
  summary += '### Overview Dashboard\n';
  summary += '- Application health summary\n';
  summary += '- Request volume trends\n';
  summary += '- Response time percentiles\n';
  summary += '- Top endpoints analysis\n';
  summary += '- Error distribution\n';
  summary += '- User activity metrics\n';
  summary += '- CSV processing summary\n';
  summary += '- System performance trends\n\n';
  
  summary += '### Error Monitoring Dashboard\n';
  summary += '- Error rate trends\n';
  summary += '- Error distribution by category\n';
  summary += '- Top errors by frequency\n';
  summary += '- Authentication error analysis\n';
  summary += '- External service errors\n';
  summary += '- Error impact on users\n';
  summary += '- Critical errors and exceptions\n';
  summary += '- Validation errors by field\n';
  summary += '- Error resolution time analysis\n';
  summary += '- Error correlation analysis\n\n';
  
  summary += '### Performance Dashboard\n';
  summary += '- Response time trends\n';
  summary += '- Request throughput analysis\n';
  summary += '- Endpoint performance analysis\n';
  summary += '- System resource utilization\n';
  summary += '- Dependency performance\n';
  summary += '- CSV processing performance\n';
  summary += '- Chat performance analysis\n';
  summary += '- Memory pressure trends\n';
  summary += '- Performance alerts\n';
  summary += '- Top slow operations\n\n';
  
  summary += '### Business Intelligence Dashboard\n';
  summary += '- User activity overview\n';
  summary += '- CSV processing metrics\n';
  summary += '- Chat interaction analytics\n';
  summary += '- Daily user engagement trends\n';
  summary += '- User behavior patterns\n';
  summary += '- Top users by activity\n';
  summary += '- File processing efficiency\n';
  summary += '- Chat engagement quality\n';
  summary += '- Business value metrics\n';
  summary += '- User retention analysis\n\n';
  
  return summary;
}

/**
 * Create output directory
 */
function createOutputDirectory() {
  const outputDir = path.join(__dirname, '..', 'dashboard-deployment');
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
  
  log('🎯 TaktMate Dashboard Deployment Script', colors.bright);
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
      const bashPath = path.join(outputDir, 'deploy-dashboards.sh');
      fs.writeFileSync(bashPath, bashScript);
      fs.chmodSync(bashPath, '755');
      log(`✅ Generated bash deployment script: ${bashPath}`, colors.green);
      
      // Generate PowerShell deployment script
      const psScript = generateDeploymentScript('powershell');
      const psPath = path.join(outputDir, 'deploy-dashboards.ps1');
      fs.writeFileSync(psPath, psScript);
      log(`✅ Generated PowerShell deployment script: ${psPath}`, colors.green);
      
      // Generate manual instructions
      const instructions = generateManualInstructions();
      const instructionsPath = path.join(outputDir, 'DEPLOYMENT_INSTRUCTIONS.md');
      fs.writeFileSync(instructionsPath, instructions);
      log(`✅ Generated deployment instructions: ${instructionsPath}`, colors.green);
      
      // Generate configuration summary
      const summary = generateConfigurationSummary();
      const summaryPath = path.join(outputDir, 'DASHBOARD_SUMMARY.md');
      fs.writeFileSync(summaryPath, summary);
      log(`✅ Generated configuration summary: ${summaryPath}`, colors.green);
      
      log('\\n📋 Deployment files generated successfully!', colors.cyan);
      log('Next steps:', colors.yellow);
      log('1. Review the generated files in the dashboard-deployment directory', colors.blue);
      log('2. Run the deployment script or follow manual instructions', colors.blue);
      log('3. Access your dashboards in the Azure Portal', colors.blue);
      break;
      
    case 'list':
      log('\\n📊 Available TaktMate Dashboards:', colors.cyan);
      dashboards.forEach((dashboard, index) => {
        log(`\\n${index + 1}. ${dashboard.displayName}`, colors.yellow);
        log(`   Description: ${dashboard.description}`, colors.blue);
        log(`   Template: ${dashboard.template}`, colors.blue);
      });
      break;
      
    case 'help':
    default:
      log('\\nUsage: node deploy-dashboards.js [command]', colors.yellow);
      log('\\nCommands:', colors.yellow);
      log('  validate  - Validate deployment configuration', colors.blue);
      log('  generate  - Generate deployment scripts and instructions', colors.blue);
      log('  list      - List available dashboards', colors.blue);
      log('  help      - Display this help', colors.blue);
      log('\\nRequired Environment Variables:', colors.yellow);
      log('  AZURE_SUBSCRIPTION_ID       - Your Azure subscription ID', colors.blue);
      log('  AZURE_RESOURCE_GROUP         - Target resource group name', colors.blue);
      log('  APPINSIGHTS_RESOURCE_ID      - Application Insights resource ID', colors.blue);
      log('\\nExample:', colors.yellow);
      log('  export AZURE_SUBSCRIPTION_ID="12345678-1234-1234-1234-123456789012"', colors.blue);
      log('  export AZURE_RESOURCE_GROUP="taktmate-resources"', colors.blue);
      log('  export APPINSIGHTS_RESOURCE_ID="/subscriptions/.../microsoft.insights/components/taktmate-insights"', colors.blue);
      log('  node deploy-dashboards.js generate', colors.blue);
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
  generateConfigurationSummary,
  dashboards
};
