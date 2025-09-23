# TaktMate - Enterprise CSV Analytics Platform

A comprehensive, cloud-hosted web application that allows users to upload CSV files and chat with their data using Azure OpenAI's GPT-4.1. Features enterprise-grade security with Entra ID authentication, Azure Blob Storage for persistent file management, and an advanced evaluation framework for testing AI performance across multiple domains.

## Features

### Core Application
- 📁 **CSV Upload**: Upload CSV files up to 5MB with Azure Blob Storage persistence
- 💬 **AI Chat**: Ask questions about your data in natural language
- 🧠 **Smart Analysis**: GPT-4.1 analyzes and responds using only your CSV data
- 🎨 **Modern UI**: Clean, responsive interface built with React and TailwindCSS
- ⚡ **Real-time**: Instant responses and file processing
- 🔒 **Enterprise Security**: Entra ID authentication with user isolation
- ☁️ **Cloud-Native**: Fully hosted on Azure with auto-scaling
- 🔍 **Debug Mode**: Environment-based prompt debugging for development

### Advanced Evaluation System
- 🧪 **Multi-Domain Testing**: 5 diverse datasets (Sports, Astronomy, HR, Inventory, Transportation)
- 📊 **Comprehensive Scoring**: Penalty-based evaluation with invalid value detection
- 🎯 **40+ Test Cases**: Structured and semantic query testing
- 📈 **Performance Analytics**: Detailed scoring, bonus points, and failure analysis
- 🔄 **Automated Evaluation**: Run full test suites with single commands

## Tech Stack

### Cloud Infrastructure (Azure)
- **Azure Static Web Apps**: Frontend hosting and deployment
- **Azure App Service**: Backend API hosting with auto-scaling
- **Azure Blob Storage**: Persistent file storage with user isolation
- **Azure OpenAI Service**: GPT-4.1 for natural language processing
- **Microsoft Entra ID (External ID)**: Authentication and user management
- **Azure Key Vault**: Secure secrets management
- **Azure Application Insights**: Monitoring and telemetry

### Frontend
- React 18
- TailwindCSS
- Axios for API calls
- Azure Static Web Apps authentication integration

### Backend
- Node.js with Express.js
- Azure OpenAI GPT-4.1 integration
- Azure Blob Storage SDK (@azure/storage-blob)
- Azure Identity SDK (@azure/identity) for Managed Identity
- csv-parser for CSV processing
- Environment-based debug logging
- CORS enabled with Azure domain support

### Evaluation Framework
- Advanced similarity matching (Jaro-Winkler distance)
- Penalty-based scoring system
- Multi-domain test datasets
- Comprehensive reporting (JSON, CSV, TXT)
- Automated performance analysis

## Azure Resources

### Current Production Resources
The application is deployed using the following Azure resources:

#### Frontend (Static Web App)
- **Resource Name**: `orange-flower-0b350780f`
- **Type**: Azure Static Web Apps
- **URL**: `https://orange-flower-0b350780f.1.azurestaticapps.net`
- **Custom Domain**: `https://app.taktconnect.com` (configured)
- **Authentication**: Integrated with Entra External ID

#### Backend (App Service)
- **Resource Name**: `taktmate-backend-api`
- **Type**: Azure App Service (Linux, Node.js)
- **URL**: `https://taktmate-backend-api-csheb3aeg8f5bcbv.eastus-01.azurewebsites.net`
- **Custom Domain**: `https://api.taktconnect.com` (configured)
- **Authentication**: Managed Identity enabled

#### Storage Account
- **Resource Name**: `taktmateblob`
- **Type**: Azure Storage Account (General Purpose v2)
- **Access**: Private with SAS token authentication
- **Features**: User-isolated containers, lifecycle management

#### OpenAI Service
- **Resource Name**: `taktmate`
- **Type**: Azure OpenAI Service
- **Endpoint**: `https://taktmate.openai.azure.com`
- **Deployment**: `gpt-4.1` (API version: 2025-01-01-preview)

#### Authentication (Entra ID)
- **Tenant**: `taktmate.onmicrosoft.com`
- **Type**: Microsoft Entra External ID
- **OIDC Endpoint**: `https://taktmate.ciamlogin.com/taktmate.onmicrosoft.com/v2.0/.well-known/openid-configuration`
- **App ID**: `3f1869f7-716b-4885-ac8a-86e78515f3a4`

