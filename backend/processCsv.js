const csv = require('csv-parser');
const { Readable } = require('stream');

// Parse CSV buffer into array of objects
function parseCsv(buffer) {
  return new Promise((resolve, reject) => {
    const results = [];
    const stream = Readable.from(buffer);
    
    stream
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (error) => reject(error));
  });
}

// Convert CSV data to compact JSON string for GPT prompt
function formatCsvForPrompt(rows, filename) {
  if (!rows || rows.length === 0) {
    return `CSV file name: ${filename}\nCSV data: No data found`;
  }

  // Get headers from first row
  const headers = Object.keys(rows[0]);
  
  // Create a compact representation
  let csvString = `CSV file name: ${filename}\n`;
  csvString += `CSV data (${rows.length} rows):\n`;
  csvString += `Headers: ${headers.join(', ')}\n\n`;
  
  // Include all rows in JSON format for better parsing by GPT
  csvString += JSON.stringify(rows, null, 2);
  
  return csvString;
}

module.exports = {
  parseCsv,
  formatCsvForPrompt
};
