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

