const pdf = require('pdf-parse');

/**
 * Parse PDF buffer into plain text string
 * @param {Buffer} buffer - PDF file buffer
 * @returns {Promise<string>} - Extracted text content
 */
async function parsePdf(buffer) {
  try {
    // Validate buffer
    if (!buffer || !Buffer.isBuffer(buffer)) {
      throw new Error('Invalid PDF buffer provided');
    }

    if (buffer.length === 0) {
      throw new Error('Empty PDF buffer provided');
    }

    // Parse PDF using pdf-parse
    const data = await pdf(buffer);
    
    if (!data.text || data.text.trim().length === 0) {
      throw new Error('No text content found in PDF');
    }

    return data.text.trim();
  } catch (error) {
    console.error('PDF parsing error:', error.message);
    throw new Error(`Failed to parse PDF: ${error.message}`);
  }
}

/**
 * Format PDF content for GPT prompt
 * @param {string} text - Extracted PDF text
 * @param {string} filename - PDF filename
 * @returns {string} - Formatted content for GPT
 */
function formatPdfForPrompt(text, filename) {
  if (!text || text.trim().length === 0) {
    return `PDF file name: ${filename}\nPDF content: No text content found`;
  }

  // Clean up the text - remove excessive whitespace and normalize line breaks
  const cleanText = text
    .replace(/\r\n/g, '\n')  // Normalize line breaks
    .replace(/\r/g, '\n')    // Normalize line breaks
    .replace(/\n{3,}/g, '\n\n') // Limit consecutive line breaks to 2
    .replace(/[ \t]{2,}/g, ' ') // Replace multiple spaces/tabs with single space
    .trim();

  let formattedContent = `PDF file name: ${filename}\n`;
  formattedContent += `PDF content (${cleanText.length} characters):\n\n`;
  formattedContent += cleanText;
  
  return formattedContent;
}

module.exports = {
  parsePdf,
  formatPdfForPrompt
};
