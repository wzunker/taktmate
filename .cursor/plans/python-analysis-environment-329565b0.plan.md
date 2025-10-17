<!-- 329565b0-f880-4a45-946e-90750dadd546 2d5d147d-d483-4ac5-8ba0-1aa072dd7d6f -->
# Python Analysis Environment Implementation Plan

## Overview

Replace the current collection of individual computational tools with a single, powerful Python code execution environment that lets GPT-5-mini write and run arbitrary analysis code tailored to each user question.

## Architecture

### System Components

- **Python Worker Service** (FastAPI): Manages Jupyter kernels, executes code, returns results
- **Kernel Pool Manager**: Maintains stateful Python sessions per conversation (30-min idle timeout)
- **Node.js Backend Integration**: New `run_python` tool that routes execution requests to worker
- **Docker Container**: Isolated environment with pandas, numpy, matplotlib, scipy, scikit-learn, seaborn, plotly
- **File Bridge**: Downloads user files from Blob Storage via SAS tokens into Python environment
- **Resource Governor**: CPU/memory/time limits, no internet access

### Deployment Target

Azure Container Apps (preferred) or Azure App Service (Linux containers)

## Phase 1: Python Worker Service

### 1.1 Create FastAPI Worker Application

Create `/backend/python-worker/` directory structure:

```
python-worker/
├── Dockerfile
├── requirements.txt
├── main.py              # FastAPI app
├── kernel_manager.py    # Jupyter kernel lifecycle
├── executor.py          # Code execution with safety checks
├── file_loader.py       # Downloads files via SAS tokens
└── config.py            # Environment config
```

**main.py** - FastAPI endpoints:

- `POST /execute` - Execute Python code in session
- `POST /load_file` - Load file from Blob Storage into session
- `GET /session/{session_id}/status` - Check session health
- `DELETE /session/{session_id}` - Cleanup session
- `GET /health` - Health check

**kernel_manager.py** - Session lifecycle:

- Create isolated Jupyter kernel per `conversationId`
- 30-minute idle timeout with automatic cleanup
- Track active sessions in memory (consider Redis for scale)
- Graceful shutdown handling

**executor.py** - Safe code execution:

- Execute code in kernel, capture stdout/stderr
- Timeout enforcement (30 seconds default)
- Exception handling with full traceback
- Result serialization (JSON for tables, base64 for plots)
- Sanity checks: validate numeric ranges, non-empty results

**file_loader.py** - Blob Storage integration:

- Accept SAS URL from Node.js backend
- Download file to `/tmp/session_{id}/`
- Load CSV/XLSX into pandas DataFrame
- Make available in kernel globals as `df`, `df_filename`

### 1.2 Create Dockerfile

```dockerfile
FROM python:3.11-slim

# Security: Run as non-root user
RUN useradd -m -u 1000 pyworker
USER pyworker
WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Disable internet access (handled by container network policy)
# Resource limits (handled by container runtime)

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**requirements.txt**:

```
fastapi==0.109.0
uvicorn[standard]==0.27.0
jupyter-client==8.6.0
ipykernel==6.29.0
pandas==2.2.0
numpy==1.26.3
matplotlib==3.8.2
scipy==1.12.0
scikit-learn==1.4.0
seaborn==0.13.1
plotly==5.18.0
openpyxl==3.1.2
requests==2.31.0
```

### 1.3 Implement Security Controls

- Container network isolation: No outbound internet
- Resource limits in deployment config:
        - CPU: 1 core
        - Memory: 2GB
        - Storage: 1GB ephemeral
- Code execution timeout: 30 seconds per run
- File size validation: Max 100MB per file
- No filesystem access outside `/tmp/session_*`

## Phase 2: Backend Integration

### 2.1 Create Python Worker Client Service

Create `/backend/services/pythonWorkerService.js`:

```javascript
const axios = require('axios');
const { generateBlobSASUrl } = require('./storage');

