import React from 'react';

const DataTable = ({ fileData }) => {
  if (!fileData || !fileData.data || fileData.data.length === 0) {
    return null;
  }

  const { filename, headers, data, rowCount } = fileData;
  const displayedRows = data.length;
  const isTruncated = rowCount > 50;

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-800">Data Preview</h2>
        <div className="text-sm text-gray-600">
          Showing {displayedRows} of {rowCount} rows
          {isTruncated && <span className="text-orange-600 ml-2">(truncated)</span>}
        </div>
      </div>

      <div className="text-sm text-gray-600 mb-4">
        <strong>File:</strong> {filename} • <strong>Columns:</strong> {headers.length}
      </div>

      {/* Table container with horizontal scroll */}
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          {/* Table Header */}
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                #
              </th>
              {headers.map((header, index) => (
                <th
                  key={index}
                  className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 last:border-r-0"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((row, rowIndex) => (
              <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500 border-r border-gray-200 font-medium">
                  {rowIndex + 1}
                </td>
                {headers.map((header, colIndex) => (
                  <td
                    key={colIndex}
                    className="px-3 py-2 text-sm text-gray-900 border-r border-gray-200 last:border-r-0"
                    title={row[header]} // Tooltip for long values
                  >
                    <div className="max-w-xs truncate">
                      {row[header] || '-'}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer with summary */}
      <div className="mt-4 text-xs text-gray-500 flex justify-between items-center">
        <div>
          {isTruncated && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
              <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              Only first 50 rows shown
            </span>
          )}
        </div>
        <div>
          Total: {rowCount} rows × {headers.length} columns
        </div>
      </div>
    </div>
  );
};

export default DataTable;
