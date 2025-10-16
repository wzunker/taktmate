/**
 * Create Plot Tool
 * 
 * Creates chart/plot configurations from data for visualization in the frontend.
 * Supports bar charts and xy plots.
 * 
 * @param {string} type - Chart type: "bar" or "xy"
 * @param {string} title - Chart title
 * @param {Array<Object>} data - Array of data objects with appropriate keys
 * @param {string} xLabel - X-axis label (optional)
 * @param {string} yLabel - Y-axis label (optional)
 * @returns {Object} - Chart configuration object for frontend rendering
 */

module.exports = {
  name: 'create_plot',
  description: 'Create a visual chart/plot from data extracted from files. REQUIRED: You must extract the actual data from the file and pass it in the data array. For bar charts, pass [{name: "Alice", value: 50000}, {name: "Bob", value: 60000}]. For xy plots, pass [{x: 1, y: 10}, {x: 2, y: 20}]. Do NOT describe the chart - actually create it by passing the data.',
  parameters: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['bar', 'xy'],
        description: 'Type of chart: "bar" for bar chart (categorical data), "xy" for line plot (numerical relationships)'
      },
      title: {
        type: 'string',
        description: 'Title for the chart'
      },
      data: {
        type: 'array',
        items: {
          type: 'object'
        },
        description: 'REQUIRED array of data points extracted from the file. Bar charts: [{name: "CategoryName", value: 123}]. XY plots: [{x: 10, y: 20}]. You MUST populate this with actual data from the document.'
      },
      xLabel: {
        type: 'string',
        description: 'Label for the X-axis (optional)'
      },
      yLabel: {
        type: 'string',
        description: 'Label for the Y-axis (optional)'
      }
    },
    required: ['type', 'title', 'data']
  },
  execute: async ({ type, title, data, xLabel, yLabel }) => {
    // Validate inputs
    if (!type || !['bar', 'xy'].includes(type)) {
      throw new Error('type must be either "bar" or "xy"');
    }

    if (!title || typeof title !== 'string') {
      throw new Error('title must be a non-empty string');
    }

    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('data must be a non-empty array');
    }

    // Validate data structure based on chart type
    if (type === 'bar') {
      // Bar chart data should have 'name' and 'value' properties
      const isValid = data.every(item => 
        typeof item === 'object' && 
        ('name' in item || 'label' in item) && 
        ('value' in item || 'y' in item)
      );
      
      if (!isValid) {
        throw new Error('Bar chart data must have "name" (or "label") and "value" (or "y") properties');
      }

      // Normalize data to consistent format
      const normalizedData = data.map(item => ({
        name: item.name || item.label || 'Unknown',
        value: item.value || item.y || 0
      }));

      return {
        type: 'bar',
        title,
        data: normalizedData,
        xLabel: xLabel || 'Category',
        yLabel: yLabel || 'Value',
        dataPoints: normalizedData.length
      };
    } else if (type === 'xy') {
      // XY plot data should have 'x' and 'y' properties
      const isValid = data.every(item => 
        typeof item === 'object' && 
        'x' in item && 
        'y' in item
      );
      
      if (!isValid) {
        throw new Error('XY plot data must have "x" and "y" properties');
      }

      // Ensure x and y are numbers
      const normalizedData = data.map(item => ({
        x: Number(item.x),
        y: Number(item.y)
      }));

      return {
        type: 'xy',
        title,
        data: normalizedData,
        xLabel: xLabel || 'X',
        yLabel: yLabel || 'Y',
        dataPoints: normalizedData.length
      };
    }

    throw new Error('Invalid chart type');
  }
};

