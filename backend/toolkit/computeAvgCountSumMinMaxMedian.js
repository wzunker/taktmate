const math = require('mathjs');

/**
 * Tool: Compute Average
 * Calculates the mean/average of an array of numbers
 */
module.exports = {
  name: 'compute_avg_count_sum_min_max_median',
  description: 'Calculate the average (mean), count, sum, min, max, and median of an array of numbers. Useful for analyzing numerical data from CSV files, spreadsheets, or any numeric datasets.',
  
  parameters: {
    type: 'object',
    properties: {
      numbers: {
        type: 'array',
        items: { type: 'number' },
        description: 'Array of numbers to calculate the average from'
      }
    },
    required: ['numbers']
  },
  
  /**
   * Execute the average calculation
   * @param {object} args - Tool arguments
   * @param {number[]} args.numbers - Array of numbers
   * @returns {object} Result with the calculated average
   */
  execute: async ({ numbers }) => {
    if (!Array.isArray(numbers) || numbers.length === 0) {
      throw new Error('numbers must be a non-empty array');
    }
    
    // Validate all items are numbers
    const validNumbers = numbers.filter(n => typeof n === 'number' && !isNaN(n));
    
    if (validNumbers.length === 0) {
      throw new Error('No valid numbers provided');
    }
    
    return {
      average:math.mean(validNumbers),
      count: validNumbers.length,
      sum: math.sum(validNumbers),
      min: math.min(validNumbers),
      max: math.max(validNumbers),
      median: math.median(validNumbers)
    };
  }
};