#### Key Vault (Optional)
- **Resource Name**: `TaktMate-KeyVault`
- **Type**: Azure Key Vault
- **Purpose**: Secure storage of API keys and secrets

#### Resource Group
- **Name**: `taktmate`
- **Region**: East US

## Prerequisites

- Node.js 16+ and npm
- Access to Azure resources (for deployment)
- Azure OpenAI API key and endpoint (for local development)

## Quick Start

### 1. Access Production Application

**Live Application**: https://app.taktconnect.com

The application is fully deployed and ready to use. No local setup required for end users.

### 2. Local Development Setup (Optional)

For developers who want to run locally:

```bash
# Navigate to the project directory
cd taktmate

# Install all dependencies (root, backend, frontend, and tests)
npm run install-all

# Start both backend and frontend
npm run dev
```

The local application will start:
- Backend: http://localhost:5000
- Frontend: http://localhost:3000 (opens in browser)

**Note**: Local development requires Azure OpenAI API key and storage account access.

### 3. Run Evaluations (Optional)

```bash
# Run all evaluations
npm run eval:all

# Run specific dataset evaluation
npm run eval:sports_statistics
npm run eval:astronomy_events
npm run eval:employee_payroll
npm run eval:product_inventory
npm run eval:transportation_schedules
```

## Configuration

### Production Deployment

The application is fully deployed on Azure with the following configuration:

#### Azure Static Web Apps (Frontend)
- **Authentication**: Configured via `staticwebapp.config.json`
- **Routes**: Protected routes require authentication
- **Custom Domain**: Configured with SSL certificates
- **Build**: Automatic deployment from Git repository

#### Azure App Service (Backend)
- **Environment Variables**: Configured in Azure Portal
- **Managed Identity**: Enabled for secure Azure service access
- **CORS**: Configured for frontend domains
- **SSL**: Automatic HTTPS with custom domain certificates

### Local Development Setup

For local development, you'll need to configure the following:

#### Backend Configuration (`backend/config.js`)
```javascript
module.exports = {
  AZURE_OPENAI_API_KEY: process.env.OPENAI_API_KEY || 'your-api-key',
  AZURE_OPENAI_ENDPOINT: 'https://taktmate.openai.azure.com/openai/deployments/gpt-4.1',
  AZURE_OPENAI_API_VERSION: '2025-01-01-preview',
  AZURE_OPENAI_DEPLOYMENT_NAME: 'gpt-4.1'
};
```

#### Environment Variables for Local Development
Create `backend/.env` for local development:
```env
OPENAI_API_KEY=your-azure-openai-api-key
STORAGE_ACCOUNT_NAME=taktmateblob
DEBUG_PROMPTS=true
PORT=5000
NODE_ENV=development
```

### Azure Production Environment Variables

The following variables are configured in Azure App Service:

#### Required Variables
- `OPENAI_API_KEY`: Azure OpenAI API key (from Key Vault)
- `STORAGE_ACCOUNT_NAME`: `taktmateblob`
- `NODE_ENV`: `production`
- `CORS_ORIGIN`: Frontend domain URLs

#### Authentication Variables
- `ENTRA_EXTERNAL_ID_CLIENT_ID`: Entra ID application client ID
- `ENTRA_EXTERNAL_ID_CLIENT_SECRET`: Entra ID application secret

#### Optional Variables
- `DEBUG_PROMPTS`: `false` (set to `true` for debugging)
- `APPLICATION_INSIGHTS_CONNECTION_STRING`: For telemetry

## Debug Mode

Enable detailed prompt debugging to see exactly what's sent to GPT-4.1:

```bash
# Start with debug enabled
DEBUG_PROMPTS=true npm run backend
```

This will show:
- Complete system prompts with CSV data
- User questions
- GPT responses
- Timing information

## Usage

### Production Web Application
Access the live application at: **https://app.taktconnect.com**

1. **Login**: Authenticate using your Microsoft account via Entra ID
2. **Upload CSV**: Click "Select CSV File" and choose a CSV file (up to 5MB)
3. **Secure Storage**: Files are automatically stored in your private Azure Blob Storage container
4. **Wait for Processing**: File is uploaded and parsed automatically
5. **Start Chatting**: Ask questions about your data using natural language
6. **Get Insights**: AI responds using only your CSV data with GPT-4.1
7. **File Management**: View, download, or delete your uploaded files