const PYTHON_WORKER_URL = process.env.PYTHON_WORKER_URL || 'http://localhost:8000';
const EXECUTION_TIMEOUT = 35000; // 35s (worker timeout is 30s)

class PythonWorkerService {
  async executeCode(conversationId, code, userId) {
    // Sends code to worker, returns result or error
  }
  
  async loadFileIntoSession(conversationId, filename, userId) {
    // Generate SAS URL for file
    // Tell worker to download and load into kernel
    // Returns schema preview (columns, types, row count)
  }
  
  async getSessionStatus(conversationId) {
    // Check if session is alive
  }
  
  async cleanupSession(conversationId) {
    // Explicit session cleanup
  }
}
```

Key methods:

- `executeCode()`: POST to `/execute` with session ID, code, return result
- `loadFileIntoSession()`: Generate SAS URL, POST to `/load_file`, preload DataFrame
- `getSessionStatus()`: Health check for session
- `cleanupSession()`: Called when conversation ends or timeout

### 2.2 Create `run_python` Tool

Create `/backend/toolkit/runPython.js`:

```javascript
module.exports = {
  name: 'run_python',
  description: 'Execute Python code for data analysis. Use pandas (df), numpy (np), matplotlib (plt). Files are pre-loaded as DataFrames. Return results as JSON or plot data.',
  
  parameters: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'Python code to execute. Use df for the loaded DataFrame.'
      },
      filename: {
        type: 'string',
        description: 'Optional: specific file to load if not already loaded'
      }
    },
    required: ['code']
  },
  
  execute: async ({ code, filename, userId, conversationId }) => {
    const pythonWorker = new PythonWorkerService();
    
    // Load file if specified
    if (filename) {
      await pythonWorker.loadFileIntoSession(conversationId, filename, userId);
    }
    
    // Execute code
    const result = await pythonWorker.executeCode(conversationId, code, userId);
    
    return {
      success: true,
      result: result.output,
      stdout: result.stdout,
      stderr: result.stderr,
      execution_time_ms: result.execution_time
    };
  }
};
```

Tool description optimization (under 1024 chars):

- "Execute Python code on uploaded data files. Pre-loaded libraries: pandas (df), numpy (np), matplotlib (plt), scipy, sklearn, seaborn, plotly. Files auto-loaded as DataFrames. Return computation results, statistics, or plot data."

### 2.3 Update Tool Loader for Context Injection

Modify `/backend/toolkit/index.js` to inject `conversationId`:

```javascript
async function executeTool(toolName, args, userId, conversationId) {
  // Inject both userId and conversationId for session isolation
  const argsWithContext = { ...args, userId, conversationId };
  // ... execute tool
}
```

Update `/backend/index.js` chat endpoint to pass `conversationId` to `executeTool()`.

### 2.4 Deprecate Old Tools

Comment out or remove these files (keep for reference initially):

- `computeAvgCountSumMinMaxMedian.js`
- `filterNumeric.js`
- `createPlot.js`

Keep `dataLoader.js` as reference but functionality moves to Python worker.

## Phase 3: Deployment Configuration

### 3.1 Azure Container Apps Setup

Create `python-worker-containerapp.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: taktmate-python-worker
spec:
  replicas: 2
  template:
    spec:
      containers:
      - name: python-worker
        image: taktmate.azurecr.io/python-worker:latest
        resources:
          limits:
            cpu: "1000m"
            memory: "2Gi"
          requests:
            cpu: "500m"
            memory: "1Gi"
        env:
        - name: SESSION_TIMEOUT_MINUTES
          value: "30"
        - name: MAX_EXECUTION_TIME_SECONDS
          value: "30"
        ports:
        - containerPort: 8000
```

Network policy (no internet):

```yaml
egress:
  - to:
    - namespaceSelector: {}
  # No external egress allowed
