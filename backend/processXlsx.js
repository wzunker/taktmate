const XLSX = require('xlsx');

/**
 * Parse XLSX buffer into text representation of all sheets
 * @param {Buffer} buffer - XLSX file buffer
 * @returns {Promise<string>} - Combined text content from all sheets
 */
async function parseXlsx(buffer) {
  try {
    // Validate buffer
    if (!buffer || !Buffer.isBuffer(buffer)) {
      throw new Error('Invalid XLSX buffer provided');
    }

    if (buffer.length === 0) {
      throw new Error('Empty XLSX buffer provided');
    }

    // Parse XLSX using xlsx library
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new Error('No sheets found in XLSX file');
    }

    let combinedText = '';
    let hasContent = false;

    // Process each sheet
    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      
      if (!worksheet) {
        console.warn(`Sheet "${sheetName}" is empty or could not be read`);
        continue;
      }

      // Convert sheet to CSV format
      const csvData = XLSX.utils.sheet_to_csv(worksheet);
      
      if (csvData && csvData.trim().length > 0) {
        hasContent = true;
        
        // Add sheet header
        if (combinedText.length > 0) {
          combinedText += '\n\n';
        }
        combinedText += `=== Sheet: ${sheetName} ===\n`;
        combinedText += csvData;
      }
    }

    if (!hasContent) {
      throw new Error('No data found in any sheets of the XLSX file');
    }

    return combinedText.trim();
  } catch (error) {
    console.error('XLSX parsing error:', error.message);
    throw new Error(`Failed to parse XLSX: ${error.message}`);
  }
}

/**
 * Format XLSX content for GPT prompt
 * @param {string} text - Extracted XLSX text (CSV format)
 * @param {string} filename - XLSX filename
 * @returns {string} - Formatted content for GPT
 */
function formatXlsxForPrompt(text, filename) {
  if (!text || text.trim().length === 0) {
    return `XLSX file name: ${filename}\nXLSX content: No data found`;
  }

  // Count the number of sheets
  const sheetCount = (text.match(/=== Sheet: /g) || []).length;
  
  // Count approximate rows (excluding sheet headers)
  const totalLines = text.split('\n').length;
  const approxDataRows = totalLines - (sheetCount * 2); // Subtract sheet headers

  let formattedContent = `XLSX file name: ${filename}\n`;
  formattedContent += `XLSX content (${sheetCount} sheet${sheetCount !== 1 ? 's' : ''}, ~${Math.max(0, approxDataRows)} data rows):\n\n`;
  formattedContent += text;
  
  return formattedContent;
}

module.exports = {
  parseXlsx,
  formatXlsxForPrompt
};
