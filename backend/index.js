const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { OpenAI } = require('openai');
require('dotenv').config();

const fileStore = require('./fileStore');
const { parseCsv, formatCsvForPrompt } = require('./processCsv');
const { requireAuth, optionalAuth } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Azure OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: 'https://taktmate.openai.azure.com/openai/deployments/gpt-4.1',
  defaultQuery: { 'api-version': '2025-01-01-preview' },
  defaultHeaders: {
    'api-key': process.env.OPENAI_API_KEY,
  },
});

// Middleware
app.use(cors({
  origin: [
    'http://localhost:3000', 
    'http://127.0.0.1:3000',
    process.env.CORS_ORIGIN || 'https://orange-flower-0b350780f.1.azurestaticapps.net'
  ].filter(Boolean),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-ms-client-principal']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Configure multer for file uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed!'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK',
    message: 'TaktMate Backend is running',
    timestamp: new Date().toISOString()
  });
});

// Debug endpoint to inspect headers and auth state
app.get('/api/debug-auth', (req, res) => {
  const clientPrincipalHeader = req.headers['x-ms-client-principal'];
  let parsedPrincipal = null;
  
  if (clientPrincipalHeader) {
    try {
      const decoded = Buffer.from(clientPrincipalHeader, 'base64').toString('utf8');
      parsedPrincipal = JSON.parse(decoded);
    } catch (e) {
      parsedPrincipal = { error: 'Failed to parse client principal', raw: clientPrincipalHeader };
    }
  }

  res.json({
    timestamp: new Date().toISOString(),
    headers: {
      'x-ms-client-principal': clientPrincipalHeader ? 'Present' : 'Missing',
      'x-forwarded-host': req.headers['x-forwarded-host'],
      'x-forwarded-proto': req.headers['x-forwarded-proto'],
      'user-agent': req.headers['user-agent'],
      'cookie': req.headers.cookie ? 'Present' : 'Missing'
    },
    clientPrincipal: parsedPrincipal,
    requestInfo: {
      method: req.method,
      url: req.url,
      originalUrl: req.originalUrl,
      ip: req.ip,
      ips: req.ips
    }
  });
});

// In-memory storage for debug logs
const debugLogs = [];
const MAX_DEBUG_LOGS = 1000;

// Endpoint to receive debug logs from frontend
app.post('/api/debug-log', (req, res) => {
  try {
    const logEntry = {
      ...req.body,
      serverTimestamp: new Date().toISOString(),
      clientIP: req.ip,
      userAgent: req.headers['user-agent']
    };

    // Add to in-memory storage
    debugLogs.push(logEntry);
    
    // Keep only last N entries
    if (debugLogs.length > MAX_DEBUG_LOGS) {
      debugLogs.splice(0, debugLogs.length - MAX_DEBUG_LOGS);
    }

    // Log to server console
    console.log(`🔍 AUTH_DEBUG [${logEntry.event}]:`, logEntry);

    res.json({ status: 'logged', timestamp: logEntry.serverTimestamp });
  } catch (error) {
    console.error('Error processing debug log:', error);
    res.status(500).json({ error: 'Failed to process log' });
  }
});

// Endpoint to retrieve all debug logs
app.get('/api/debug-logs', (req, res) => {
  res.json({
    logs: debugLogs,
    count: debugLogs.length,
    timestamp: new Date().toISOString()
  });
});

// Endpoint to clear debug logs
app.delete('/api/debug-logs', (req, res) => {
  const clearedCount = debugLogs.length;
  debugLogs.length = 0;
  res.json({
    message: 'Debug logs cleared',
    clearedCount,
    timestamp: new Date().toISOString()
  });
});

// Test upload endpoint
app.get('/api/test', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Backend is working',
    cors: 'enabled',
    timestamp: new Date().toISOString()
  });
});

// Preflight requests
app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');
  res.sendStatus(200);
});

