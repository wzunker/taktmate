// Azure OpenAI Configuration
// If you want to use environment variables, create a .env file with these values:

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
