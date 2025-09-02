# Azure SQL Database Setup Guide

This guide walks you through setting up Azure SQL Database for TaktMate's user authentication and session management.

## Prerequisites

- Azure subscription with SQL Database access
- Azure CLI installed (optional but recommended)
- Access to Azure Portal

## Step 1: Create Azure SQL Database

### Option A: Using Azure Portal

1. **Sign in to Azure Portal**
   - Navigate to [https://portal.azure.com](https://portal.azure.com)
   - Sign in with your Azure credentials

2. **Create SQL Database**
   - Click "Create a resource" → "Databases" → "SQL Database"
   - Fill in the following details:
     - **Subscription**: Your Azure subscription
     - **Resource Group**: Create new or use existing (e.g., `taktmate-resources`)
     - **Database Name**: `TaktMateDB`
     - **Server**: Click "Create new" and configure:
       - **Server Name**: `taktmate-server` (must be globally unique)
       - **Server Admin Login**: `taktmate_admin`
       - **Password**: Create a strong password (save this securely!)
       - **Location**: Choose region closest to your users
       - **Authentication**: Select "Use both SQL and Microsoft Entra authentication"

3. **Configure Database Settings**
   - **Compute + Storage**: Select "Basic" or "Standard" tier for development
   - **Backup Storage Redundancy**: Choose "Locally-redundant" for cost savings
   - **Networking**: 
     - Select "Public endpoint"
     - Enable "Allow Azure services and resources to access this server"
     - Add your current IP to firewall rules

4. **Review and Create**
   - Review all settings
   - Click "Create" and wait for deployment to complete

### Option B: Using Azure CLI

```bash
# Create resource group
az group create --name taktmate-resources --location eastus

# Create SQL server
az sql server create \
  --name taktmate-server \
  --resource-group taktmate-resources \
  --location eastus \
  --admin-user taktmate_admin \
  --admin-password "YourSecurePassword123!"

# Create SQL database
az sql db create \
  --resource-group taktmate-resources \
  --server taktmate-server \
  --name TaktMateDB \
  --service-objective Basic

# Configure firewall (replace with your IP)
az sql server firewall-rule create \
  --resource-group taktmate-resources \
  --server taktmate-server \
  --name AllowMyIP \
  --start-ip-address YOUR_IP_ADDRESS \
  --end-ip-address YOUR_IP_ADDRESS
```

## Step 2: Configure Connection String

1. **Get Connection Details**
   - In Azure Portal, navigate to your SQL Database
   - Click "Connection strings" in the left menu
   - Copy the ADO.NET connection string

2. **Update Environment Variables**
   - Copy `backend/env.example` to `backend/.env`
   - Update the following variables:
     ```env
     AZURE_SQL_SERVER=taktmate-server.database.windows.net
     AZURE_SQL_DATABASE=TaktMateDB
     AZURE_SQL_USER=taktmate_admin
     AZURE_SQL_PASSWORD=YourSecurePassword123!
     ```

## Step 3: Install Dependencies

```bash
cd backend
npm install mssql
```

## Step 4: Test Connection

1. **Run Connection Test**
   ```bash
   cd backend
   node -e "
   const { initializeDatabase, testConnection, closeDatabase } = require('./config/database');
   async function test() {
     try {
       await initializeDatabase();
       await testConnection();
       await closeDatabase();
       console.log('✅ Database setup successful!');
     } catch (error) {
       console.error('❌ Database setup failed:', error.message);
     }
   }
   test();
   "
   ```

## Connection String Format

The connection string format for Azure SQL Database:

```
Server=tcp:your-server.database.windows.net,1433;Initial Catalog=TaktMateDB;Persist Security Info=False;User ID=your-username;Password={your_password};MultipleActiveResultSets=False;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;
```

## Security Best Practices

1. **Firewall Configuration**
   - Only allow necessary IP addresses
   - Use Azure service access sparingly
   - Consider using Virtual Network rules for production

2. **Authentication**
   - Use strong passwords
   - Consider Azure Active Directory authentication
   - Enable Multi-Factor Authentication for admin accounts

3. **Monitoring**
   - Enable Azure SQL Database auditing
   - Set up alerts for failed login attempts
   - Monitor database performance metrics

## Troubleshooting

### Common Connection Issues

1. **Firewall Blocking Connection**
   - Ensure your IP is added to server firewall rules
   - Check if Azure services access is enabled

2. **Invalid Credentials**
   - Verify username and password are correct
   - Check if user has proper database permissions

3. **SSL/TLS Issues**
   - Ensure `encrypt: true` in connection config
   - Verify `trustServerCertificate: false` for production

### Connection Test Errors

```bash
# Test specific connection parameters
node -e "
const sql = require('mssql');
const config = {
  user: 'taktmate_admin',
  password: 'YourPassword',
  server: 'taktmate-server.database.windows.net',
  database: 'TaktMateDB',
  options: { encrypt: true }
};
sql.connect(config).then(() => {
  console.log('✅ Connected successfully');
  sql.close();
}).catch(err => {
  console.error('❌ Connection failed:', err.message);
});
"
```

## Next Steps

After successful database setup:

1. ✅ Task 1.1 Complete: Azure SQL Database instance created
2. 🔄 Task 1.2: Design and implement database schema
3. 🔄 Task 1.3: Create User model with validation
4. 🔄 Task 1.4: Create Session model

## Resources

- [Azure SQL Database Documentation](https://docs.microsoft.com/en-us/azure/azure-sql/database/)
- [Node.js mssql Package Documentation](https://www.npmjs.com/package/mssql)
- [Azure SQL Database Connection Troubleshooting](https://docs.microsoft.com/en-us/azure/azure-sql/database/troubleshoot-common-connectivity-issues)