// Upload CSV endpoint
app.post('/api/upload', requireAuth, upload.single('csvFile'), async (req, res) => {
  try {
    const user = req.user; // From SWA authentication middleware
    console.log(`File upload request from user: ${user.email} (ID: ${user.id})`);
    console.log('req.file:', req.file ? 'File received' : 'No file');
    
    if (!req.file) {
      console.log('No file in request');
      return res.status(400).json({ error: 'No CSV file uploaded' });
    }

    const filename = req.file.originalname;
    const buffer = req.file.buffer;
    console.log(`Processing file: ${filename}, size: ${buffer.length} bytes for user ${user.email}`);

    // Parse CSV
    const rows = await parseCsv(buffer);
    console.log(`Parsed ${rows.length} rows`);
    
    if (rows.length === 0) {
      return res.status(400).json({ error: 'CSV file is empty or invalid' });
    }

    // Generate unique file ID with user context
    const fileId = `${user.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Store in memory with user context
    fileStore.store(fileId, filename, rows, user.id);
    console.log(`File stored with ID: ${fileId} for user ${user.email}`);

    res.json({
      success: true,
      fileId,
      filename,
      rowCount: rows.length,
      headers: Object.keys(rows[0]),
      data: rows.slice(0, 50) // Send first 50 rows for display
    });

  } catch (error) {
    console.error('Upload error:', error);
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 5MB.' });
    }
    res.status(500).json({ error: 'Failed to process CSV file: ' + error.message });
  }
});

// Chat endpoint
app.post('/api/chat', requireAuth, async (req, res) => {
  try {
    const user = req.user; // From SWA authentication middleware
    
    // Debug flag - set DEBUG_PROMPTS=true in environment to enable
    const DEBUG_PROMPTS = process.env.DEBUG_PROMPTS === 'true';
    
    const { fileId, message } = req.body;

    if (!fileId || !message) {
      return res.status(400).json({ error: 'fileId and message are required' });
    }

    console.log(`Chat request from user: ${user.email} for file: ${fileId}`);

    // Retrieve CSV data
    const fileData = fileStore.get(fileId);
    if (!fileData) {
      return res.status(404).json({ error: 'File not found. Please upload a CSV file first.' });
    }

    // Basic security check: ensure user can only access their own files
    if (fileId.startsWith(user.id + '_') === false) {
      console.log(`Access denied: User ${user.email} attempted to access file ${fileId}`);
      return res.status(403).json({ error: 'Access denied. You can only chat with your own uploaded files.' });
    }

    // Format CSV data for GPT prompt
    const csvString = formatCsvForPrompt(fileData.rows, fileData.filename);

    // Create system prompt
    const systemPrompt = `You are a CSV data assistant.
      Rules:
      - Only use the provided CSV data. Do not infer or add outside knowledge.
      - If the answer is not in the CSV, reply exactly: "No relevant data found."
      - Respond with the most direct and concise answer possible. 
      - Output only the specific value(s) requested (e.g., IDs,names, number, percentage), not entire rows or extra fields, unless the question explicitly asks for them.
      - For lists, output only the relevant items, one per line or in a comma-separated list, without extra commentary.
      - For numeric answers, return the number with units.
      - Never explain your reasoning or provide additional context.

${csvString}`;

    // DEBUG: Log the full prompt if debug mode is enabled
    if (DEBUG_PROMPTS) {
      console.log('\n' + '='.repeat(80));
      console.log('FULL PROMPT DEBUG');
      console.log('='.repeat(80));
      console.log(`User: ${user.email} (${user.id})`);
      console.log(`File: ${fileData.filename} (${fileId})`);
      console.log('SYSTEM MESSAGE:');
      console.log(systemPrompt);
      console.log('\nUSER MESSAGE:');
      console.log(message);
      console.log('='.repeat(80) + '\n');
    }

    // Call Azure OpenAI GPT-4.1
    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1', // This matches your Azure deployment name
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ],
      max_tokens: 500,
      temperature: 0.1
    });

    const reply = completion.choices[0].message.content;

    // DEBUG: Log the response if debug mode is enabled
    if (DEBUG_PROMPTS) {
      console.log('GPT RESPONSE:');
      console.log(reply);
      console.log('='.repeat(80) + '\n');
    }

    console.log(`Chat response sent to user: ${user.email}`);

    res.json({
      success: true,
      reply,
      fileId,
      filename: fileData.filename
    });

  } catch (error) {
    console.error(`Chat error for user ${req.user?.email || 'unknown'}:`, error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to process chat message. Please try again.' 
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 5MB.' });
    }
  }
  res.status(500).json({ error: error.message });
});

app.listen(PORT, () => {
  console.log(`TaktMate Backend running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Note: Using port ${PORT} because port 5000 is used by macOS AirPlay`);
  
  // Show debug status on startup
  const DEBUG_PROMPTS = process.env.DEBUG_PROMPTS === 'true';
  console.log(`Debug prompts: ${DEBUG_PROMPTS ? 'ENABLED' : 'DISABLED'} (set DEBUG_PROMPTS=true to enable)`);
});