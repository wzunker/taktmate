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
      
      // Only load files that are actual tools (have name, description, parameters, execute)
      if (tool.name && tool.description && tool.parameters && tool.execute) {
        // Convert tool definition to OpenAI function format
        tools.push({
          type: 'function',
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters
          }
        });
      } else {
        console.log(`⏭️  Skipping non-tool file: ${file}`);
      }
    }
  }
  
  console.log(`✅ Loaded ${tools.length} tools:`, tools.map(t => t.function.name).join(', '));
  return tools;
}

/**
 * Get a specific tool by name and execute it
 * @param {string} toolName - Name of the tool to execute
 * @param {object} args - Arguments to pass to the tool
 * @param {string} userId - User ID for file access and isolation
 * @returns {Promise<object>} Tool execution result
 */
async function executeTool(toolName, args, userId) {
  const toolsDir = __dirname;
  const files = fs.readdirSync(toolsDir);
  
  for (const file of files) {
    if (file.endsWith('.js') && file !== 'index.js') {
      const tool = require(path.join(toolsDir, file));
      if (tool.name === toolName) {
        // Inject userId into args for user isolation
        const argsWithUserId = { ...args, userId };
        console.log(`🔒 Injecting userId into ${toolName} for user isolation`);
        return await tool.execute(argsWithUserId);
      }
    }
  }
  
  throw new Error(`Tool "${toolName}" not found`);
}

module.exports = {
  loadTools,
  executeTool
};

