/**
 * Parse TXT buffer into plain text string
 * @param {Buffer} buffer - TXT file buffer
 * @returns {Promise<string>} - Extracted text content
 */
async function parseTxt(buffer) {
  try {
    // Validate buffer
    if (!buffer || !Buffer.isBuffer(buffer)) {
      throw new Error('Invalid TXT buffer provided');
    }

    if (buffer.length === 0) {
      throw new Error('Empty TXT buffer provided');
    }

    // Convert buffer to string with UTF-8 encoding
    // Handle potential encoding issues gracefully
    let text;
    try {
      text = buffer.toString('utf8');
    } catch (encodingError) {
      console.warn('UTF-8 decoding failed, trying latin1:', encodingError.message);
      try {
        text = buffer.toString('latin1');
      } catch (fallbackError) {
        console.warn('Latin1 decoding failed, using ascii:', fallbackError.message);
        text = buffer.toString('ascii');
      }
    }

    if (!text || text.trim().length === 0) {
      throw new Error('No text content found in TXT file');
    }

    // Clean up the text - normalize line breaks and remove excessive whitespace
    const cleanText = text
      .replace(/\r\n/g, '\n')     // Normalize Windows line breaks
      .replace(/\r/g, '\n')       // Normalize Mac line breaks
      .replace(/\n{3,}/g, '\n\n') // Limit consecutive line breaks to 2
      .replace(/[ \t]{2,}/g, ' ') // Replace multiple spaces/tabs with single space
      .replace(/^\s+|\s+$/gm, '') // Trim each line
      .trim();

    return cleanText;
  } catch (error) {
    console.error('TXT parsing error:', error.message);
    throw new Error(`Failed to parse TXT: ${error.message}`);
  }
}

/**
 * Format TXT content for GPT prompt
 * @param {string} text - Extracted TXT text
 * @param {string} filename - TXT filename
 * @returns {string} - Formatted content for GPT
 */
function formatTxtForPrompt(text, filename) {
  if (!text || text.trim().length === 0) {
    return `TXT file name: ${filename}\nTXT content: No text content found`;
  }

  // Count lines and characters for context
  const lines = text.split('\n').length;
  const characters = text.length;

  let formattedContent = `TXT file name: ${filename}\n`;
  formattedContent += `TXT content (${lines} lines, ${characters} characters):\n\n`;
  formattedContent += text;
  
  return formattedContent;
}

module.exports = {
  parseTxt,
  formatTxtForPrompt
};
