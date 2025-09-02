# Azure OpenAI Setup

Your Azure OpenAI configuration has been integrated into the backend.

## Configuration Details

- **Endpoint**: `https://taktmate.openai.azure.com/openai/deployments/gpt-4.1/chat/completions?api-version=2025-01-01-preview`
- **API Key**: `BT4uTZtbBEx9a6ulvMS4w9m8qmJsZPl0lIosOOCu2dOsn2G1DLH5JQQJ99BHACYeBjFXJ3w3AAABACOGB5lu`
- **Deployment**: `gpt-4.1`
- **API Version**: `2025-01-01-preview`

## Setup Options

### Option 1: Using Environment Variables (Recommended)

Create a `.env` file in the `backend` directory:

```bash
cd backend
echo "OPENAI_API_KEY=BT4uTZtbBEx9a6ulvMS4w9m8qmJsZPl0lIosOOCu2dOsn2G1DLH5JQQJ99BHACYeBjFXJ3w3AAABACOGB5lu" > .env
echo "PORT=5000" >> .env
```

### Option 2: Hardcoded Configuration (Already Done)

The configuration is already hardcoded in the backend code as fallback values, so the application will work immediately without creating a `.env` file.

## Running the Application

### Quick Start (Single Command)

```bash
# Install all dependencies
npm run install-all

# Start both backend and frontend
npm run dev
```

### Manual Start (Separate Commands)

1. **Start the backend:**
   ```bash
   cd backend
   npm install
   npm run dev
   ```

2. **Start the frontend:**
   ```bash
   cd frontend
   npm install
   npm start
   ```

### Test the Connection

- Visit http://localhost:3000
- Upload the `sample-data.csv` file
- Ask a question like "What departments are in this data?"

The application is now configured to use your Azure OpenAI GPT-4.1 deployment!
