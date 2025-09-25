import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { getAuthHeaders } from '../utils/auth';
import Card, { CardHeader, CardContent } from './Card';

const DataTable = ({ fileData, className = '', isCollapsed, onToggleCollapse }) => {
  const [csvData, setCsvData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');

  // Parse CSV content into structured data
  const parseCsvContent = (csvText, filename) => {
    const lines = csvText.trim().split('\n');
    if (lines.length === 0) return null;

    const headers = lines[0].split(',').map(header => header.trim().replace(/^"(.*)"$/, '$1'));
    const rows = [];

    // Parse all rows for better table functionality
    for (let i = 1; i < lines.length && i <= 1000; i++) { // Increased limit for better pagination
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
      displayedRows: Math.min(1000, lines.length - 1)
    };
  };

  // Handle sorting
  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Sort data (no pagination)
  const getSortedData = () => {
    if (!csvData || !csvData.data) return [];

    let sortedData = [...csvData.data];

    // Apply sorting
    if (sortColumn) {
      sortedData.sort((a, b) => {
        const aVal = a[sortColumn] || '';
        const bVal = b[sortColumn] || '';
        
        // Try to parse as numbers for numeric sorting
        const aNum = parseFloat(aVal);
        const bNum = parseFloat(bVal);
        
        if (!isNaN(aNum) && !isNaN(bNum)) {
          return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
        }
        
        // String sorting
        return sortDirection === 'asc' 
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      });
    }

    return sortedData;
  };


  // Fetch file content from blob storage
  const fetchFileContent = useCallback(async (fileName) => {
    setLoading(true);
    setError(null);
    
    try {
      // Get authentication headers (handles local development bypass)
      const authHeaders = await getAuthHeaders();
      
      // Request download SAS token
      const sasResponse = await axios.get(`/api/files/${encodeURIComponent(fileName)}/sas`, {
        headers: authHeaders,
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
      
      // Handle specific error types
      if (err.response?.status === 404 || err.message.includes('does not exist')) {
        setError('File not found. It may have been deleted.');
      } else if (err.response?.status === 429 || err.message.includes('429')) {
        setError('Too many requests. Please wait a moment and try again.');
      } else {
        setError(err.message || 'Failed to load file content');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Load file content when fileData changes (with debouncing)
  useEffect(() => {
    if (fileData && fileData.name) {
      // Add a small delay to prevent rapid requests
      const timeoutId = setTimeout(() => {
        fetchFileContent(fileData.name);
        // Reset sorting when new file is loaded
        setSortColumn(null);
        setSortDirection('asc');
      }, 100);
      
      return () => clearTimeout(timeoutId);
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

  const { headers, data, rowCount } = csvData;
  
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
  
  const sortedData = getSortedData();
  const isTruncated = rowCount > 1000;

  return (
    <Card className={`h-full flex flex-col ${className}`}>
      <CardHeader
        title={!isCollapsed ? <span className="text-secondary-600 font-semibold lowercase">preview</span> : null}
        action={
          <button
            onClick={() => onToggleCollapse(!isCollapsed)}
            className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
            title={isCollapsed ? "Expand preview" : "Collapse preview"}
          >
            <svg 
              className={`w-4 h-4 transition-transform duration-200 ${isCollapsed ? 'rotate-180' : ''}`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        }
      />

      {!isCollapsed && (
        <CardContent className="flex-1 flex flex-col min-h-0">
        {/* Desktop Table View */}
        <div className="hidden md:block flex-1 min-h-0">
          <div className="h-full overflow-auto border border-gray-200 rounded-card warm-shadow">
            <table className="min-w-full divide-y divide-gray-200">
            {/* Table Header */}
            <thead className="bg-secondary-50">
              <tr>
                <th className="px-4 py-4 text-left body-xs font-semibold text-secondary-700 uppercase tracking-wider border-r border-gray-200 w-16">
                  <div className="flex items-center">
                    <span>#</span>
                  </div>
                </th>
                {headers.map((header, index) => (
                  <th
                    key={index}
                    className="px-4 py-4 text-left body-xs font-semibold text-secondary-700 uppercase tracking-wider border-r border-gray-200 last:border-r-0"
                  >
                    <button
                      onClick={() => handleSort(header)}
                      className="flex items-center space-x-1 hover:text-secondary-900 transition-colors group w-full text-left"
                      title={`Sort by ${header}`}
                    >
                      <span className="truncate max-w-32">{header}</span>
                      <div className="flex-shrink-0">
                        {sortColumn === header ? (
                          sortDirection === 'asc' ? (
                            <svg className="w-3 h-3 text-primary-600" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <svg className="w-3 h-3 text-primary-600" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          )
                        ) : (
                          <svg className="w-3 h-3 text-gray-400 group-hover:text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 3a1 1 0 01.707.293l3 3a1 1 0 01-1.414 1.414L10 5.414 7.707 7.707a1 1 0 01-1.414-1.414l3-3A1 1 0 0110 3zm-3.707 9.293a1 1 0 011.414 0L10 14.586l2.293-2.293a1 1 0 011.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>

                    {/* Table Body */}
                    <tbody className="bg-background-warm-white divide-y divide-gray-200">
                      {sortedData.map((row, rowIndex) => (
                        <tr key={rowIndex + 1} className={rowIndex % 2 === 0 ? 'bg-background-warm-white hover:bg-primary-25' : 'bg-background-cream hover:bg-primary-50 transition-colors duration-150'}>
                          <td className="px-4 py-4 whitespace-nowrap body-xs text-text-muted border-r border-gray-200 font-semibold w-16">
                            {rowIndex + 1}
                          </td>
                  {headers.map((header, colIndex) => (
                    <td
                      key={colIndex}
                      className="px-4 py-4 body-small text-text-primary border-r border-gray-200 last:border-r-0"
                      title={row[header]} // Tooltip for long values
                    >
                      <div className="max-w-48 truncate">
                        {row[header] || (
                          <span className="text-text-muted italic">—</span>
                        )}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
              
              {/* Empty state if no data */}
              {sortedData.length === 0 && (
                <tr>
                  <td colSpan={headers.length + 1} className="px-4 py-8 text-center">
                    <div className="text-text-muted">
                      <svg className="w-8 h-8 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="body-small">No data available</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
            </table>
          </div>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden flex-1 min-h-0">
          {/* Mobile Sort Control */}
          <div className="mb-4 p-3 bg-secondary-50 rounded-card border border-secondary-200">
            <div className="flex items-center justify-between">
              <span className="body-small font-medium text-secondary-700">sort by:</span>
              <select
                value={sortColumn || ''}
                onChange={(e) => {
                  if (e.target.value) {
                    handleSort(e.target.value);
                  } else {
                    setSortColumn(null);
                    setSortDirection('asc');
                  }
                }}
                className="body-small border border-gray-300 rounded-button px-2 py-1 bg-background-warm-white"
              >
                <option value="">No sorting</option>
                {headers.map((header, index) => (
                  <option key={index} value={header}>
                    {header} ({sortColumn === header ? sortDirection : 'asc'})
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          {/* Mobile Cards */}
          <div className="space-y-3 overflow-y-auto flex-1 mobile-scrollbar">
            {sortedData.map((row, rowIndex) => (
            <div key={rowIndex + 1} className="bg-background-warm-white border border-gray-200 rounded-card p-4 warm-shadow">
              <div className="flex items-center justify-between mb-3">
                <span className="body-xs font-semibold text-text-muted">row {rowIndex + 1}</span>
                {sortColumn && (
                  <span className="body-xs text-primary-600 font-medium">
                    sorted by {sortColumn}
                  </span>
                )}
              </div>
              <div className="space-y-2">
                {headers.map((header, colIndex) => (
                  <div key={colIndex} className="flex flex-col space-y-1">
                    <div className="body-xs font-medium text-secondary-700 uppercase tracking-wide">
                      {header}
                    </div>
                    <div className="body-small text-text-primary">
                      {row[header] || (
                        <span className="text-text-muted italic">—</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            ))}
            
            {/* Mobile Empty state */}
            {sortedData.length === 0 && (
              <div className="text-center py-8">
                <svg className="w-12 h-12 mx-auto mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="body-normal text-text-muted">No data available</p>
              </div>
            )}
          </div>
        </div>

        {/* Simple Footer */}
        <div className="mt-4 pt-3 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="body-small text-text-secondary font-medium lowercase">
              {rowCount.toLocaleString()} rows × {headers.length} columns
            </div>
            <div className="flex items-center space-x-2">
              {isTruncated && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-badge body-xs font-medium bg-amber-100 text-amber-800">
                  <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  limited to 1,000 rows
                </span>
              )}
              {sortColumn && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-badge body-xs font-medium bg-secondary-100 text-secondary-800">
                  <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 3a1 1 0 000 2h11a1 1 0 100-2H3zM3 7a1 1 0 000 2h7a1 1 0 100-2H3zM3 11a1 1 0 100 2h4a1 1 0 100-2H3z" clipRule="evenodd" />
                  </svg>
                  sorted by {sortColumn} ({sortDirection})
                </span>
              )}
            </div>
          </div>
        </div>
        </CardContent>
      )}
    </Card>
  );
};

export default DataTable;
