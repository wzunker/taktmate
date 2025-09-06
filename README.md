# TaktMate - CSV Chat with Microsoft Entra External ID Authentication

A comprehensive web application that allows users to upload CSV files and chat with their data using Azure OpenAI's GPT-4.1, featuring enterprise-grade authentication through Microsoft Entra External ID and an advanced evaluation framework for testing AI performance across multiple domains.

## Features

### Core Application
- 📁 **CSV Upload**: Upload CSV files up to 5MB
- 💬 **AI Chat**: Ask questions about your data in natural language
- 🧠 **Smart Analysis**: GPT-4.1 analyzes and responds using only your CSV data
- 🎨 **Modern UI**: Clean, responsive interface built with React and TailwindCSS
- ⚡ **Real-time**: Instant responses and file processing
- 🔍 **Debug Mode**: Environment-based prompt debugging for development

### Enterprise Authentication (Microsoft Entra External ID)
- 🔐 **User Authentication**: Sign-up and sign-in with multiple identity providers
- 🌐 **Social Login**: Google and Microsoft OAuth integration
- 👤 **User Profiles**: Collect company, role, and industry information
- 🔑 **JWT Token Validation**: Enterprise-grade security with RS256 signatures
- 🛡️ **Protected Routes**: Role-based access control and API protection
- 📧 **Password Management**: Self-service password reset and profile editing

### Advanced Evaluation System
- 🧪 **Multi-Domain Testing**: 5 diverse datasets (Sports, Astronomy, HR, Inventory, Transportation)
- 📊 **Comprehensive Scoring**: Penalty-based evaluation with invalid value detection
- 🎯 **40+ Test Cases**: Structured and semantic query testing
- 📈 **Performance Analytics**: Detailed scoring, bonus points, and failure analysis
- 🔄 **Automated Evaluation**: Run full test suites with single commands

## Tech Stack

### Frontend
- React 18
- TailwindCSS
- Axios for API calls

### Backend
- Node.js with Express.js
- Azure OpenAI GPT-4.1 integration
- Microsoft Entra External ID authentication integration
- JWT token validation middleware
- Multer for file uploads
- csv-parser for CSV processing
- Environment-based debug logging
- CORS enabled with authentication support

### Evaluation Framework
- Advanced similarity matching (Jaro-Winkler distance)
- Penalty-based scoring system
- Multi-domain test datasets
- Comprehensive reporting (JSON, CSV, TXT)
- Automated performance analysis

## Prerequisites

- Node.js 16+ and npm
- Azure OpenAI API key and endpoint
- Access to GPT-4.1 deployment
- Azure subscription with Microsoft Entra External ID access
- Domain name (recommended: `app.taktconnect.com`)

## Quick Start

### 1. Install All Dependencies

```bash
# Navigate to the project directory
cd mvp-gpt5

# Install all dependencies (root, backend, frontend, and tests)
npm run install-all
```

### 2. Configure Microsoft Entra External ID Authentication

```bash
# Copy environment template
cp backend/env.example backend/.env

# Edit .env with your Microsoft Entra External ID settings
# Follow the complete setup guide
open MICROSOFT_ENTRA_EXTERNAL_ID_SETUP_GUIDE.md
```

### 3. Start the Application

```bash
# Start both backend and frontend
npm run dev
```

The application will start automatically:
- Backend: http://localhost:3001
- Frontend: http://localhost:3000 (opens in browser)

### 4. Test Microsoft Entra External ID Integration

```bash
# Test authentication configuration
npm run test:config

# Run comprehensive authentication tests
npm run test:all
```

### 5. Run Evaluations (Optional)

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

### Azure OpenAI Setup

The application uses Azure OpenAI GPT-4.1. Configuration is in `backend/config.js`:

```javascript
module.exports = {
  AZURE_OPENAI_API_KEY: process.env.OPENAI_API_KEY || 'your-api-key',
  AZURE_OPENAI_ENDPOINT: 'https://your-endpoint.openai.azure.com/openai/deployments/gpt-4.1',
  AZURE_OPENAI_API_VERSION: '2025-01-01-preview',
  AZURE_OPENAI_DEPLOYMENT_NAME: 'gpt-4.1'
};
```

### Environment Variables

Create `backend/.env` for custom configuration:
```env
# Azure OpenAI Configuration
OPENAI_API_KEY=your-azure-openai-api-key
DEBUG_PROMPTS=true
PORT=3001

# Microsoft Entra External ID Configuration
ENTRA_EXTERNAL_ID_TENANT_NAME=taktmate
ENTRA_EXTERNAL_ID_TENANT_ID=your-tenant-id
ENTRA_EXTERNAL_ID_CLIENT_ID=your-client-id
ENTRA_EXTERNAL_ID_CLIENT_SECRET=your-client-secret
ENTRA_EXTERNAL_ID_SIGNUP_SIGNIN_POLICY=B2C_1_signupsignin1
ENTRA_EXTERNAL_ID_PASSWORD_RESET_POLICY=B2C_1_passwordreset1
ENTRA_EXTERNAL_ID_PROFILE_EDIT_POLICY=B2C_1_profileedit1

# Application URLs
FRONTEND_URL=https://app.taktconnect.com
BACKEND_URL=https://api.taktconnect.com
```

See `backend/env.example` for complete configuration template.

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

