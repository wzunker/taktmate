/**
 * Data Loading Helper for Tool Execution
 * 
 * Provides centralized file loading and parsing for data analysis tools.
 * Supports CSV and XLSX files with caching for performance.
 */

const { getBlobContent } = require('../services/storage');
const { parseCsv } = require('../processCsv');
const XLSX = require('xlsx');

// Module-level cache for parsed file data
// Key format: `${userId}_${filename}`
const fileCache = new Map();

/**
 * Get file extension from filename
 * @param {string} filename - Name of the file
 * @returns {string} File extension in lowercase (without dot)
 */
function getFileExtension(filename) {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) return '';
  return filename.slice(lastDot + 1).toLowerCase();
}

/**
 * Parse XLSX buffer into array of objects
 * @param {Buffer} buffer - XLSX file buffer
 * @returns {Array<Object>} Array of row objects
 */
function parseXlsxToArray(buffer) {
  try {
    // Parse XLSX file
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new Error('No sheets found in XLSX file');
    }
    
    // Get first sheet (most common case)
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    
    if (!worksheet) {
      throw new Error(`Sheet "${firstSheetName}" could not be read`);
    }
    
    // Convert sheet to JSON array
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    if (!data || data.length === 0) {
      throw new Error('No data found in XLSX sheet');
    }
    
    return data;
  } catch (error) {
    throw new Error(`Failed to parse XLSX to array: ${error.message}`);
  }
}

/**
 * Load and parse file data from blob storage
 * @param {string} userId - User ID for file isolation
 * @param {string} filename - Name of the file to load
 * @returns {Promise<Array<Object>>} Parsed data as array of objects
 */
async function loadFileData(userId, filename) {
  try {
    // Validate inputs
    if (!userId || typeof userId !== 'string') {
      throw new Error('Valid userId is required');
    }
    
    if (!filename || typeof filename !== 'string') {
      throw new Error('Valid filename is required');
    }
    
    // Check cache first
    const cacheKey = `${userId}_${filename}`;
    if (fileCache.has(cacheKey)) {
      console.log(`Cache hit for ${filename} (user: ${userId})`);
      return fileCache.get(cacheKey);
    }
    
    console.log(`Loading file data: ${filename} for user: ${userId}`);
    
    // Get file content from blob storage
    const buffer = await getBlobContent(userId, filename);
    
    // Determine file type and parse accordingly
    const extension = getFileExtension(filename);
    let parsedData;
    
    switch (extension) {
      case 'csv':
        parsedData = await parseCsv(buffer);
        break;
        
      case 'xlsx':
      case 'xls':
        parsedData = parseXlsxToArray(buffer);
        break;
        
      default:
        throw new Error(
          `Unsupported file type: ${extension}. ` +
          `Data tools only support CSV and XLSX files.`
        );
    }
    
    // Validate parsed data
    if (!Array.isArray(parsedData) || parsedData.length === 0) {
      throw new Error(`No data found in file: ${filename}`);
    }
    
    // Cache the parsed data
    fileCache.set(cacheKey, parsedData);
    console.log(`Cached ${parsedData.length} rows for ${filename}`);
    
    return parsedData;
  } catch (error) {
    console.error(`Failed to load file data for ${filename}:`, error.message);
    throw new Error(`File loading failed: ${error.message}`);
  }
}

/**
 * Extract a specific column from data array
 * @param {Array<Object>} data - Array of row objects
 * @param {string} fieldName - Name of the field/column to extract
 * @returns {Array} Array of values from specified column
 */
function extractColumn(data, fieldName) {
  try {
    // Validate inputs
    if (!Array.isArray(data)) {
      throw new Error('Data must be an array');
    }
    
    if (data.length === 0) {
      throw new Error('Data array is empty');
    }
    
    if (!fieldName || typeof fieldName !== 'string') {
      throw new Error('Valid fieldName is required');
    }
    
    // Check if field exists in first row
    const firstRow = data[0];
    if (!(fieldName in firstRow)) {
      // Try to find similar field names for better error message
      const availableFields = Object.keys(firstRow);
      const similar = availableFields.find(field => 
        field.toLowerCase() === fieldName.toLowerCase()
      );
      
      if (similar) {
        throw new Error(
          `Field "${fieldName}" not found. Did you mean "${similar}"? ` +
          `Available fields: ${availableFields.join(', ')}`
        );
      }
      
      throw new Error(
        `Field "${fieldName}" not found. ` +
        `Available fields: ${availableFields.join(', ')}`
      );
    }
    
    // Extract column values
    const columnData = data.map(row => row[fieldName]);
    
    console.log(`Extracted ${columnData.length} values from field: ${fieldName}`);
    return columnData;
  } catch (error) {
    console.error(`Failed to extract column ${fieldName}:`, error.message);
    throw new Error(`Column extraction failed: ${error.message}`);
  }
}

/**
 * Clear cache for a specific file or all files for a user
 * @param {string} userId - User ID
 * @param {string} [filename] - Optional filename. If not provided, clears all user's files
 */
function clearCache(userId, filename = null) {
  if (filename) {
    const cacheKey = `${userId}_${filename}`;
    fileCache.delete(cacheKey);
    console.log(`Cleared cache for ${filename} (user: ${userId})`);
  } else {
    // Clear all entries for this user
    const userPrefix = `${userId}_`;
    for (const key of fileCache.keys()) {
      if (key.startsWith(userPrefix)) {
        fileCache.delete(key);
      }
    }
    console.log(`Cleared all cache entries for user: ${userId}`);
  }
}

/**
 * Get cache statistics
 * @returns {Object} Cache stats (size, keys)
 */
function getCacheStats() {
  return {
    size: fileCache.size,
    keys: Array.from(fileCache.keys())
  };
}

module.exports = {
  loadFileData,
  extractColumn,
  clearCache,
  getCacheStats
};

