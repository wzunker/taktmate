# GPT-5-Mini with Tool Calling Implementation Checklist

**Objective**: Add GPT-5-mini model with function calling capabilities to enable computational tools (starting with basic math operations using mathjs).

**Why GPT-5-mini?**
- ✅ Supports parallel tool calling and structured outputs
- ✅ Cost-effective for tool orchestration
- ✅ Available in eastus region (same as existing `taktmate` resource)
- ✅ Fast responses, ideal for real-time agent interactions
- ✅ Minimal reasoning capabilities with preamble support

---

## 🔧 **Phase 1: Azure OpenAI Setup**

### 1.1 Deploy GPT-5-mini Model
- [ ] Log into [Azure Portal](https://portal.azure.com)
- [ ] Navigate to your Azure OpenAI resource: `taktmate` (eastus)
- [ ] Go to **Model deployments** → **Manage Deployments**
- [ ] Click **Create new deployment**
  - Model: `gpt-5-mini`
  - Deployment name: `gpt-5-mini` (use this exact name)
  - Model version: `2025-08-07` (or latest available)
- [ ] Verify deployment is successful and shows as "Succeeded"
- [ ] Note the endpoint: `https://taktmate.openai.azure.com/openai/deployments/gpt-5-mini`

### 1.2 Update Azure Key Vault
- [ ] Navigate to **TaktMate-KeyVault** in Azure Portal
- [ ] Go to **Secrets**
- [ ] Verify `OpenAI-API-Key` secret exists (should already be there)
  - ✅ This same key works for both `gpt-4.1` and `gpt-5-mini` since they're in the same resource
- [ ] **Optional**: Add a new secret for model selection
  - Name: `Active-OpenAI-Model`
  - Value: `gpt-5-mini` or `gpt-4.1`

### 1.3 Update App Service Environment Variables
- [ ] Navigate to **taktmate-backend-api** App Service
- [ ] Go to **Settings** → **Environment variables**
- [ ] Add/update these settings:
  ```
  AZURE_OPENAI_DEPLOYMENT_GPT4=gpt-4.1
  AZURE_OPENAI_DEPLOYMENT_GPT5_MINI=gpt-5-mini
  ACTIVE_MODEL=gpt-5-mini
  ```
  **Note**: You don't need to add `AZURE_OPENAI_ENDPOINT` since both models are in the same `taktmate` resource
- [ ] **Save** the configuration
- [ ] **Restart** the App Service

---

## 📦 **Phase 2: Backend Dependencies**

### 2.1 Install Required Packages
- [ ] Navigate to `/backend` directory
- [ ] Install `mathjs` for mathematical operations:
  ```bash
  npm install mathjs
  ```
- [ ] Verify `package.json` includes:
  ```json
  "mathjs": "^12.0.0"
  ```
- [ ] Commit updated `package.json` and `package-lock.json`

---

## 🛠️ **Phase 3: Toolkit System Implementation**

### 3.1 Create Toolkit Directory Structure
- [ ] Create `/backend/toolkit/` directory
- [ ] Create `/backend/toolkit/index.js` (tool loader)
- [ ] Create `/backend/toolkit/computeAverage.js` (first tool)

### 3.2 Implement Tool Loader (`/backend/toolkit/index.js`)
```javascript
const fs = require('fs');
const path = require('path');

/**
 * Dynamically load all tools from the toolkit directory
 * @returns {Array} Array of tool definitions compatible with OpenAI function calling
 */
async function loadTools() {
  const tools = [];
  const toolsDir = __dirname;
  
  const files = fs.readdirSync(toolsDir);
  
  for (const file of files) {
    if (file.endsWith('.js') && file !== 'index.js') {
      const toolPath = path.join(toolsDir, file);
      const tool = require(toolPath);
      
      // Convert tool definition to OpenAI function format
      tools.push({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters
        }
      });
    }
  }
  
  console.log(`✅ Loaded ${tools.length} tools:`, tools.map(t => t.function.name).join(', '));
  return tools;
}

/**
 * Get a specific tool by name and execute it
 * @param {string} toolName - Name of the tool to execute
 * @param {object} args - Arguments to pass to the tool
 * @returns {Promise<object>} Tool execution result
 */
async function executeTool(toolName, args) {
  const toolsDir = __dirname;
  const files = fs.readdirSync(toolsDir);
  
  for (const file of files) {
    if (file.endsWith('.js') && file !== 'index.js') {
      const tool = require(path.join(toolsDir, file));
      if (tool.name === toolName) {
        return await tool.execute(args);
      }
    }
  }
  
  throw new Error(`Tool "${toolName}" not found`);
}

module.exports = {
  loadTools,
  executeTool
};
```

**Checklist:**
- [ ] Create the file at `/backend/toolkit/index.js`
- [ ] Copy the code above into the file
- [ ] Verify syntax (no missing brackets, semicolons, etc.)

### 3.3 Implement First Tool: Compute Average (`/backend/toolkit/computeAverage.js`)
```javascript
const math = require('mathjs');

/**
 * Tool: Compute Average
 * Calculates the mean/average of an array of numbers
 */
module.exports = {
  name: 'compute_average',
  description: 'Calculate the average (mean) of an array of numbers. Useful for analyzing numerical data from CSV files, spreadsheets, or any numeric datasets.',
  
  parameters: {
    type: 'object',
    properties: {
      numbers: {
        type: 'array',
        items: { type: 'number' },
        description: 'Array of numbers to calculate the average from'
      }
    },
    required: ['numbers']
  },
  
  /**
   * Execute the average calculation
   * @param {object} args - Tool arguments
   * @param {number[]} args.numbers - Array of numbers
   * @returns {object} Result with the calculated average
   */
  execute: async ({ numbers }) => {
    if (!Array.isArray(numbers) || numbers.length === 0) {
      throw new Error('numbers must be a non-empty array');
    }
    
    // Validate all items are numbers
    const validNumbers = numbers.filter(n => typeof n === 'number' && !isNaN(n));
    
    if (validNumbers.length === 0) {
      throw new Error('No valid numbers provided');
    }
    
    const average = math.mean(validNumbers);
    
    return {
      average: average,
      count: validNumbers.length,
      sum: math.sum(validNumbers),
      min: math.min(validNumbers),
      max: math.max(validNumbers)
    };
  }
};
```

**Checklist:**
- [ ] Create the file at `/backend/toolkit/computeAverage.js`
- [ ] Copy the code above into the file
- [ ] Test that `mathjs` is properly installed

---

## 🔄 **Phase 4: Backend Services Update**

### 4.1 Create OpenAI Service (`/backend/services/openaiService.js`)
This centralizes OpenAI client initialization and model selection.

```javascript
const { OpenAI } = require('openai');

/**
 * Get the active OpenAI deployment name from environment
 * @returns {string} Deployment name (gpt-4.1 or gpt-5-mini)
 */
function getActiveDeployment() {
  const activeModel = process.env.ACTIVE_MODEL || 'gpt-4.1';
  
  if (activeModel === 'gpt-5-mini') {
    return process.env.AZURE_OPENAI_DEPLOYMENT_GPT5_MINI || 'gpt-5-mini';
  }
  
  return process.env.AZURE_OPENAI_DEPLOYMENT_GPT4 || 'gpt-4.1';
}

/**
 * Get base OpenAI endpoint (without deployment)
 * @returns {string} Base endpoint URL
 */
function getBaseEndpoint() {
  return process.env.AZURE_OPENAI_ENDPOINT || 'https://taktmate.openai.azure.com';
}

/**
 * Get API version
 * @returns {string} API version
 */
function getApiVersion() {
  return process.env.AZURE_OPENAI_API_VERSION || '2025-01-01-preview';
}

/**
 * Create an OpenAI client for a specific deployment
 * @param {string} deployment - Deployment name (optional, uses active model if not provided)
 * @returns {OpenAI} Configured OpenAI client
 */
function createOpenAIClient(deployment = null) {
  const deploymentName = deployment || getActiveDeployment();
  const baseUrl = `${getBaseEndpoint()}/openai/deployments/${deploymentName}`;
  
  console.log(`🤖 Creating OpenAI client for deployment: ${deploymentName}`);
  
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: baseUrl,
    defaultQuery: { 'api-version': getApiVersion() },
    defaultHeaders: {
      'api-key': process.env.OPENAI_API_KEY,
    },
  });
}

/**
 * Check if current active model supports tool calling
 * @returns {boolean} True if model supports tools
 */
function supportsToolCalling() {
  const activeModel = process.env.ACTIVE_MODEL || 'gpt-4.1';
  // gpt-5-mini supports parallel tool calling and structured outputs
  return activeModel === 'gpt-5-mini';
}

module.exports = {
  getActiveDeployment,
  getBaseEndpoint,
  getApiVersion,
  createOpenAIClient,
  supportsToolCalling
};
```

**Checklist:**
- [ ] Create the file at `/backend/services/openaiService.js`
- [ ] Copy the code above into the file
- [ ] Verify all exports are correct

### 4.2 Update Configuration (`/backend/config.js`)
- [ ] Update `/backend/config.js` to include new environment variables:

```javascript
// Azure OpenAI Configuration
module.exports = {
  // Azure OpenAI Settings
  AZURE_OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  AZURE_OPENAI_ENDPOINT: process.env.AZURE_OPENAI_ENDPOINT || 'https://taktmate.openai.azure.com',
  AZURE_OPENAI_API_VERSION: process.env.AZURE_OPENAI_API_VERSION || '2025-01-01-preview',
  
  // Model Deployments
  AZURE_OPENAI_DEPLOYMENT_GPT4: process.env.AZURE_OPENAI_DEPLOYMENT_GPT4 || 'gpt-4.1',
  AZURE_OPENAI_DEPLOYMENT_GPT5_MINI: process.env.AZURE_OPENAI_DEPLOYMENT_GPT5_MINI || 'gpt-5-mini',
  ACTIVE_MODEL: process.env.ACTIVE_MODEL || 'gpt-5-mini',
  
  // Server Settings
  PORT: process.env.PORT || 3001,
  
  // Application Settings
  MAX_FILE_SIZE: 100 * 1024 * 1024, // 100MB
  MAX_TOKENS: 500,
  TEMPERATURE: 0.1
};
```

---

## 💬 **Phase 5: Update Chat Endpoint with Tool Calling**

### 5.1 Update Main Chat Endpoint (`/backend/index.js`)

**Important**: This is a significant change. Make a backup of `/backend/index.js` first.

**Changes needed in `/backend/index.js`:**

1. **Add imports at the top** (after existing requires, around line 17):
```javascript
const openaiService = require('./services/openaiService');
const { loadTools, executeTool } = require('./toolkit');
```

2. **Replace the hardcoded OpenAI client** (lines 32-40) with:
```javascript
// Initialize Azure OpenAI using centralized service
const openai = openaiService.createOpenAIClient();

// Log active model on startup
console.log(`🤖 Active OpenAI Model: ${openaiService.getActiveDeployment()}`);
console.log(`🔧 Tool calling enabled: ${openaiService.supportsToolCalling()}`);
```

3. **Update the `/api/chat` endpoint** to support tool calling.

Find the section starting around line 489 where it says:
```javascript
// Call Azure OpenAI GPT-4.1
const completion = await openai.chat.completions.create({
```

**Replace the entire chat completion logic** (lines 489-498) with:

```javascript
    // Prepare chat options
    const chatOptions = {
      model: openaiService.getActiveDeployment(),
      messages,
      max_tokens: 500,
      temperature: 0.1
    };

    // Add tools if the active model supports them
    let tools = [];
    if (openaiService.supportsToolCalling()) {
      tools = await loadTools();
      if (tools.length > 0) {
        chatOptions.tools = tools;
        chatOptions.tool_choice = 'auto';
        console.log(`🔧 Tool calling enabled with ${tools.length} tools`);
      }
    }

    // Initial API call
    let completion = await openai.chat.completions.create(chatOptions);
    let reply = completion.choices[0].message.content;
    
    // Handle tool calls if present
    const toolCalls = completion.choices[0].message.tool_calls;
    if (toolCalls && toolCalls.length > 0) {
      console.log(`🛠️ Model requested ${toolCalls.length} tool call(s)`);
      
      // Execute all requested tools
      const toolMessages = [];
      for (const toolCall of toolCalls) {
        try {
          const toolName = toolCall.function.name;
          const toolArgs = JSON.parse(toolCall.function.arguments);
          
          console.log(`🔧 Executing tool: ${toolName}`, toolArgs);
          const toolResult = await executeTool(toolName, toolArgs);
          
          toolMessages.push({
            role: 'tool',
            content: JSON.stringify(toolResult),
            tool_call_id: toolCall.id
          });
          
          console.log(`✅ Tool ${toolName} executed successfully`);
        } catch (error) {
          console.error(`❌ Tool execution failed:`, error.message);
          toolMessages.push({
            role: 'tool',
            content: JSON.stringify({ error: error.message }),
            tool_call_id: toolCall.id
          });
        }
      }
      
      // Send tool results back to the model for final response
      const followUpMessages = [
        ...messages,
        completion.choices[0].message,
        ...toolMessages
      ];
      
      const followUpCompletion = await openai.chat.completions.create({
        model: openaiService.getActiveDeployment(),
        messages: followUpMessages,
        max_tokens: 500,
        temperature: 0.1
      });
      
      reply = followUpCompletion.choices[0].message.content;
      console.log(`✅ Generated final response after tool execution`);
    }
```

**Checklist:**
- [ ] Back up `/backend/index.js` first
- [ ] Add imports for `openaiService` and toolkit
- [ ] Replace OpenAI client initialization
- [ ] Update the chat completion logic to support tool calling
- [ ] Test syntax - ensure no missing brackets or commas

### 5.2 Update Other OpenAI Clients

**Update `/backend/services/summarizerService.js`:**
- [ ] Replace lines 1-14 with:
```javascript
const { OpenAI } = require('openai');
const { BlobServiceClient } = require('@azure/storage-blob');
const { DefaultAzureCredential } = require('@azure/identity');
const cosmosService = require('./cosmos');
const openaiService = require('./openaiService');

// Initialize Azure OpenAI for summarization (always use GPT-4.1 for this)
const openai = openaiService.createOpenAIClient('gpt-4.1');
```

**Update `/backend/routes/conversations.js`:**
- [ ] Replace lines 1-24 with:
```javascript
const express = require('express');
const router = express.Router();
const cosmosService = require('../services/cosmos');
const { requireAuth } = require('../middleware/auth');
const { getBlobContent } = require('../services/storage');
const { suggestionPrompt, multiFileSuggestionPrompt } = require('../prompts/suggestionPrompt');
const openaiService = require('../services/openaiService');

// Import file processing functions
const { parseCsv, formatCsvForPrompt } = require('../processCsv');
const { parsePdf, formatPdfForPrompt } = require('../processPdf');
const { parseDocx, formatDocxForPrompt } = require('../processDocx');
const { parseXlsx, formatXlsxForPrompt } = require('../processXlsx');
const { parseTxt, formatTxtForPrompt } = require('../processTxt');

// Initialize OpenAI client for suggestions (always use GPT-4.1 for this)
const openai = openaiService.createOpenAIClient('gpt-4.1');

// Apply authentication to all conversation routes
router.use(requireAuth);
```

**Update title generation in `/backend/index.js`:**
- [ ] Find the `generateConversationTitle` function (around line 47)
- [ ] Replace line 59 with:
```javascript
    const titleClient = openaiService.createOpenAIClient('gpt-4.1');
    const completion = await titleClient.chat.completions.create({
```

---

## 📝 **Phase 6: Local Environment Configuration**

### 6.1 Update Local `.env` File
- [ ] Add to `/backend/.env`:
```bash
# Azure OpenAI Configuration
OPENAI_API_KEY=your-api-key-here

# Model Deployments (both in taktmate resource)
AZURE_OPENAI_DEPLOYMENT_GPT4=gpt-4.1
AZURE_OPENAI_DEPLOYMENT_GPT5_MINI=gpt-5-mini

# Active Model (switch between gpt-4.1 and gpt-5-mini)
ACTIVE_MODEL=gpt-5-mini

# Other settings
PORT=3001
NODE_ENV=development
LOCAL_DEVELOPMENT=true
```

**Note**: No need to set `AZURE_OPENAI_ENDPOINT` - both models use the same endpoint since they're in the `taktmate` resource.

### 6.2 Update Environment Variables Documentation
- [ ] Update `/backend/ENVIRONMENT_VARIABLES.md` to include:
  - `AZURE_OPENAI_DEPLOYMENT_GPT4` - Deployment name for GPT-4.1 (default: `gpt-4.1`)
  - `AZURE_OPENAI_DEPLOYMENT_GPT5_MINI` - Deployment name for GPT-5-mini (default: `gpt-5-mini`)
  - `ACTIVE_MODEL` - Which model to use for chat (options: `gpt-4.1` or `gpt-5-mini`)

---

## 🧪 **Phase 7: Testing**

### 7.1 Local Testing
- [ ] Start backend: `cd backend && npm run dev`
- [ ] Check console for:
  - `🤖 Active OpenAI Model: gpt-5-mini`
  - `🔧 Tool calling enabled: true`
  - `✅ Loaded 1 tools: compute_average`
- [ ] Upload a CSV file with numeric data (e.g., `/tests/datasets/csv/employee_payroll.csv`)
- [ ] Test tool calling with prompts like:
  - "What is the average salary in this dataset?"
  - "Calculate the mean of all the numeric values in column X"
  - "What's the average age of employees?"
- [ ] Verify console shows tool execution:
  - `🔧 Executing tool: compute_average`
  - `✅ Tool compute_average executed successfully`
- [ ] Test parallel tool calling (gpt-5-mini specialty):
  - "What's the average AND the maximum salary?" (should call tool once with smart handling)

### 7.2 Model Toggle Testing
- [ ] Update `.env` to `ACTIVE_MODEL=gpt-4.1`
- [ ] Restart backend
- [ ] Verify console shows: `🔧 Tool calling enabled: false`
- [ ] Test chat still works (without tool calling)
- [ ] Switch back to `ACTIVE_MODEL=gpt-5-mini`
- [ ] Verify tool calling works again

### 7.3 Error Handling Testing
- [ ] Test with invalid tool arguments
- [ ] Test with empty arrays
- [ ] Test with non-numeric data
- [ ] Verify errors are handled gracefully

---

## 🚀 **Phase 8: Deployment**

### 8.1 Pre-Deployment Checklist
- [ ] All code changes committed to git
- [ ] `.env` file is NOT committed (in `.gitignore`)
- [ ] `package.json` and `package-lock.json` updated with `mathjs`
- [ ] Backend starts without errors locally
- [ ] Tool calling tested and working locally

### 8.2 Deploy to Azure
- [ ] Push code to your repository:
  ```bash
  git add .
  git commit -m "Add GPT-5-mini with tool calling support"
  git push origin develop
  ```
- [ ] Azure App Service will auto-deploy from your repository
- [ ] Monitor deployment in Azure Portal → **taktmate-backend-api** → **Deployment Center**

### 8.3 Post-Deployment Verification
- [ ] Check App Service logs in Azure Portal
- [ ] Look for:
  - `🤖 Active OpenAI Model: gpt-5-mini`
  - `🔧 Tool calling enabled: true`
  - `✅ Loaded 1 tools: compute_average`
- [ ] Test from production frontend
- [ ] Upload CSV and test average calculation queries
- [ ] Verify fast response times (gpt-5-mini is optimized for speed)

### 8.4 Rollback Plan (if needed)
- [ ] Switch `ACTIVE_MODEL` to `gpt-4.1` in App Service settings
- [ ] Restart App Service
- [ ] System will work without tool calling

---

## 📚 **Phase 9: Documentation**

### 9.1 Update README
- [ ] Add section about tool calling capabilities
- [ ] Document how to add new tools
- [ ] Document environment variables for model selection

### 9.2 Create Tool Development Guide
Create `/backend/toolkit/README.md` with instructions for adding new tools:

```markdown
# Toolkit Development Guide

## Adding a New Tool

1. Create a new file in `/backend/toolkit/` (e.g., `computeSum.js`)
2. Follow this template:

\`\`\`javascript
const math = require('mathjs');

module.exports = {
  name: 'tool_name',
  description: 'What this tool does',
  
  parameters: {
    type: 'object',
    properties: {
      // Define your parameters here
    },
    required: ['param1']
  },
  
  execute: async (args) => {
    // Your tool logic here
    return { result: 'something' };
  }
};
\`\`\`

3. Restart the backend - the tool will be auto-loaded
4. Test with a query that would trigger this tool

## Available Tools

- **compute_average**: Calculate mean, min, max, sum from array of numbers
```

**Checklist:**
- [ ] Create `/backend/toolkit/README.md`
- [ ] Document tool template
- [ ] List current tools

---

## ✅ **Phase 10: Future Tool Ideas**

These are ready to implement using the same pattern:

### Additional Math Tools
- [ ] `compute_sum.js` - Sum array of numbers
- [ ] `compute_median.js` - Find median value
- [ ] `compute_stddev.js` - Calculate standard deviation
- [ ] `compute_percentile.js` - Find percentile values

### Data Analysis Tools
- [ ] `filter_data.js` - Filter CSV data by conditions
- [ ] `sort_data.js` - Sort data by column
- [ ] `group_by.js` - Group and aggregate data

### Text Processing Tools
- [ ] `count_words.js` - Word frequency analysis
- [ ] `extract_dates.js` - Extract dates from text
- [ ] `find_pattern.js` - Regex pattern matching

---

## 🎯 **Success Criteria**

You'll know this is working when:

1. ✅ Backend starts with: `🤖 Active OpenAI Model: gpt-5-mini`
2. ✅ Backend logs: `✅ Loaded 1 tools: compute_average`
3. ✅ User asks "What's the average salary?" and the model:
   - Recognizes it needs the `compute_average` tool
   - Extracts salary column from CSV
   - Calls the tool with the numbers
   - Returns a natural language answer with the calculated average
   - Response is fast (gpt-5-mini is optimized for speed)
4. ✅ Can toggle between GPT-4.1 and GPT-5-mini by changing one env var
5. ✅ New tools can be added by dropping a `.js` file in `/backend/toolkit/`
6. ✅ Parallel tool calls work (ask for multiple calculations at once)

---

## 🐛 **Troubleshooting**

### Tool not being called
- Check console for `🔧 Tool calling enabled: true`
- Verify `ACTIVE_MODEL=gpt-5-chat`
- Check tool definition format matches OpenAI spec

### Tool execution errors
- Check console for `❌ Tool execution failed`
- Verify tool arguments are being parsed correctly
- Add more error handling in tool's `execute` function

### Model not found error
- Verify GPT-5-mini deployment exists in Azure Portal under `taktmate` resource
- Check deployment name matches exactly: `gpt-5-mini`
- Verify model version is 2025-08-07 or compatible

### Environment variables not loading
- Check `.env` file exists in `/backend/`
- Restart backend after changing `.env`
- For Azure, check App Service → Environment variables

---

## 📊 **Estimated Time**

- Phase 1 (Azure Setup): 30 minutes
- Phase 2 (Dependencies): 5 minutes
- Phase 3 (Toolkit): 20 minutes
- Phase 4 (Services): 15 minutes
- Phase 5 (Chat Endpoint): 45 minutes
- Phase 6 (Environment): 10 minutes
- Phase 7 (Testing): 30 minutes
- Phase 8 (Deployment): 20 minutes
- Phase 9 (Documentation): 15 minutes

**Total: ~3 hours**

---

## 📝 **Notes**

- Always test locally before deploying to Azure
- Keep GPT-4.1 available as a fallback
- Tool calling works best with structured data (CSV, XLSX)
- Start with simple tools before building complex ones
- Monitor token usage - tools add to context size