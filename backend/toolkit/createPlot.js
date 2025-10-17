/**
 * Create Plot Tool
 * 
 * Creates chart/plot configurations from file data for visualization in the frontend.
 * Supports bar charts and xy plots.
 * 
 * @param {string} userId - User ID for file access
 * @param {string} filename - Name of the file to load
 * @param {string} type - Chart type: "bar" or "xy"
 * @param {string} title - Chart title
 * @param {string} xField - Field name for x-axis/categories
 * @param {string} yField - Field name for y-axis/values
 * @param {string} xLabel - X-axis label (optional)
 * @param {string} yLabel - Y-axis label (optional)
 * @returns {Object} - Chart configuration object for frontend rendering
 */

const { loadFileData, extractColumn } = require('./dataLoader');

module.exports = {
  name: 'create_plot',
  description: 'Create a visual chart/plot from file data. Reference file by name and specify column names. DO NOT extract or pass data arrays - the backend handles data loading. For bar charts: specify xField (category names) and yField (values). For xy plots: specify xField (x values) and yField (y values). Example: {filename: "employee_payroll.csv", type: "bar", xField: "name", yField: "salary", title: "Employee Salaries"}',
  parameters: {
    type: 'object',
    properties: {
      userId: {
        type: 'string',
        description: 'User ID for file access (automatically provided by system)'
      },
      filename: {
        type: 'string',
        description: 'Name of the file to load (e.g., "sales_data.csv", "results.xlsx")'
      },
      type: {
        type: 'string',
        enum: ['bar', 'xy'],
        description: 'Type of chart: "bar" for bar chart (categorical data), "xy" for line plot (numerical relationships)'
      },
      title: {
        type: 'string',
        description: 'Title for the chart'
      },
      xField: {
        type: 'string',
        description: 'Column name for x-axis. For bar charts: category names. For xy plots: x values'
      },
      yField: {
        type: 'string',
        description: 'Column name for y-axis values'
      },
      xLabel: {
        type: 'string',
        description: 'Label for the X-axis (optional, defaults to xField name)'
      },
      yLabel: {
        type: 'string',
        description: 'Label for the Y-axis (optional, defaults to yField name)'
      }
    },
    required: ['userId', 'filename', 'type', 'title', 'xField', 'yField']
  },
  execute: async ({ userId, filename, type, title, xField, yField, xLabel, yLabel }) => {
    // Load file data
    const fileData = await loadFileData(userId, filename);
    
    // Extract columns
    const xData = extractColumn(fileData, xField);
    const yData = extractColumn(fileData, yField);
    
    // Validate inputs
    if (!type || !['bar', 'xy'].includes(type)) {
      throw new Error('type must be either "bar" or "xy"');
    }

    if (!title || typeof title !== 'string') {
      throw new Error('title must be a non-empty string');
    }

    if (xData.length === 0 || yData.length === 0) {
      throw new Error('Extracted columns must have data');
    }

    if (xData.length !== yData.length) {
      throw new Error(`Column lengths don't match: ${xField} has ${xData.length} rows, ${yField} has ${yData.length} rows`);
    }

    // Build chart data based on chart type
    if (type === 'bar') {
      // Bar chart: x is categories (names), y is values
      const chartData = xData.map((name, index) => ({
        name: String(name),
        value: Number(yData[index]) || 0
      }));

      return {
        type: 'bar',
        title,
        data: chartData,
        xLabel: xLabel || xField,
        yLabel: yLabel || yField,
        dataPoints: chartData.length
      };
    } else if (type === 'xy') {
      // XY plot: both x and y are numeric values
      const chartData = xData.map((x, index) => ({
        x: Number(x),
        y: Number(yData[index])
      }));

      return {
        type: 'xy',
        title,
        data: chartData,
        xLabel: xLabel || xField,
        yLabel: yLabel || yField,
        dataPoints: chartData.length
      };
    }

    throw new Error('Invalid chart type');
  }
};