```

### 3.2 Azure Container Registry

Build and push Docker image:

```bash
cd backend/python-worker
az acr build --registry taktmate --image python-worker:latest .
```

### 3.3 Backend Environment Variables

Add to App Service configuration:

```
PYTHON_WORKER_URL=https://taktmate-python-worker.azurecontainerapps.io
SESSION_TIMEOUT_MINUTES=30
ENABLE_PYTHON_EXECUTION=true
```

Local development (`.env`):

```
PYTHON_WORKER_URL=http://localhost:8000
```

## Phase 4: Session Lifecycle Management

### 4.1 Automatic Session Cleanup

Implement in `kernel_manager.py`:

- Track last activity timestamp per session
- Background task runs every 5 minutes
- Kill idle sessions > 30 minutes
- Log cleanup events for monitoring

### 4.2 Conversation End Hook

Add to `/backend/routes/conversations.js`:

```javascript
// DELETE /api/conversations/:id
router.delete('/:conversationId', async (req, res) => {
  const conversationId = req.params.conversationId;
  
  // Cleanup Python session if exists
  await pythonWorkerService.cleanupSession(conversationId);
  
  // Delete from Cosmos DB
  await cosmosService.deleteConversation(conversationId);
  
  res.json({ success: true });
});
```

### 4.3 User Logout Hook

In `/backend/index.js`, add cleanup on logout:

```javascript
app.post('/api/logout', requireAuth, async (req, res) => {
  const userId = req.user.oid;
  
  // Cleanup all user sessions
  await pythonWorkerService.cleanupUserSessions(userId);
  
  res.json({ success: true });
});
```

## Phase 5: Error Handling & Retries

### 5.1 Execution Error Handling

In `executor.py`:

- Capture full traceback for syntax/runtime errors
- Return structured error response:
  ```json
  {
    "success": false,
    "error": "NameError: name 'salary' is not defined",
    "error_type": "NameError",
    "traceback": "...",
    "suggestion": "Did you mean 'Salary' (case-sensitive)?"
  }
  ```


### 5.2 Auto-Retry Logic

In `runPython.js`:

- If execution fails with common errors, GPT can retry with corrected code
- Don't implement auto-retry in tool - let GPT-5-mini see the error and fix it
- This is a feature: GPT learns from errors

### 5.3 Sanity Checks

In `executor.py`, validate results before returning:

- Numeric results: Check for NaN, Inf, extreme outliers
- DataFrame results: Check not empty, schema makes sense
- Plot data: Verify data points exist
- Return warnings (not errors) for suspicious results

Example:

```python
if result is not None and isinstance(result, float):
    if math.isnan(result) or math.isinf(result):
        return {"warning": "Computation resulted in NaN or Inf"}
