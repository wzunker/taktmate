const express = require('express');
const cors = require('cors');
const { OpenAI } = require('openai');
require('dotenv').config();

const { parseCsv, formatCsvForPrompt } = require('./processCsv');
const { requireAuth } = require('./middleware/auth');
const { healthCheck, getBlobContent, listUserFiles } = require('./services/storage');
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

// Security headers middleware
app.use((req, res, next) => {
  // Security headers for all responses
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // Add blob storage domain to CSP for direct uploads/downloads
  const blobStorageDomain = `https://${process.env.STORAGE_ACCOUNT_NAME || 'taktmateblob'}.blob.core.windows.net`;
  res.setHeader('Content-Security-Policy', 
    `default-src 'self'; ` +
    `connect-src 'self' ${blobStorageDomain} https://taktmate.openai.azure.com; ` +
    `script-src 'self' 'unsafe-inline'; ` +
    `style-src 'self' 'unsafe-inline'; ` +
    `img-src 'self' data:; ` +
    `font-src 'self'; ` +
    `object-src 'none'; ` +
    `base-uri 'self';`
  );
  
  next();
});

// Register file management routes
app.use('/api/files', filesRouter);

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



// Handle preflight OPTIONS request for chat
app.options('/api/chat', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-ms-client-principal');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(200);
});

// Chat endpoint - blob storage only
app.post('/api/chat', requireAuth, async (req, res) => {
  try {
    const user = req.user; // From SWA authentication middleware
    
    const { fileName, message } = req.body;

    if (!fileName || !message) {
      return res.status(400).json({ 
        error: 'fileName and message are required',
        message: 'Please provide the name of the CSV file you want to chat with'
      });
    }

    console.log(`Chat request from user ${user.id} for file: ${fileName}`);
    
    // Verify user has access to this file
    const userFiles = await listUserFiles(user.id);
    const fileExists = userFiles.find(file => file.name === fileName);
    
    if (!fileExists) {
      return res.status(404).json({ 
        error: 'File not found', 
        message: `File '${fileName}' does not exist in your storage. Please upload the file first using the file upload feature.` 
      });
    }

    // Get blob content and parse CSV
    const blobBuffer = await getBlobContent(user.id, fileName);
    const csvRows = await parseCsv(blobBuffer);
    
    if (!csvRows || csvRows.length === 0) {
      return res.status(400).json({ 
        error: 'CSV file is empty or invalid',
        message: 'The CSV file could not be parsed or contains no data'
      });
    }

    // Format CSV data for GPT prompt
    const csvString = formatCsvForPrompt(csvRows, fileName);

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
      fileName: fileName
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
  console.error('Application error:', error.message);
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