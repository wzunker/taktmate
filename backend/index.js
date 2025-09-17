const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { OpenAI } = require('openai');
require('dotenv').config();

const fileStore = require('./fileStore');
const { parseCsv, formatCsvForPrompt } = require('./processCsv');
const { requireAuth, optionalAuth } = require('./middleware/auth');
const { healthCheck } = require('./services/storage');
const filesRouter = require('./routes/files');

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
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:3000', 
      'http://127.0.0.1:3000',
      'https://orange-flower-0b350780f.1.azurestaticapps.net'
    ];
    
    // Allow any Azure Static Web Apps origin or the specific origins
    if (allowedOrigins.includes(origin) || origin.includes('azurestaticapps.net')) {
      return callback(null, true);
    }
    
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-ms-client-principal']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Register file management routes
app.use('/api/files', filesRouter);

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
app.get('/api/health', async (req, res) => {
  try {
    // Check storage connectivity
    const storageHealth = await healthCheck();
    
    const overallStatus = storageHealth.status === 'healthy' ? 'OK' : 'DEGRADED';
    const statusCode = overallStatus === 'OK' ? 200 : 503;
    
    res.status(statusCode).json({ 
      status: overallStatus,
      message: 'TaktMate Backend is running',
      services: {
        api: 'healthy',
        storage: storageHealth
      },
      environment: {
        nodeVersion: process.version,
        storageAccount: process.env.STORAGE_ACCOUNT_NAME || 'not configured'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Health check error:', error.message);
    res.status(503).json({
      status: 'UNHEALTHY',
      message: 'TaktMate Backend health check failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
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


// Handle preflight OPTIONS request for upload
app.options('/api/upload', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-ms-client-principal');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(200);
});

// Legacy Upload CSV endpoint (DEPRECATED - use /api/files/sas for new uploads)
app.post('/api/upload', requireAuth, upload.single('csvFile'), async (req, res) => {
  console.warn('DEPRECATED: /api/upload endpoint used. Please migrate to /api/files/sas for blob storage uploads.');
  try {
    const user = req.user; // From SWA authentication middleware
    
    if (!req.file) {
      return res.status(400).json({ error: 'No CSV file uploaded' });
    }

    const filename = req.file.originalname;
    const buffer = req.file.buffer;

    // Parse CSV
    const rows = await parseCsv(buffer);
    
    if (rows.length === 0) {
      return res.status(400).json({ error: 'CSV file is empty or invalid' });
    }

    // Generate unique file ID with user context
    const fileId = `${user.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Store in memory with user context
    fileStore.store(fileId, filename, rows, user.id);

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

// Handle preflight OPTIONS request for chat
app.options('/api/chat', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-ms-client-principal');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(200);
});

// Chat endpoint
app.post('/api/chat', requireAuth, async (req, res) => {
  try {
    const user = req.user; // From SWA authentication middleware
    
    const { fileId, message } = req.body;

    if (!fileId || !message) {
      return res.status(400).json({ error: 'fileId and message are required' });
    }

    // Retrieve CSV data
    const fileData = fileStore.get(fileId);
    if (!fileData) {
      return res.status(404).json({ error: 'File not found. Please upload a CSV file first.' });
    }

    // Basic security check: ensure user can only access their own files
    if (fileId.startsWith(user.id + '_') === false) {
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

app.listen(PORT, async () => {
  console.log(`TaktMate Backend running on port ${PORT}`);
  console.log(`Storage Account: ${process.env.STORAGE_ACCOUNT_NAME || 'NOT CONFIGURED'}`);
  
  // Test storage connectivity on startup
  try {
    const storageHealth = await healthCheck();
    console.log(`Storage connectivity: ${storageHealth.status}`);
    if (storageHealth.status !== 'healthy') {
      console.warn('WARNING: Storage service is not healthy:', storageHealth.error);
    }
  } catch (error) {
    console.error('ERROR: Failed to check storage connectivity on startup:', error.message);
  }
});