```

## Phase 6: Frontend Updates

### 6.1 Add Python Execution Status UI

Update `/frontend/src/components/ChatBox.jsx`:

- Show "Python executing..." indicator when tool is called
- Display execution time in message metadata
- Option to view full stdout/stderr in expandable section
- Show warning icon if sanity check flagged something

### 6.2 Code Snippet Display

When GPT uses `run_python`, display:

```
🐍 Python Analysis
Code: [expandable code block]
Result: [formatted output]
Execution time: 1.2s
```

### 6.3 Chart Rendering

If Python returns plot data (base64 PNG):

- Use `ChartDisplay.jsx` component (already exists)
- Detect base64 image data in result
- Render inline in chat

## Phase 7: Testing Strategy

### 7.1 Unit Tests

- `test_kernel_manager.py`: Session creation, timeout, cleanup
- `test_executor.py`: Code execution, error handling, timeouts
- `test_file_loader.py`: SAS URL download, DataFrame loading

### 7.2 Integration Tests

Create `/tests/python-execution/`:

- Test data loading from Blob Storage
- Test stateful execution (multiple queries in session)
- Test resource limits (CPU, memory, timeout)
- Test error recovery and retry
- Test session cleanup

Test cases:

1. Load CSV → compute mean → verify result
2. Load XLSX → filter data → create plot
3. Multiple files in one session
4. Session persistence across queries
5. Timeout enforcement (intentionally slow code)
6. Invalid code handling
7. Session cleanup after 30min idle

### 7.3 Load Testing

- Simulate 10 concurrent users with active sessions
- Verify container auto-scaling
- Test session isolation (users can't access each other's data)

## Phase 8: Monitoring & Observability

### 8.1 Application Insights Integration

Instrument Python worker with Azure Monitor:

- Track execution times per code run
- Log errors and exceptions
- Monitor active session count
- Track memory/CPU usage per container

### 8.2 Key Metrics

- `python.execution.duration_ms` - Histogram of execution times
- `python.session.active_count` - Gauge of live sessions
- `python.execution.errors` - Counter of failed executions
- `python.session.timeouts` - Counter of idle cleanups

### 8.3 Alerting Rules

- Alert if error rate > 10% in 5 minutes
- Alert if average execution time > 20s
- Alert if no capacity for new sessions

## Phase 9: Documentation

### 9.1 Update README

Add section: "Python Analysis Environment"

- Explain code execution capabilities
- Show example queries that trigger Python
- Note security measures

### 9.2 Create Python Worker README

`/backend/python-worker/README.md`:

- Architecture overview
- Local development setup
- Running worker standalone
- Adding new Python libraries
- Debugging sessions

### 9.3 Update User Guide

Document Python capabilities:

- "Ask me to analyze data and I'll write Python code"
- Examples: correlations, statistics, visualizations
- Note: pre-loaded libraries available

## Phase 10: Migration Path

### 10.1 Feature Flag

Add environment variable `ENABLE_PYTHON_EXECUTION`:

- `true`: Use new `run_python` tool
- `false`: Use legacy tools

This allows testing in production without fully switching.

### 10.2 Gradual Rollout

1. Deploy Python worker to staging
2. Test with internal users (ENABLE_PYTHON_EXECUTION=true)
3. Monitor errors and performance
4. Gradually enable for 10% → 50% → 100% of users
5. Deprecate old tools after 2 weeks of stable operation

### 10.3 Rollback Plan

If critical issues arise:

- Set `ENABLE_PYTHON_EXECUTION=false`
- System reverts to legacy tools
- Fix Python worker issues
- Redeploy when ready

## Success Criteria

1. User uploads CSV with sales data
2. User asks: "What's the correlation between price and quantity? Show me a scatter plot."
3. GPT-5-mini calls `run_python` with pandas/matplotlib code
4. Python worker executes in isolated container
5. Returns correlation coefficient and plot data
6. GPT responds with natural language + rendered chart
7. Entire flow completes in < 5 seconds
8. Session persists for follow-up questions
9. Auto-cleanup after 30 minutes of inactivity
10. All execution isolated, secure, and monitored

## Estimated Timeline

- Phase 1 (Python Worker): 2 days
- Phase 2 (Backend Integration): 1 day
- Phase 3 (Deployment): 1 day
- Phase 4 (Session Management): 0.5 days
- Phase 5 (Error Handling): 0.5 days
- Phase 6 (Frontend): 1 day
- Phase 7 (Testing): 1 day
- Phase 8 (Monitoring): 0.5 days
- Phase 9 (Documentation): 0.5 days
- Phase 10 (Migration): 0.5 days

**Total: 8.5 days** (developer time)

### To-dos

- [ ] Create Python Worker FastAPI service with kernel management, code execution, and file loading
- [ ] Build Docker container with Python environment, dependencies, and security controls
- [ ] Create pythonWorkerService.js and run_python tool, integrate with existing toolkit system
- [ ] Implement session lifecycle with 30-min timeout, cleanup hooks, and conversation-based isolation
- [ ] Deploy to Azure Container Apps with network isolation, resource limits, and auto-scaling
- [ ] Add robust error handling, sanity checks, and execution validation
- [ ] Add Python execution status UI, code snippet display, and chart rendering
- [ ] Create comprehensive test suite for Python execution, session management, and security
- [ ] Integrate Application Insights, add metrics, and configure alerting
- [ ] Update README, create Python Worker documentation, and user guides