const math = require('mathjs');
const { loadFileData, extractColumn } = require('./dataLoader');

/**
 * Tool: Compute Statistics
 * Calculates average, count, sum, min, max, and median of numbers
 * Can accept file reference OR numbers array
 */
module.exports = {
  name: 'compute_avg_count_sum_min_max_median',
  description: 'Calculate the average (mean), count, sum, min, max, and median of numeric data. Can accept file reference (userId, filename, field) OR direct numbers array. For file data, the backend loads and extracts the field automatically. Example with file: {filename: "sales.csv", field: "revenue"} OR with array: {numbers: [10, 20, 30]}',
  
  parameters: {
    type: 'object',
    properties: {
      userId: {
        type: 'string',
        description: 'User ID for file access (automatically provided by system, optional if using numbers array)'
      },
      filename: {
        type: 'string',
        description: 'Name of the file to load (optional if using numbers array)'
      },
      field: {
        type: 'string',
        description: 'Column name containing numeric values (optional if using numbers array)'
      },
      numbers: {
        type: 'array',
        items: { type: 'number' },
        description: 'Direct array of numbers to calculate statistics from (optional if using file reference)'
      }
    },
    required: []
  },
  
  /**
   * Execute the statistics calculation
   * @param {object} args - Tool arguments
   * @param {string} [args.userId] - User ID for file access
   * @param {string} [args.filename] - Filename to load
   * @param {string} [args.field] - Field name to extract
   * @param {number[]} [args.numbers] - Direct numbers array
   * @returns {object} Result with calculated statistics
   */
  execute: async ({ userId, filename, field, numbers }) => {
    let validNumbers;
    
    // Determine mode: file reference or direct numbers
    if (userId && filename && field) {
      // Load data from file
      const fileData = await loadFileData(userId, filename);
      const columnData = extractColumn(fileData, field);
      
      // Filter for valid numbers
      validNumbers = columnData
        .map(v => Number(v))
        .filter(n => typeof n === 'number' && !isNaN(n));
      
      if (validNumbers.length === 0) {
        throw new Error(`No valid numeric values found in field "${field}"`);
      }
    } else if (numbers) {
      // Use provided numbers array
      if (!Array.isArray(numbers) || numbers.length === 0) {
        throw new Error('numbers must be a non-empty array');
      }
      
      validNumbers = numbers.filter(n => typeof n === 'number' && !isNaN(n));
      
      if (validNumbers.length === 0) {
        throw new Error('No valid numbers provided in array');
      }
    } else {
      throw new Error('Must provide either (userId, filename, field) OR (numbers) parameter');
    }
    
    return {
      average: math.mean(validNumbers),
      count: validNumbers.length,
      sum: math.sum(validNumbers),
      min: math.min(validNumbers),
      max: math.max(validNumbers),
      median: math.median(validNumbers)
    };
  }
};

