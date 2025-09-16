import React, { useState } from 'react';
import axios from 'axios';

const FileUpload = ({ onFileUploaded }) => {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const MAX_FILES = 5;

  const validateAndAddFiles = (newFiles) => {
    const validFiles = [];
    const errors = [];

    // Check file limit
    if (files.length >= MAX_FILES) {
      setError(`Maximum ${MAX_FILES} files allowed`);
      return false;
    }

    for (const file of newFiles) {
      // Check if file is CSV
      if (!(file.type === 'text/csv' || file.name.endsWith('.csv'))) {
        errors.push(`${file.name} is not a CSV file`);
        continue;
      }

      // Check for duplicates
      if (files.some(existingFile => existingFile.name === file.name)) {
        errors.push(`${file.name} is already uploaded`);
        continue;
      }

      // Check file limit
      if (files.length + validFiles.length >= MAX_FILES) {
        errors.push(`Cannot add ${file.name} - maximum ${MAX_FILES} files allowed`);
        break;
      }

      validFiles.push(file);
    }

    if (errors.length > 0) {
      setError(errors.join(', '));
    } else {
      setError('');
    }

    if (validFiles.length > 0) {
      setFiles(prevFiles => [...prevFiles, ...validFiles]);
      return true;
    }

    return false;
  };

  const removeFileFromSelection = (indexToRemove) => {
    setFiles(prevFiles => prevFiles.filter((_, index) => index !== indexToRemove));
    setError(''); // Clear any errors when removing files
  };

  const downloadFile = (file) => {
    // Create a blob URL for the file and trigger download
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    if (selectedFiles.length > 0) {
      validateAndAddFiles(selectedFiles);
    }
    // Reset the file input
    e.target.value = '';
  };

  // Drag and drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragOver) {
      setIsDragOver(true);
    }
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set isDragOver to false if we're leaving the drop zone entirely
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      validateAndAddFiles(droppedFiles);
    }
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      setError('Please select CSV files to upload');
      return;
    }

    setUploading(true);
    setError('');

    try {
      // Get auth info from SWA
      const authResponse = await fetch('/.auth/me');
      const authData = await authResponse.json();
      
      if (!authData.clientPrincipal) {
        setError('Authentication required. Please log in.');
        return;
      }
      
      const backendURL = process.env.REACT_APP_API_URL || 'https://taktmate-backend-api-csheb3aeg8f5bcbv.eastus-01.azurewebsites.net';
      
      // Create headers with auth data
      const authHeaders = {
        'Content-Type': 'multipart/form-data',
        'x-ms-client-principal': btoa(JSON.stringify(authData.clientPrincipal))
      };

      const uploadPromises = files.map(async (file) => {
        const formData = new FormData();
        formData.append('csvFile', file);
        
        const response = await axios.post(`${backendURL}/api/upload`, formData, {
          headers: authHeaders,
          timeout: 30000, // 30 second timeout
        });

        if (response.data.success) {
          return {
            fileId: response.data.fileId,
            filename: response.data.filename,
            rowCount: response.data.rowCount,
            headers: response.data.headers,
            data: response.data.data,
            originalFile: file // Keep reference to original file for download
          };
        }
        throw new Error(`Failed to upload ${file.name}`);
      });

      const uploadedFiles = await Promise.all(uploadPromises);
      
      // Call onFileUploaded for each successfully uploaded file
      uploadedFiles.forEach(fileData => {
        onFileUploaded(fileData);
      });

      // Clear the files after successful upload
      setFiles([]);
      
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to upload files');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-800">Upload CSV Files</h2>
        <span className="text-sm text-gray-500">
          {files.length}/{MAX_FILES} files selected
        </span>
      </div>
      
      <div className="space-y-4">
        {/* Drag and Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200 ${
            files.length >= MAX_FILES
              ? 'border-gray-200 bg-gray-50'
              : isDragOver
              ? 'border-primary-400 bg-primary-50'
              : 'border-gray-300 hover:border-gray-400'
          } ${uploading || files.length >= MAX_FILES ? 'opacity-50 pointer-events-none' : ''}`}
        >
          <div className="space-y-4">
            <div className="mx-auto w-12 h-12 text-gray-400">
              <svg fill="none" stroke="currentColor" viewBox="0 0 48 48" aria-hidden="true">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                />
              </svg>
            </div>
            <div>
              <p className="text-lg font-medium text-gray-900">
                {files.length >= MAX_FILES
                  ? `Maximum ${MAX_FILES} files reached`
                  : isDragOver
                  ? 'Drop your CSV files here'
                  : 'Drag and drop your CSV files here'}
              </p>
              {files.length < MAX_FILES && (
                <p className="text-sm text-gray-500 mt-1">or</p>
              )}
            </div>
            {files.length < MAX_FILES && (
              <label
                htmlFor="csvFile"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-primary-700 bg-primary-100 hover:bg-primary-200 cursor-pointer transition-colors"
              >
                Browse Files
              </label>
            )}
            <input
              id="csvFile"
              type="file"
              accept=".csv"
              multiple
              onChange={handleFileChange}
              className="hidden"
              disabled={uploading || files.length >= MAX_FILES}
            />
          </div>
        </div>

        {files.length > 0 && (
          <div className="border border-gray-200 rounded-lg bg-white">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 rounded-t-lg">
              <h3 className="text-sm font-medium text-gray-900">
                Selected Files ({files.length}/{MAX_FILES})
              </h3>
            </div>
            <div className="divide-y divide-gray-100">
              {files.map((file, index) => (
                <div key={index} className="px-4 py-3 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      {/* File Icon */}
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                          <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </div>
                      </div>
                      
                      {/* File Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => downloadFile(file)}
                            className="text-sm font-medium text-gray-900 truncate hover:text-blue-600 transition-colors cursor-pointer text-left"
                          >
                            {file.name}
                          </button>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            CSV
                          </span>
                        </div>
                        <div className="flex items-center mt-1 space-x-4 text-xs text-gray-500">
                          <span>{(file.size / 1024).toFixed(1)} KB</span>
                          <span>•</span>
                          <span>{new Date().toLocaleDateString()}</span>
                          <span>•</span>
                          <span className="inline-flex items-center">
                            <div className="w-2 h-2 bg-yellow-400 rounded-full mr-1"></div>
                            Ready to upload
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        type="button"
                        onClick={() => downloadFile(file)}
                        className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                        title="Download original file"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => removeFileFromSelection(index)}
                        className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                        title="Remove from selection"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {/* File List Footer */}
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 rounded-b-lg">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>
                  Total size: {(files.reduce((total, file) => total + file.size, 0) / 1024).toFixed(1)} KB
                </span>
                <span>
                  {MAX_FILES - files.length} slot{MAX_FILES - files.length !== 1 ? 's' : ''} remaining
                </span>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
            {error}
          </div>
        )}

        <button
          onClick={handleUpload}
          disabled={files.length === 0 || uploading}
          className="w-full bg-primary-600 text-white py-2 px-4 rounded-md hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {uploading
            ? `Uploading ${files.length} file${files.length > 1 ? 's' : ''}...`
            : `Upload ${files.length} CSV file${files.length > 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  );
};

export default FileUpload;
