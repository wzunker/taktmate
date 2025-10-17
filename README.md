# TaktMate - Enterprise Document Analytics Platform

A comprehensive, cloud-hosted web application that allows users to upload CSV, PDF, DOCX, XLSX, and TXT files and chat with their data using Azure OpenAI (GPT-5-mini with tool calling, GPT-4.1 for stable operations). Features enterprise-grade security with Entra ID authentication, Azure Blob Storage for persistent file management, and intelligent data analysis tools.

## Features

### Core Application
- 📁 **Multi-File Upload**: Upload CSV, PDF, DOCX, XLSX, and TXT files up to 100MB with Azure Blob Storage persistence
- 💬 **AI Chat**: Ask questions about your data in natural language with conversation memory
- 🧠 **Smart Analysis**: AI analyzes and responds using only your document data
- 🔧 **Tool Calling**: GPT-5-mini uses specialized tools for data filtering, visualization, and statistical analysis
- 📊 **Data Visualization**: Create charts and plots directly from your data
- 🔢 **Statistical Analysis**: Calculate averages, medians, sums, and other statistics automatically
- 💾 **Stateful Conversations**: Persistent chat history with context across sessions
- 📚 **Conversation Management**: Create, rename, delete, and export chat histories
- 🔄 **Auto-Archiving**: Intelligent conversation archiving with AI summarization
- 🎨 **Modern UI**: Clean, responsive interface built with React and TailwindCSS
- ⚡ **Real-time**: Instant responses and file processing
- 🔒 **Enterprise Security**: Entra ID authentication with user isolation
- ☁️ **Cloud-Native**: Fully hosted on Azure with auto-scaling

### AI-Powered Data Tools
- 🔢 **Numeric Filtering**: Filter data by numeric comparisons (>, <, >=, <=, =, !=, BETWEEN)
  - Example: "Show employees earning more than $90,000"
- 📊 **Data Visualization**: Create bar charts and XY plots from your data
  - Example: "Plot employee salaries as a bar chart"
- 📈 **Statistical Analysis**: Calculate average, median, sum, min, max, count
  - Example: "What's the average salary?"
- 🚀 **Backend Processing**: All data processing happens server-side with file caching for performance
- 🔒 **User Isolation**: Tools automatically enforce user-specific data access

### Stateful Conversation Memory
- 🗨️ **Persistent Chat History**: All conversations automatically saved with context
- 📝 **Conversation Management**: Create, rename, delete, and organize chat sessions
- 🏷️ **Auto-Generated Titles**: AI creates meaningful conversation titles
- 📊 **Export Capabilities**: Export conversations as JSON or CSV formats
- 🗂️ **File Association**: Conversations linked to specific files for context
- ⚡ **Smart Loading**: Recent messages loaded for conversation context
- 🔄 **Hybrid Storage**: Active conversations in Cosmos DB, archived in Blob Storage
- 🤖 **AI Summarization**: Long conversations automatically summarized

## Tech Stack

### Cloud Infrastructure (Azure)
- **Azure Static Web Apps**: Frontend hosting and deployment
- **Azure App Service**: Backend API hosting with auto-scaling
- **Azure Blob Storage**: Persistent file storage with user isolation
- **Azure Cosmos DB**: NoSQL database for conversation storage and management
- **Azure OpenAI Service**: GPT-5-mini (tool calling) and GPT-4.1 (stable operations)
- **Microsoft Entra ID (External ID)**: Authentication and user management
- **Azure Key Vault**: Secure secrets management
- **Azure Application Insights**: Monitoring and telemetry

### Frontend
- React 18
- TailwindCSS with custom configuration
- Recharts for data visualization
- Axios for API calls
- Azure Static Web Apps authentication integration

### Backend
- Node.js with Express.js
- Azure OpenAI dual-model integration (GPT-5-mini + GPT-4.1)
- **Tool Calling System**:
  - `filter_numeric`: Numeric data filtering
  - `create_plot`: Chart and plot generation
  - `compute_avg_count_sum_min_max_median`: Statistical calculations
  - Backend-side data loading with caching
- Azure Blob Storage SDK (@azure/storage-blob)
- Azure Cosmos DB SDK (@azure/cosmos)
- Azure Identity SDK (@azure/identity) for Managed Identity
- File processors: csv-parser, xlsx, pdf-parse, mammoth (DOCX)
- Conversation management and archiving services
- AI-powered conversation summarization

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
- **Deployments**: 
  - `gpt-5-mini`: Tool calling, data analysis (API version: 2025-01-01-preview)
  - `gpt-4.1`: Title generation, summarization, suggestions (API version: 2025-01-01-preview)