### Local Development
For local testing and development:

### Evaluation System
1. **Run Tests**: Use `npm run eval:all` or specific dataset commands
2. **Review Results**: Check generated `scorecard.json`, `scorecard.csv`, and `error_analysis.txt`
3. **Analyze Performance**: Review scoring, bonus points, and penalty information
4. **Debug Issues**: Use debug mode to see exact prompts for failed tests

## Example Questions

### General Data Exploration
- "What are the column names in this data?"
- "How many rows are there?"
- "Show me the first 5 records"

### Statistical Analysis
- "What's the average value in the salary column?"
- "Who has the highest score?"
- "Show me all records where status is 'active'"

### Filtering and Comparison
- "Find employees earning more than $80,000"
- "Which products are out of stock?"
- "Show events happening in March 2024"

## API Endpoints

### POST /upload
Upload a CSV file for processing.

**Request:**
- Content-Type: multipart/form-data
- Body: CSV file in 'csvFile' field

**Response:**
```json
{
  "success": true,
  "fileId": "unique_file_id",
  "filename": "data.csv",
  "rowCount": 100,
  "headers": ["col1", "col2", "col3"],
  "data": [...]
}
```

### POST /chat
Send a chat message about uploaded CSV data.

**Request:**
```json
{
  "fileId": "unique_file_id",
  "message": "What's the average salary?"
}
```

**Response:**
```json
{
  "success": true,
  "reply": "The average salary is $75,000",
  "fileId": "unique_file_id",
  "filename": "data.csv"
}
```

### GET /health
Health check endpoint.

**Response:**
```json
{
  "status": "OK",
  "message": "TaktMate Backend is running"
}
```

## Evaluation Framework

### Test Datasets

The framework includes 5 comprehensive test datasets:

1. **Sports Statistics** (14 players): Performance metrics, teams, positions
2. **Astronomy Events** (12 events): Celestial events, magnitudes, visibility
3. **Employee Payroll** (15 employees): Salaries, departments, performance
4. **Product Inventory** (12 products): Prices, stock, categories, suppliers
5. **Transportation Schedules** (12 routes): Fares, schedules, operators

### Scoring System

- **Base Score**: Correct matches / Expected matches
- **Penalty System**: Invalid inclusions reduce score
- **Bonus Points**: Additional criteria can award +0.5 points
- **Pass Threshold**: 100% accuracy required for list questions

### Invalid Values Feature

Questions now include `invalid_values` arrays to penalize incorrect inclusions:

```json
{
  "question": "Which players participated in 80+ games?",
  "expected": {
    "answer_type": "list_of_strings",
    "valid_values": ["Michael Jordan", "Kareem Abdul-Jabbar"],
    "invalid_values": ["Larry Bird", "Magic Johnson"]
  }
}
```

### Running Evaluations

```bash
# All datasets
npm run eval:all

# Individual datasets
npm run eval:sports_statistics
npm run eval:astronomy_events
npm run eval:employee_payroll
npm run eval:product_inventory
npm run eval:transportation_schedules
```

### Evaluation Output

- **Console**: Real-time progress with scoring and penalties
- **JSON Results**: Detailed results in `tests/results/`
- **Scorecard**: Summary statistics in `tests/scorecard.json`
- **CSV Export**: Analysis-friendly format in `tests/scorecard.csv`

## File Structure

