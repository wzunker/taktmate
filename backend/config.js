// Azure OpenAI Configuration
// If you want to use environment variables, create a .env file with these values:

module.exports = {
  // Azure OpenAI Settings
  AZURE_OPENAI_API_KEY: process.env.OPENAI_API_KEY || 'BT4uTZtbBEx9a6ulvMS4w9m8qmJsZPl0lIosOOCu2dOsn2G1DLH5JQQJ99BHACYeBjFXJ3w3AAABACOGB5lu',
  AZURE_OPENAI_ENDPOINT: 'https://taktmate.openai.azure.com/openai/deployments/gpt-4.1',
  AZURE_OPENAI_API_VERSION: '2025-01-01-preview',
  AZURE_OPENAI_DEPLOYMENT_NAME: 'gpt-4.1',
  
  // Server Settings
  PORT: process.env.PORT || 5000,
  
  // Application Settings
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  MAX_TOKENS: 500,
  TEMPERATURE: 0.1
};