#### Cosmos DB
- **Resource Name**: `taktmate-conversations-db`
- **Type**: Azure Cosmos DB (NoSQL API)
- **Database**: `taktmate-conversations`
- **Container**: `conversations`
- **Partition Key**: `/userId`
- **Features**: User isolation, TTL cleanup, automatic indexing

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
  AZURE_OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  AZURE_OPENAI_ENDPOINT: 'https://taktmate.openai.azure.com',
  AZURE_OPENAI_API_VERSION: '2025-01-01-preview',
  AZURE_OPENAI_DEPLOYMENT_GPT4: 'gpt-4.1',
  AZURE_OPENAI_DEPLOYMENT_GPT5_MINI: 'gpt-5-mini',
  ACTIVE_MODEL: 'gpt-5-mini', // 'gpt-5-mini' for tool calling or 'gpt-4.1' for standard chat
  MAX_FILE_SIZE: 100 * 1024 * 1024 // 100MB
};
```

#### Environment Variables for Local Development
Create `backend/.env` for local development:
```env
OPENAI_API_KEY=your-azure-openai-api-key
STORAGE_ACCOUNT_NAME=taktmateblob
ACTIVE_MODEL=gpt-5-mini
PORT=3001
NODE_ENV=development
LOCAL_DEVELOPMENT=true
```

### Azure Production Environment Variables

The following variables are configured in Azure App Service:

#### Required Variables
- `OPENAI_API_KEY`: Azure OpenAI API key (from Key Vault)
- `STORAGE_ACCOUNT_NAME`: `taktmateblob`
- `ACTIVE_MODEL`: `gpt-5-mini` or `gpt-4.1` (set to `gpt-5-mini` for tool calling)
- `AZURE_OPENAI_DEPLOYMENT_GPT4`: Deployment name for GPT-4.1
- `AZURE_OPENAI_DEPLOYMENT_GPT5_MINI`: Deployment name for GPT-5-mini
- `NODE_ENV`: `production`
- `CORS_ORIGIN`: Frontend domain URLs

#### Authentication Variables
- `ENTRA_EXTERNAL_ID_CLIENT_ID`: Entra ID application client ID
- `ENTRA_EXTERNAL_ID_CLIENT_SECRET`: Entra ID application secret

#### Optional Variables
- `APPLICATION_INSIGHTS_CONNECTION_STRING`: For telemetry

## Usage

### Production Web Application
Access the live application at: **https://app.taktconnect.com**

1. **Login**: Authenticate using your Microsoft account via Entra ID
2. **Upload Files**: Click "Add" and choose CSV, PDF, DOCX, XLSX, or TXT files (up to 5MB each)
3. **Secure Storage**: Files are automatically stored in your private Azure Blob Storage container
4. **Wait for Processing**: Files are uploaded and parsed automatically based on type
5. **Start Chatting**: Ask questions about your data using natural language
6. **Get Insights**: AI responds using only your document data with GPT-4.1
7. **Conversation Memory**: All chats are automatically saved with persistent history
8. **Manage Conversations**: Create new chats, rename, delete, or export conversation history
9. **File Association**: Each conversation is linked to its specific file for context
10. **File Management**: View, download, or delete your uploaded files

### Local Development
For local testing and development:

### Evaluation System
1. **Run Tests**: Use `npm run eval:all` or specific dataset commands
2. **Review Results**: Check generated `scorecard.json`, `scorecard.csv`, and `error_analysis.txt`
3. **Analyze Performance**: Review scoring, bonus points, and penalty information
4. **Debug Issues**: Use debug mode to see exact prompts for failed tests

## Example Questions

### General Data Exploration (All File Types)
- "What are the main topics covered in this document?"
- "How much data is available?"
- "Summarize the key information"

### CSV/XLSX Files - Data Analysis with AI Tools
**Filtering Data:**
- "Show me employees earning more than $90,000"
- "Which products have quantity less than 20?"
- "Find events between magnitude 1.0 and 3.0"

**Statistical Analysis:**
- "What's the average salary?"
- "Calculate the median, min, and max prices"
- "What's the total revenue?"

**Data Visualization:**
- "Plot employee salaries as a bar chart"
- "Create an XY plot of performance vs salary"
- "Show me a bar chart of product quantities"

### PDF Files - Document Analysis
- "What is the main conclusion of this document?"
- "Extract all the key dates mentioned"
- "What are the main recommendations?"
- "Find all mentions of specific terms or concepts"

### DOCX Files - Text Analysis
- "Summarize the document in bullet points"
- "What are the action items mentioned?"
- "Extract all the names and contact information"

### TXT Files - Plain Text Analysis
- "What are the main themes in this text?"
- "Extract all the important information"
- "Summarize the content in key points"

## API Endpoints

### File Management

#### POST /upload
Upload a CSV, PDF, DOCX, XLSX, or TXT file for processing.

**Request:**
- Content-Type: multipart/form-data
- Body: File in 'file' field
- Supported formats: .csv, .pdf, .docx, .xlsx, .txt

**Response:**
```json
{
  "success": true,
  "fileId": "unique_file_id",
  "filename": "document.pdf",
  "fileType": "pdf",
  "size": 1024000,
  "processed": true
}
```

### Chat & Conversations

#### POST /chat
Send a chat message about uploaded document data with conversation context.

**Request:**
```json
{
  "fileName": "report.pdf",
  "message": "What are the key findings in this document?",
  "conversationId": "optional_conversation_id"
}
```

**Example requests for different file types:**
```json
// CSV file analysis
{"fileName": "sales_data.csv", "message": "What's the total revenue?"}

