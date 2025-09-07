import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const FileUpload = ({ onFileUploaded }) => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const { getAuthHeaders } = useAuth();

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
    
    // Debug FormData content
    console.log('🔍 FormData Debug:', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      formDataHasFile: formData.has('csvFile'),
      formDataEntries: Array.from(formData.entries()).map(([key, value]) => ({
        key,
        valueType: typeof value,
        fileName: value.name || 'N/A'
      }))
    });

    try {
      console.log('Uploading file:', file.name, file.size);
      const backendURL = process.env.REACT_APP_API_URL || 'https://taktmate-backend-api-csheb3aeg8f5bcbv.eastus-01.azurewebsites.net';
      console.log('🔍 FileUpload Debug - Using API URL:', backendURL);
      
      // Test CORS by checking backend health endpoint first
      try {
        const healthResponse = await axios.get(`${backendURL}/api/health`);
        console.log('🔍 Backend health check:', healthResponse.status === 200 ? 'SUCCESS' : 'FAILED');
      } catch (healthError) {
        console.log('🔍 Backend health check FAILED:', healthError.message);
        console.log('🔍 This indicates CORS or connectivity issues');
      }
      
      // Get CSRF token first
      const csrfResponse = await axios.get(`${backendURL}/csrf-token`, {
        withCredentials: true // Include cookies for CSRF
      });
      const csrfToken = csrfResponse.data.csrf.token;
      console.log('🔍 CSRF token obtained:', csrfToken ? 'SUCCESS' : 'FAILED');
      
      // Get authentication headers without Content-Type (for file upload)
      const authHeaders = await getAuthHeaders(false, false); // Don't include Content-Type
      console.log('🔍 Auth headers obtained:', authHeaders ? 'SUCCESS' : 'FAILED');
      console.log('🔍 Auth headers content:', authHeaders);
      
      const response = await axios.post(`${backendURL}/upload`, formData, {
        headers: {
          // Don't set Content-Type manually - let axios set it with boundary
          // 'Content-Type': 'multipart/form-data', // REMOVED - axios will set this automatically
          'X-CSRF-Token': csrfToken,
          ...authHeaders, // Add JWT authentication headers
        },
        withCredentials: true, // Include cookies for CSRF
        timeout: 30000, // 30 second timeout
      });
      
      console.log('🔍 Upload request sent with formData:', formData.get('csvFile')?.name);
      console.log('Upload response:', response.data);

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
