import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import Card, { CardHeader, CardContent, InfoCard } from './Card';

const DataTable = ({ fileData }) => {
  const [csvData, setCsvData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Parse CSV content into structured data
  const parseCsvContent = (csvText, filename) => {
    const lines = csvText.trim().split('\n');
    if (lines.length === 0) return null;

    const headers = lines[0].split(',').map(header => header.trim().replace(/^"(.*)"$/, '$1'));
    const rows = [];

    for (let i = 1; i < lines.length && i <= 50; i++) { // Limit to first 50 rows for preview
      const values = lines[i].split(',').map(value => value.trim().replace(/^"(.*)"$/, '$1'));
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      rows.push(row);
    }

    return {
      filename,
      headers,
      data: rows,
      rowCount: lines.length - 1, // Total rows minus header
      displayedRows: Math.min(50, lines.length - 1)
    };
  };

  // Fetch file content from blob storage
  const fetchFileContent = useCallback(async (fileName) => {
    setLoading(true);
    setError(null);
    
    try {
      // Get auth info from SWA
      const authResponse = await fetch('/.auth/me');
      const authData = await authResponse.json();
      
      if (!authData.clientPrincipal) {
        throw new Error('No authentication data available');
      }
      
      // Use relative URL to go through Static Web App proxy
      
      // Request download SAS token
      const sasResponse = await axios.get(`/api/files/${encodeURIComponent(fileName)}/sas`, {
        headers: {
          'x-ms-client-principal': btoa(JSON.stringify(authData.clientPrincipal))
        },
        timeout: 10000
      });

      if (!sasResponse.data.success || !sasResponse.data.downloadUrl) {
        throw new Error('Failed to get download URL');
      }

      // Fetch file content using SAS URL
      const contentResponse = await fetch(sasResponse.data.downloadUrl);
      if (!contentResponse.ok) {
        throw new Error(`Failed to download file: ${contentResponse.statusText}`);
      }

      const csvText = await contentResponse.text();
      const parsedData = parseCsvContent(csvText, fileName);
      
      if (!parsedData) {
        throw new Error('Failed to parse CSV content');
      }

      setCsvData(parsedData);
    } catch (err) {
      console.error('Failed to fetch file content:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load file content when fileData changes
  useEffect(() => {
    if (fileData && fileData.name) {
      fetchFileContent(fileData.name);
    } else {
      setCsvData(null);
    }
  }, [fileData, fetchFileContent]);

  // Show nothing if no file selected
  if (!fileData) {
    return null;
  }

  // Show loading state
  if (loading) {
    return (
      <Card>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mr-3"></div>
          <span className="body-normal text-text-secondary">Loading file data...</span>
        </div>
      </Card>
    );
  }

  // Show error state
  if (error) {
    return (
      <Card>
        <div className="text-center py-12">
          <div className="bg-red-50 border border-red-200 rounded-card p-6 inline-block warm-shadow">
            <h3 className="heading-5 text-red-900 mb-2">Failed to Load File</h3>
            <p className="body-normal text-red-700 mb-4">{error}</p>
            <button 
              onClick={() => fetchFileContent(fileData.name)}
              className="bg-red-600 text-white px-4 py-2 rounded-button hover:bg-red-700 body-small font-medium transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </Card>
    );
  }

  // Show message if no data loaded yet
  if (!csvData) {
    return null;
  }

  const { filename, headers, data, rowCount } = csvData;
  
  // Additional safety check for headers
  if (!headers || !Array.isArray(headers) || !data || !Array.isArray(data)) {
    return (
      <Card>
        <div className="text-center">
          <p className="body-normal text-text-muted">Unable to parse CSV data</p>
        </div>
      </Card>
    );
  }
  
  const displayedRows = data.length;
  const isTruncated = rowCount > 50;

  return (
    <Card>
      <CardHeader
        title="Data Preview"
        subtitle={`File: ${filename} • Columns: ${headers.length}`}
        action={
          <div className="body-small text-text-secondary">
            Showing {displayedRows} of {rowCount} rows
            {isTruncated && <span className="text-primary-600 ml-2 font-medium">(truncated)</span>}
          </div>
        }
      />

      <CardContent>
        {/* Table container with horizontal scroll */}
        <div className="overflow-x-auto border border-gray-200 rounded-card warm-shadow">
          <table className="min-w-full divide-y divide-gray-200">
            {/* Table Header */}
            <thead className="bg-secondary-50">
            <tr>
              <th className="px-4 py-3 text-left body-xs font-medium text-secondary-700 uppercase tracking-wider border-r border-gray-200">
                #
              </th>
              {headers.map((header, index) => (
                <th
                  key={index}
                  className="px-4 py-3 text-left body-xs font-medium text-secondary-700 uppercase tracking-wider border-r border-gray-200 last:border-r-0"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="bg-background-warm-white divide-y divide-gray-200">
            {data.map((row, rowIndex) => (
              <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-background-warm-white' : 'bg-background-cream hover:bg-primary-50 transition-colors'}>
                <td className="px-4 py-3 whitespace-nowrap body-xs text-text-muted border-r border-gray-200 font-medium">
                  {rowIndex + 1}
                </td>
                {headers.map((header, colIndex) => (
                  <td
                    key={colIndex}
                    className="px-4 py-3 body-small text-text-primary border-r border-gray-200 last:border-r-0"
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
        <div className="mt-6 pt-4 border-t border-gray-200 body-xs text-text-muted flex justify-between items-center">
          <div>
            {isTruncated && (
              <span className="inline-flex items-center px-3 py-1 rounded-badge body-xs font-medium bg-primary-100 text-primary-800">
                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                Only first 50 rows shown
              </span>
            )}
          </div>
          <div>
            <span className="font-medium">Total:</span> {rowCount} rows × {headers.length} columns
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default DataTable;