```
taktmate/
├── backend/                    # Backend server (Azure App Service)
│   ├── index.js               # Main server with Azure integrations
│   ├── config.js              # Azure OpenAI configuration
│   ├── processCsv.js          # CSV parsing utilities
│   ├── middleware/
│   │   └── auth.js            # Authentication middleware
│   ├── routes/
│   │   └── files.js           # File management API routes
│   ├── services/
│   │   └── storage.js         # Azure Blob Storage service
│   ├── ENVIRONMENT_VARIABLES.md # Azure deployment guide
│   └── package.json
├── frontend/                   # React frontend (Azure Static Web Apps)
│   ├── src/
│   │   ├── App.jsx            # Main application with authentication
│   │   ├── components/
│   │   │   ├── Card.jsx       # UI card component
│   │   │   ├── ChatBox.jsx    # Chat interface
│   │   │   ├── DataTable.jsx  # Data display component
│   │   │   ├── Logo.jsx       # TaktMate logo component
│   │   │   ├── LogoutButton.jsx # User logout
│   │   │   ├── SourcesPanel.jsx # File upload & management
│   │   │   └── UserProfile.jsx # User profile display
│   │   ├── contexts/
│   │   │   └── AuthContext.js # Authentication state management
│   │   ├── hooks/
│   │   │   └── useAuth.js     # Authentication hook
│   │   ├── index.js
│   │   └── index.css          # TailwindCSS styles
│   ├── public/
│   │   ├── index.html
│   │   ├── favicon.png
│   │   ├── logo-solo.png
│   │   └── logo-takt.png
│   ├── staticwebapp.config.json # Azure Static Web Apps config
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── package.json
├── tests/                      # Evaluation framework
│   ├── datasets/              # Test CSV files
│   │   ├── sports_statistics.csv
│   │   ├── astronomy_events.csv
│   │   ├── employee_payroll.csv
│   │   ├── product_inventory.csv
│   │   ├── transportation_schedules.csv
│   │   └── large_dataset.csv
│   ├── qa_pairs/              # Test questions with expected answers
│   │   ├── sports_statistics_qa.json
│   │   ├── astronomy_events_qa.json
│   │   ├── employee_payroll_qa.json
│   │   ├── product_inventory_qa.json
│   │   ├── transportation_schedules_qa.json
│   │   └── failed_questions.txt
│   ├── blob-storage/          # Azure Blob Storage tests
│   │   ├── integration/
│   │   ├── unit/
│   │   ├── fixtures/
│   │   ├── scripts/
│   │   └── README.md
│   ├── eval-framework.js      # Core evaluation logic
│   ├── eval-runner.js         # Test execution
│   ├── test_runner.js         # Legacy test runner
│   ├── results/               # Test results directory
│   └── README.md              # Testing documentation
├── tasks/                      # Implementation task lists
│   ├── 00_prompts/            # Task generation prompts
│   ├── 01_online_hosting/     # Azure deployment tasks
│   ├── 02_auth/               # Authentication implementation
│   ├── 03_file_upload/        # File upload enhancements
│   ├── 04_blob_storage/       # Azure Blob Storage integration
│   ├── 05_interface_update/   # UI/UX improvements
│   └── 06_custom_domain/      # Custom domain setup
├── prompts/                    # Example prompts and templates
│   ├── astronomy_events_qa.txt
│   ├── employee_payroll_qa.txt
│   ├── env_setup.txt
│   ├── first_prompt.txt
│   └── [additional prompt files]
├── brand-guideline/           # Brand assets and guidelines
│   ├── brand-guideline.md
│   ├── logo_solo_transparent.png
│   ├── logo_takt_transparent.png
│   └── [additional brand assets]
├── AZURE_SETUP.md             # Azure OpenAI setup guide
├── PRIVACY_COMPLIANCE.md      # Privacy and compliance documentation
├── TESTING_GUIDE.md           # Testing procedures
├── README.md                  # Main documentation (this file)
├── sample-data.csv            # Sample dataset for testing
└── package.json               # Root configuration and scripts
```

## Development Scripts

```bash
# Development
npm run dev                    # Start full stack
npm run backend               # Backend only
npm run frontend              # Frontend only

# Installation
npm run install-all           # Install all dependencies

# Evaluation
npm run eval:all              # Run all evaluations
npm run eval:setup            # Setup evaluation environment

# Build & Deploy
npm run build                 # Build frontend
npm run start                 # Production backend
```

## Advanced Features

### Debug Logging

Enable detailed logging to see prompts sent to GPT-4.1:

```bash
DEBUG_PROMPTS=true npm run backend
```

Output includes:
- System prompts with CSV data
- User questions
- GPT responses
- Performance metrics

### Penalty System

The evaluation framework now penalizes incorrect inclusions:

- **Before**: Including "Larry Bird" (79 games) in "80+ games" query = 1.0 score
- **After**: Same inclusion = 0.75 score (penalized for invalid item)

### Bonus Scoring

Questions can award bonus points for additional criteria:

```json
{
  "bonus": {
    "answer_type": "number",
    "valid_values": [82, "82"]
  }
}
```

## Limitations

