const mammoth = require('mammoth');

/**
 * Parse DOCX buffer into plain text string
 * @param {Buffer} buffer - DOCX file buffer
 * @returns {Promise<string>} - Extracted text content
 */
async function parseDocx(buffer) {
  try {
    // Validate buffer
    if (!buffer || !Buffer.isBuffer(buffer)) {
      throw new Error('Invalid DOCX buffer provided');
    }

    if (buffer.length === 0) {
      throw new Error('Empty DOCX buffer provided');
    }

    // Parse DOCX using mammoth - extract to HTML first then convert to text
    const result = await mammoth.extractRawText(buffer);
    
    if (result.messages && result.messages.length > 0) {
      console.warn('DOCX parsing warnings:', result.messages.map(m => m.message));
    }

    if (!result.value || result.value.trim().length === 0) {
      throw new Error('No text content found in DOCX');
    }

    return result.value.trim();
  } catch (error) {
    console.error('DOCX parsing error:', error.message);
    throw new Error(`Failed to parse DOCX: ${error.message}`);
  }
}

/**
 * Format DOCX content for GPT prompt
 * @param {string} text - Extracted DOCX text
 * @param {string} filename - DOCX filename
 * @returns {string} - Formatted content for GPT
 */
function formatDocxForPrompt(text, filename) {
  if (!text || text.trim().length === 0) {
    return `DOCX file name: ${filename}\nDOCX content: No text content found`;
  }

  // Clean up the text - preserve paragraph structure but normalize spacing
  const cleanText = text
    .replace(/\r\n/g, '\n')  // Normalize line breaks
    .replace(/\r/g, '\n')    // Normalize line breaks
    .replace(/\n{3,}/g, '\n\n') // Limit consecutive line breaks to 2
    .replace(/[ \t]{2,}/g, ' ') // Replace multiple spaces/tabs with single space
    .replace(/^\s+|\s+$/gm, '') // Trim each line
    .trim();

  let formattedContent = `DOCX file name: ${filename}\n`;
  formattedContent += `DOCX content (${cleanText.length} characters):\n\n`;
  formattedContent += cleanText;
  
  return formattedContent;
}

module.exports = {
  parseDocx,
  formatDocxForPrompt
};
