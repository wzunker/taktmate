import React, { useState } from 'react';
import axios from 'axios';

const FileUpload = ({ onFileUploaded }) => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (selectedFile.type === 'text/csv' || selectedFile.name.endsWith('.csv')) {
        setFile(selectedFile);
        setError('');
      } else {
        setError('Please select a valid CSV file');
        setFile(null);
      }
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a CSV file');
      return;
    }

    setUploading(true);
    setError('');

    const formData = new FormData();
    formData.append('csvFile', file);

    try {
      // Get auth info from SWA
      const authResponse = await fetch('/.auth/me');
      const authData = await authResponse.json();
      
      if (!authData.clientPrincipal) {
        setError('Authentication required. Please log in.');
        return;
      }
      
      // Call backend directly with SWA auth data
      const backendURL = process.env.REACT_APP_API_URL || 'https://taktmate-backend-api-csheb3aeg8f5bcbv.eastus-01.azurewebsites.net';
      
      // Create headers with auth data
      const authHeaders = {
        'Content-Type': 'multipart/form-data',
        'x-ms-client-principal': btoa(JSON.stringify(authData.clientPrincipal))
      };
      
      const response = await axios.post(`${backendURL}/api/upload`, formData, {
        headers: authHeaders,
        timeout: 30000, // 30 second timeout
          });

          if (response.data.success) {
        onFileUploaded({
          fileId: response.data.fileId,
          filename: response.data.filename,
          rowCount: response.data.rowCount,
          headers: response.data.headers,
          data: response.data.data // Include the CSV data for table display
        });
        setFile(null);
        // Reset the file input
        document.getElementById('csvFile').value = '';
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h2 className="text-xl font-semibold text-gray-800 mb-4">Upload CSV File</h2>
      
      <div className="space-y-4">
        <div>
          <label htmlFor="csvFile" className="block text-sm font-medium text-gray-700 mb-2">
            Select CSV File
          </label>
          <input
            id="csvFile"
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
            disabled={uploading}
          />
        </div>

        {file && (
          <div className="text-sm text-gray-600">
            Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
          </div>
        )}

        {error && (
          <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
            {error}
          </div>
        )}

        <button
          onClick={handleUpload}
          disabled={!file || uploading}
          className="w-full bg-primary-600 text-white py-2 px-4 rounded-md hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {uploading ? 'Uploading...' : 'Upload CSV'}
        </button>
      </div>
    </div>
  );
};

export default FileUpload;
