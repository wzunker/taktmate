const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { OpenAI } = require('openai');
require('dotenv').config();

const fileStore = require('./fileStore');
const { parseCsv, formatCsvForPrompt } = require('./processCsv');

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
    process.env.CORS_ORIGIN || 'https://taktmate-frontend.azurestaticapps.net'
  ].filter(Boolean),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
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
  const hasApiKey = !!process.env.OPENAI_API_KEY;
  const apiKeyLength = process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.length : 0;
  res.json({ 
    status: 'OK', 
    message: 'TaktMate Backend is running',
    debug: {
      hasApiKey,
      apiKeyLength,
      nodeEnv: process.env.NODE_ENV
    }
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

// Test OpenAI endpoint
app.get('/api/test-openai', async (req, res) => {
  try {
    console.log('Testing OpenAI connection...');
    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1',
      messages: [{ role: 'user', content: 'Say "Hello, this is a test!"' }],
      max_tokens: 50
    });
    
    res.json({
      status: 'OK',
      message: 'OpenAI connection working',
      response: completion.choices[0].message.content
    });
  } catch (error) {
    console.error('OpenAI test error:', error);
    res.status(500).json({
      status: 'ERROR',
      message: error.message,
      details: {
        status: error.status,
        code: error.code,
        type: error.type
      }
    });
  }
});

// Preflight requests
app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');
  res.sendStatus(200);
});

// Upload CSV endpoint
app.post('/api/upload', (req, res, next) => {
  console.log('Upload request received');
  console.log('Headers:', req.headers);
  next();
}, upload.single('csvFile'), async (req, res) => {
  try {
    console.log('File upload processed');
    console.log('req.file:', req.file ? 'File received' : 'No file');
    
    if (!req.file) {
      console.log('No file in request');
      return res.status(400).json({ error: 'No CSV file uploaded' });
    }

    const filename = req.file.originalname;
    const buffer = req.file.buffer;
    console.log(`Processing file: ${filename}, size: ${buffer.length} bytes`);

    // Parse CSV
    const rows = await parseCsv(buffer);
    console.log(`Parsed ${rows.length} rows`);
    
    if (rows.length === 0) {
      return res.status(400).json({ error: 'CSV file is empty or invalid' });
    }

    // Generate unique file ID
    const fileId = Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9);
    
    // Store in memory
    fileStore.store(fileId, filename, rows);
    console.log(`File stored with ID: ${fileId}`);

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
app.post('/api/chat', async (req, res) => {
  try {
    // Debug flag - set DEBUG_PROMPTS=true in environment to enable
    const DEBUG_PROMPTS = process.env.DEBUG_PROMPTS === 'true';
    
    const { fileId, message } = req.body;

    if (!fileId || !message) {
      return res.status(400).json({ error: 'fileId and message are required' });
    }

    // Retrieve CSV data
    const fileData = fileStore.get(fileId);
    if (!fileData) {
      return res.status(404).json({ error: 'File not found. Please upload a CSV file first.' });
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
      console.log('🔍 FULL PROMPT DEBUG');
      console.log('='.repeat(80));
      console.log('📋 SYSTEM MESSAGE:');
      console.log(systemPrompt);
      console.log('\n📝 USER MESSAGE:');
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
      console.log('💬 GPT RESPONSE:');
      console.log(reply);
      console.log('='.repeat(80) + '\n');
    }

    res.json({
      success: true,
      reply,
      fileId,
      filename: fileData.filename
    });

  } catch (error) {
    console.error('Chat error details:', {
      message: error.message,
      status: error.status,
      code: error.code,
      type: error.type,
      stack: error.stack
    });
    
    // More specific error messages for debugging
    let errorMessage = 'Failed to process chat message: ' + error.message;
    if (error.status === 401) {
      errorMessage += ' (Check API key and endpoint configuration)';
    } else if (error.status === 404) {
      errorMessage += ' (Check deployment name and base URL)';
    }
    
    res.status(500).json({ error: errorMessage });
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
  console.log(`🔍 Debug prompts: ${DEBUG_PROMPTS ? 'ENABLED' : 'DISABLED'} (set DEBUG_PROMPTS=true to enable)`);
});