// PDF document analysis  
{"fileName": "report.pdf", "message": "Summarize the main conclusions"}

// DOCX text analysis
{"fileName": "proposal.docx", "message": "What are the action items?"}

// XLSX spreadsheet analysis
{"fileName": "budget.xlsx", "message": "Show me the Q4 expenses"}

// TXT plain text analysis
{"fileName": "notes.txt", "message": "What are the main topics discussed?"}
```

**Response:**
```json
{
  "success": true,
  "reply": "Based on the document, the key findings include...",
  "conversationId": "conversation_id",
  "title": "Document Analysis Discussion"
}
```

### Conversation Management

#### GET /api/conversations
List all user conversations.

**Response:**
```json
{
  "success": true,
  "conversations": [
    {
      "id": "conv_123",
      "title": "Employee Salary Analysis",
      "fileName": "payroll.csv",
      "status": "active",
      "messageCount": 5,
      "createdAt": "2024-01-01T10:00:00Z",
      "updatedAt": "2024-01-01T11:00:00Z"
    }
  ]
}
```

#### POST /api/conversations
Create a new conversation.

#### GET /api/conversations/:id
Get specific conversation with messages.

#### PUT /api/conversations/:id
Update conversation (rename, etc.).

#### DELETE /api/conversations/:id
Soft delete a conversation.

#### GET /api/conversations/:id/export/json
Export conversation as JSON.

#### GET /api/conversations/:id/export/csv
Export conversation as CSV.

### System

#### GET /health
Health check endpoint with service status.

**Response:**
```json
{
  "status": "OK",
  "message": "TaktMate Backend is running",
  "cosmos": "healthy",
  "openai": "healthy",
  "blob": "healthy"
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
│   ├── toolkit/               # AI tool calling system
│   │   ├── index.js           # Tool loader and executor
│   │   ├── dataLoader.js      # File data loading with caching
│   │   ├── filterNumeric.js   # Numeric filtering tool
│   │   ├── createPlot.js      # Chart/plot generation tool
│   │   └── computeAvgCountSumMinMaxMedian.js # Statistical analysis tool
│   ├── processCsv.js          # CSV parsing utilities
│   ├── processPdf.js          # PDF parsing utilities
│   ├── processDocx.js         # DOCX parsing utilities
│   ├── processXlsx.js         # XLSX parsing utilities
│   ├── processTxt.js          # TXT parsing utilities
│   ├── middleware/
│   │   └── auth.js            # Authentication middleware
│   ├── routes/
│   │   ├── files.js           # File management API routes
│   │   └── conversations.js   # Conversation management API routes
│   ├── services/
│   │   ├── storage.js         # Azure Blob Storage service
│   │   ├── cosmos.js          # Azure Cosmos DB service for conversations
│   │   ├── openaiService.js   # OpenAI service with dual-model support
│   │   └── summarizerService.js # AI summarization and archiving service
│   ├── prompts/
│   │   ├── normalPrompt.js    # Main chat system prompt
│   │   └── suggestionPrompt.js # Suggestion generation prompt
│   ├── ENVIRONMENT_VARIABLES.md # Azure deployment guide
│   └── package.json
├── frontend/                   # React frontend (Azure Static Web Apps)
│   ├── src/
│   │   ├── App.jsx            # Main application with authentication
│   │   ├── components/
│   │   │   ├── Card.jsx       # UI card component
│   │   │   ├── ChatBox.jsx    # Chat interface with conversation support
│   │   │   ├── ChartDisplay.jsx # Chart and plot visualization component
│   │   │   ├── ConversationItem.jsx # Individual conversation display component
│   │   │   ├── DataTable.jsx  # Data display component
│   │   │   ├── Logo.jsx       # TaktMate logo component
│   │   │   ├── LogoutButton.jsx # User logout
│   │   │   ├── SourcesPanel.jsx # File upload & conversation management
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
│   ├── 06_custom_domain/      # Custom domain setup
│   └── 07_stateful_chats/     # Conversation memory implementation
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

- **File Size**: Maximum 100MB per file
- **File Types**: Supports CSV, PDF, DOCX, XLSX, and TXT files only
- **Context Window**: Large files may exceed model token limits
- **Tool Calling**: Only available with GPT-5-mini (data analysis tools work with CSV/XLSX files only)
- **PDF Parsing**: Text-based PDFs only (no OCR for scanned documents)
- **File Encoding**: UTF-8, Latin1, and ASCII supported (automatic detection)
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
- **Multi-file Support**: Upload and manage multiple files (CSV, PDF, DOCX, XLSX, TXT)
- **Tool Calling**: AI-powered data filtering, visualization, and statistical analysis
- **Data Visualization**: Bar charts and XY plots with Recharts
- **Backend Data Processing**: File caching and server-side computation
- **Security**: Managed identity, SAS tokens, user isolation
- **Scalability**: Auto-scaling Azure App Service and Static Web Apps
- **Monitoring**: Application Insights integration
- **Conversation Management**: Persistent chat history with AI summarization

### 🚀 Future Enhancement Opportunities
- **Real-time Collaboration**: Multi-user shared datasets
- **Multi-region Deployment**: Global distribution for lower latency
- **Advanced Tool Calling**: More data analysis tools (groupBy, join, pivot tables)
- **Export Capabilities**: PDF reports, Excel exports
- **Advanced Visualizations**: More chart types (scatter, heatmap, time series)
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
                   ┌─── Azure OpenAI (GPT-5-mini + GPT-4.1)
                   │      └─ Tool Calling: filter, plot, stats
                   │
                   ├─── Azure Cosmos DB (Conversations)
                   │
                   ├─── Azure Blob Storage (User Files + Archives)
                   │
                   └─── Entra ID (Authentication)
```

### Key Architecture Features
- **Zero-Trust Security**: All communication encrypted, managed identities used
- **User Isolation**: Each user gets private blob storage container and Cosmos DB partition
- **Hybrid Storage**: Active conversations in Cosmos DB, archived conversations in Blob Storage
- **Auto-Scaling**: Both frontend and backend scale automatically
- **High Availability**: Multi-region deployment capability
- **AI-Powered**: Dual-model system (GPT-5-mini for tool calling, GPT-4.1 for stable operations)
- **Tool Calling**: Backend-side data processing with file caching for performance
- **Monitoring**: Application Insights for performance and error tracking

### Azure OpenAI Integration
The application uses a dual-model Azure OpenAI architecture:

**GPT-5-mini (Tool Calling & Data Analysis):**
- **Primary Use**: Data analysis with tool calling capabilities
- **Max Completion Tokens**: 2000
- **Temperature**: 1.0 (default, required)
- **Tools**: filter_numeric, create_plot, compute_avg_count_sum_min_max_median
- **Features**: Parallel function execution, structured outputs

**GPT-4.1 (Stable Operations):**
- **Primary Use**: Title generation, summarization, suggestions
- **Max Tokens**: 500 (chat), 150 (summaries)
- **Temperature**: 0.1 (consistent) / 0.3 (summarization)
- **Benefits**: Stable, reliable for production workflows

**Common Configuration:**
- **Endpoint**: `https://taktmate.openai.azure.com`
- **API Version**: `2025-01-01-preview`
- **Authentication**: API key via Azure Key Vault
- **Error Handling**: Comprehensive retry logic and fallback responses

### Security Features
- **Managed Identity**: Backend authenticates to Azure services without storing keys
- **SAS Tokens**: Time-limited, permission-specific access to blob storage
- **HTTPS Only**: All communication encrypted in transit
- **Private Storage**: User data isolated in private containers
- **Key Vault**: Secrets managed securely outside of application code

For detailed Azure setup instructions, see `AZURE_SETUP.md` and `backend/ENVIRONMENT_VARIABLES.md`.