### Web Application
1. **Upload CSV**: Click "Select CSV File" and choose a CSV file
2. **Wait for Processing**: File is uploaded and parsed automatically
3. **Start Chatting**: Ask questions about your data
4. **Get Insights**: AI responds using only your CSV data

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
mvp-gpt5/
├── backend/                    # Backend server
│   ├── index.js               # Main server with debug logging
│   ├── config.js              # Azure OpenAI configuration
│   ├── fileStore.js           # In-memory file storage
│   ├── processCsv.js          # CSV parsing utilities
│   └── package.json
├── frontend/                   # React frontend
│   ├── src/
│   │   ├── App.jsx            # Main application
│   │   ├── components/
│   │   │   ├── FileUpload.jsx # File upload component
│   │   │   ├── ChatBox.jsx    # Chat interface
│   │   │   └── DataTable.jsx  # Data display component
│   │   ├── index.js
│   │   └── index.css
│   ├── public/
│   └── package.json
├── tests/                      # Evaluation framework
│   ├── datasets/              # Test CSV files
│   │   ├── sports_statistics.csv
│   │   ├── astronomy_events.csv
│   │   ├── employee_payroll.csv
│   │   ├── product_inventory.csv
│   │   └── transportation_schedules.csv
│   ├── qa_pairs/              # Test questions with invalid_values
│   │   ├── sports_statistics_qa.json
│   │   ├── astronomy_events_qa.json
│   │   ├── employee_payroll_qa.json
│   │   ├── product_inventory_qa.json
│   │   └── transportation_schedules_qa.json
│   ├── eval-framework.js      # Core evaluation logic
│   ├── eval-runner.js         # Test execution
│   ├── results/               # Test results (139 files)
│   ├── scorecard.json         # Performance summary
│   ├── scorecard.csv          # Analysis export
│   └── README.md              # Testing documentation
├── prompts/                    # Example prompts and setup
└── package.json               # Root configuration
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

- **File Size**: Maximum 5MB per CSV file
- **Storage**: Files stored in memory (lost on restart)
- **Single Session**: One CSV file per session
- **Context Window**: Large files may exceed GPT-4.1 limits
- **No Authentication**: No user management system

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

This MVP includes comprehensive evaluation capabilities. For production use, consider:

- **Database Integration**: Replace in-memory storage
- **User Authentication**: Add session management
- **Multi-file Support**: Handle multiple CSVs per user
- **Advanced Analytics**: Add visualizations
- **Real-time Collaboration**: Multi-user features
- **API Rate Limiting**: Production-ready controls

## License

MIT License - See LICENSE file for details.

## Azure OpenAI Integration

This application uses Azure OpenAI GPT-4.1 with:
- Custom endpoint configuration
- API version 2025-01-01-preview
- Temperature 0.1 for consistent responses
- 500 token limit for concise answers
- Comprehensive error handling

For Azure OpenAI setup, see `AZURE_SETUP.md`.

## Microsoft Entra External ID Authentication

TaktMate includes enterprise-grade authentication powered by Microsoft Entra External ID. This provides:

- **Multiple Authentication Methods**: Email/password, Google OAuth, Microsoft OAuth
- **User Profile Management**: Company, role, and industry information collection
- **Enterprise Security**: JWT token validation with RS256 signatures
- **Self-Service Features**: Password reset and profile editing

### Authentication Setup

1. **Complete Setup Guide**: Follow `MICROSOFT_ENTRA_EXTERNAL_ID_SETUP_GUIDE.md` for step-by-step tenant setup
2. **Quick Reference**: Use `MICROSOFT_ENTRA_EXTERNAL_ID_README.md` for development workflow
3. **Testing Guide**: Follow `MICROSOFT_ENTRA_EXTERNAL_ID_TESTING_GUIDE.md` for validation procedures
4. **Application Registration**: Use `AZURE_APP_REGISTRATION_GUIDE.md` for app configuration

### Authentication Commands

```bash
# Complete authentication test suite
npm run test:all

# Individual test categories
npm run test:config          # Configuration validation
npm run test:user-flows      # User flow testing
npm run test:jwt-claims      # JWT token validation
npm run test:e2e             # End-to-end testing
npm run test:connectivity    # Endpoint connectivity
npm run test:performance     # Performance benchmarks

# Validation utilities
npm run validate:app         # Application registration validation
npm run generate:policies    # Generate custom policy XML files
```

### Authentication Architecture

```
Frontend (React)     Microsoft Entra External ID Tenant     Backend (Node.js)
┌─────────────────┐  ┌──────────────────┐    ┌─────────────────┐
│ • Authentication│◄─┤ • User Flows     │───►│ • JWT Validation│
│ • Protected     │  │ • Custom Policies│    │ • User Profile  │
│   Routes        │  │ • Identity       │    │ • Protected     │
│ • User Profile  │  │   Providers      │    │   Endpoints     │
└─────────────────┘  └──────────────────┘    └─────────────────┘
```

### User Experience

1. **Landing Page**: User accesses TaktMate application
2. **Authentication**: Redirect to Microsoft Entra External ID for sign-up/sign-in
3. **Profile Collection**: Company, role, and industry information gathered
4. **Token Issuance**: JWT token with user claims returned to application
5. **Protected Access**: User gains access to CSV upload and chat features

### Security Features

- ✅ **JWT Token Validation**: RS256 signature verification with JWKS key rotation
- ✅ **Token Expiration**: Configurable token lifetimes with refresh capabilities
- ✅ **Role-Based Access**: Flexible authorization middleware for API protection
- ✅ **Audit Logging**: Comprehensive security monitoring and error tracking
- ✅ **HTTPS Enforcement**: Secure token transmission and redirect handling# Trigger deployment after making repo public
