/**
 * Numeric Filter Tool
 * 
 * Filters file data based on numeric comparisons.
 * Supports: =, !=, >, <, >=, <=, BETWEEN
 * 
 * @param {string} userId - User ID for file access
 * @param {string} filename - Name of the file to load
 * @param {string} field - Field name to filter on
 * @param {string} operator - Comparison operator (=, !=, >, <, >=, <=, between)
 * @param {number} value - Primary comparison value
 * @param {number} value2 - Secondary value (for BETWEEN operator)
 * @returns {Object} - Filtered results with metadata
 */

const { loadFileData } = require('./dataLoader');

module.exports = {
  name: 'filter_numeric',
  description: 'Filter file data based on numeric comparisons. Reference file by name and specify the field to filter. DO NOT pass data arrays - the backend handles data loading. Returns filtered subset and metadata. Supports: = (equal), != (not equal), > (greater), < (less), >= (greater/equal), <= (less/equal), BETWEEN (range). Example: {filename: "employee_payroll.csv", field: "salary", operator: ">=", value: 70000}',
  
  parameters: {
    type: 'object',
    properties: {
      userId: {
        type: 'string',
        description: 'User ID for file access (automatically provided by system)'
      },
      filename: {
        type: 'string',
        description: 'Name of the file to load (e.g., "employee_payroll.csv", "sales_data.xlsx")'
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
    required: ['userId', 'filename', 'field', 'operator', 'value']
  },
  
  execute: async ({ userId, filename, field, operator, value, value2 }) => {
    // Load file data using data loader
    const data = await loadFileData(userId, filename);
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
          const fieldValue = Number(item[field]);
          return !isNaN(fieldValue) && fieldValue === value;
        });
        break;

      case '!=':
      case '<>':
        filteredData = data.filter(item => {
          const fieldValue = Number(item[field]);
          return !isNaN(fieldValue) && fieldValue !== value;
        });
        break;

      case '>':
        filteredData = data.filter(item => {
          const fieldValue = Number(item[field]);
          return !isNaN(fieldValue) && fieldValue > value;
        });
        break;

      case '<':
        filteredData = data.filter(item => {
          const fieldValue = Number(item[field]);
          return !isNaN(fieldValue) && fieldValue < value;
        });
        break;

      case '>=':
        filteredData = data.filter(item => {
          const fieldValue = Number(item[field]);
          return !isNaN(fieldValue) && fieldValue >= value;
        });
        break;

      case '<=':
        filteredData = data.filter(item => {
          const fieldValue = Number(item[field]);
          return !isNaN(fieldValue) && fieldValue <= value;
        });
        break;

      case 'between':
        const lowerBound = Math.min(value, value2);
        const upperBound = Math.max(value, value2);
        filteredData = data.filter(item => {
          const fieldValue = Number(item[field]);
          return !isNaN(fieldValue) && 
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