- **File Size**: Maximum 5MB per CSV file (configurable in Azure)
- **File Limit**: 5 files per user for analysis (storage is unlimited)
- **Context Window**: Large files may exceed GPT-4.1 limits (~128K tokens)
- **Regional Availability**: Hosted in East US region
- **Authentication**: Requires Microsoft account for Entra ID authentication

## Troubleshooting

### Backend Issues

**Port Already in Use:**
```bash
# Kill existing processes
pkill -f "node.*index.js"

# Restart
npm run backend
```

**OpenAI API Errors:**
- Check Azure OpenAI API key and endpoint
- Verify GPT-4.1 deployment availability
- Check account credits and rate limits

### Evaluation Issues

**Backend Not Running:**
```bash
cd backend
npm run dev
```

**Evaluation Failures:**
- Ensure backend is on port 3001
- Check CSV file formats
- Review debug logs with `DEBUG_PROMPTS=true`

### Debug Mode Not Showing

If debug output isn't visible:
1. Run backend separately: `DEBUG_PROMPTS=true npm run backend`
2. Or create `backend/.env` with `DEBUG_PROMPTS=true`
3. Verify startup message shows "Debug prompts: ENABLED"

## Performance Benchmarks

### Target Metrics
- **Overall Accuracy**: >85%
- **Structured Queries**: >90%
- **Semantic Queries**: >80%
- **Penalty Precision**: Correctly identify invalid inclusions

### Current Performance
The evaluation framework provides detailed metrics including:
- Pass/fail rates by query type
- Average scores with penalties
- Bonus point distribution
- Common failure patterns

## Contributing

This application is production-ready with enterprise features. Current capabilities include:

### ✅ Production Features Implemented
- **Azure Blob Storage**: Persistent, secure file storage
- **User Authentication**: Entra ID integration with session management
- **Multi-file Support**: Users can upload and manage multiple CSV files
- **Security**: Managed identity, SAS tokens, user isolation
- **Scalability**: Auto-scaling Azure App Service and Static Web Apps
- **Monitoring**: Application Insights integration

### 🚀 Future Enhancement Opportunities
- **Advanced Analytics**: Interactive data visualizations (Chart.js, D3.js)
- **Real-time Collaboration**: Multi-user shared datasets
- **API Rate Limiting**: Enhanced throttling and quota management
- **Multi-region Deployment**: Global distribution for lower latency
- **Advanced AI Features**: Data insights, trend analysis, predictive modeling
- **Export Capabilities**: PDF reports, Excel exports
- **Database Integration**: Azure SQL for metadata and user preferences

## License

MIT License - See LICENSE file for details.

## Azure Architecture

### Production Architecture
The application follows a secure, scalable cloud-native architecture:

```
Internet → Azure Front Door → Static Web App (Frontend)
                                    ↓ (API calls)
                           Azure App Service (Backend)
                                    ↓ (Managed Identity)
                    ┌─── Azure OpenAI (GPT-4.1)
                    │
                    └─── Azure Blob Storage (User Files)
                    │
                    └─── Entra ID (Authentication)
```

### Key Architecture Features
- **Zero-Trust Security**: All communication encrypted, managed identities used
- **User Isolation**: Each user gets a private blob storage container
- **Auto-Scaling**: Both frontend and backend scale automatically
- **High Availability**: Multi-region deployment capability
- **Monitoring**: Application Insights for performance and error tracking

### Azure OpenAI Integration
The application uses Azure OpenAI GPT-4.1 with:
- **Endpoint**: `https://taktmate.openai.azure.com`
- **API Version**: `2025-01-01-preview`
- **Model**: `gpt-4.1` deployment
- **Temperature**: 0.1 for consistent responses
- **Max Tokens**: 500 for concise answers
- **Authentication**: API key via Azure Key Vault
- **Error Handling**: Comprehensive retry logic and fallback responses

### Security Features
- **Managed Identity**: Backend authenticates to Azure services without storing keys
- **SAS Tokens**: Time-limited, permission-specific access to blob storage
- **HTTPS Only**: All communication encrypted in transit
- **Private Storage**: User data isolated in private containers
- **Key Vault**: Secrets managed securely outside of application code

For detailed Azure setup instructions, see `AZURE_SETUP.md` and `backend/ENVIRONMENT_VARIABLES.md`.