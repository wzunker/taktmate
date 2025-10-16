/**
 * Numeric Filter Tool
 * 
 * Filters array data based on numeric comparisons.
 * Supports: =, !=, >, <, >=, <=, BETWEEN
 * 
 * @param {Array} data - Array of objects to filter
 * @param {string} field - Field name to filter on
 * @param {string} operator - Comparison operator (=, !=, >, <, >=, <=, between)
 * @param {number} value - Primary comparison value
 * @param {number} value2 - Secondary value (for BETWEEN operator)
 * @returns {Object} - Filtered results with metadata
 */

module.exports = {
  name: 'filter_numeric',
  description: 'Filter data based on numeric comparisons. REQUIRED: You must extract the actual data from the file and pass it in the data array. Returns filtered subset and metadata. Supports: = (equal), != (not equal), > (greater), < (less), >= (greater/equal), <= (less/equal), BETWEEN (range). Example: To filter employees with salary > 70000, extract employee data and pass: {data: [{name: "Alice", salary: 95000}, ...], field: "salary", operator: ">", value: 70000}',
  
  parameters: {
    type: 'object',
    properties: {
      data: {
        type: 'array',
        items: { type: 'object' },
        description: 'REQUIRED array of data objects extracted from the file (e.g., [{name: "Alice", salary: 50000}, {name: "Bob", salary: 60000}]). You MUST populate this with actual data from the document.'
      },
      field: {
        type: 'string',
        description: 'Name of the numeric field to filter on (e.g., "salary", "age", "quantity")'
      },
      operator: {
        type: 'string',
        enum: ['=', '==', '!=', '<>', '>', '<', '>=', '<=', 'between', 'BETWEEN'],
        description: 'Comparison operator: = (equal), != (not equal), > (greater), < (less), >= (greater/equal), <= (less/equal), between (range)'
      },
      value: {
        type: 'number',
        description: 'Primary comparison value (or lower bound for BETWEEN)'
      },
      value2: {
        type: 'number',
        description: 'Upper bound value (only required for BETWEEN operator)'
      }
    },
    required: ['data', 'field', 'operator', 'value']
  },
  
  execute: async ({ data, field, operator, value, value2 }) => {
    // Validate inputs
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('data must be a non-empty array');
    }

    if (!field || typeof field !== 'string') {
      throw new Error('field must be a valid string');
    }

    if (!operator) {
      throw new Error('operator is required');
    }

    // Normalize operator
    const op = operator.toLowerCase();

    // Validate BETWEEN requires value2
    if ((op === 'between') && (value2 === undefined || value2 === null)) {
      throw new Error('BETWEEN operator requires value2 parameter');
    }

    // Filter the data based on operator
    let filteredData = [];
    
    switch (op) {
      case '=':
      case '==':
        filteredData = data.filter(item => {
          const fieldValue = item[field];
          return typeof fieldValue === 'number' && fieldValue === value;
        });
        break;

      case '!=':
      case '<>':
        filteredData = data.filter(item => {
          const fieldValue = item[field];
          return typeof fieldValue === 'number' && fieldValue !== value;
        });
        break;

      case '>':
        filteredData = data.filter(item => {
          const fieldValue = item[field];
          return typeof fieldValue === 'number' && fieldValue > value;
        });
        break;

      case '<':
        filteredData = data.filter(item => {
          const fieldValue = item[field];
          return typeof fieldValue === 'number' && fieldValue < value;
        });
        break;

      case '>=':
        filteredData = data.filter(item => {
          const fieldValue = item[field];
          return typeof fieldValue === 'number' && fieldValue >= value;
        });
        break;

      case '<=':
        filteredData = data.filter(item => {
          const fieldValue = item[field];
          return typeof fieldValue === 'number' && fieldValue <= value;
        });
        break;

      case 'between':
        const lowerBound = Math.min(value, value2);
        const upperBound = Math.max(value, value2);
        filteredData = data.filter(item => {
          const fieldValue = item[field];
          return typeof fieldValue === 'number' && 
                 fieldValue >= lowerBound && 
                 fieldValue <= upperBound;
        });
        break;

      default:
        throw new Error(`Unsupported operator: ${operator}. Use: =, !=, >, <, >=, <=, or BETWEEN`);
    }

    // Build filter description for readability
    let filterDescription;
    if (op === 'between') {
      filterDescription = `${field} BETWEEN ${Math.min(value, value2)} AND ${Math.max(value, value2)}`;
    } else {
      filterDescription = `${field} ${operator} ${value}`;
    }

    // Return filtered results with metadata
    return {
      filteredData: filteredData,
      matchCount: filteredData.length,
      totalCount: data.length,
      filterApplied: filterDescription,
      percentageMatched: data.length > 0 
        ? Math.round((filteredData.length / data.length) * 100 * 10) / 10 
        : 0
    };
  }
};

