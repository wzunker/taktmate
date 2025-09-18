import React, { useState } from 'react';
import axios from 'axios';

const FileUpload = ({ onFileUploaded, uploadedFilesCount = 0 }) => {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({}); // Track progress for each file
  const [error, setError] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const MAX_FILES = 5;

  const validateAndAddFiles = (newFiles) => {
    const validFiles = [];
    const errors = [];
    const totalFilesInMemory = uploadedFilesCount;
    const availableSlots = MAX_FILES - totalFilesInMemory;

    // Check if we have any slots available
    if (availableSlots <= 0) {
      setError(`Maximum ${MAX_FILES} files in storage. Delete some uploaded files to add more.`);
      return false;
    }

    // Check if we already have files selected that would fill available slots
    if (files.length >= availableSlots) {
      setError(`Can only stage ${availableSlots} file${availableSlots > 1 ? 's' : ''} with ${totalFilesInMemory} already in storage`);
      return false;
    }

    for (const file of newFiles) {
      // Check if file is CSV
      if (!(file.type === 'text/csv' || file.name.endsWith('.csv'))) {
        errors.push(`${file.name} is not a CSV file`);
        continue;
      }

      // Check for duplicates in selected files
      if (files.some(existingFile => existingFile.name === file.name)) {
        errors.push(`${file.name} is already selected`);
        continue;
      }

      // Check combined limit (uploaded + selected + new files)
      const totalAfterAdding = totalFilesInMemory + files.length + validFiles.length + 1;
      if (totalAfterAdding > MAX_FILES) {
        const remainingSlots = MAX_FILES - totalFilesInMemory - files.length;
        errors.push(`Cannot add ${file.name} - only ${remainingSlots} slot${remainingSlots !== 1 ? 's' : ''} remaining`);
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
    setUploadProgress({}); // Reset progress

    try {
      // Get auth info from SWA
      const authResponse = await fetch('/.auth/me');
      const authData = await authResponse.json();
      
      if (!authData.clientPrincipal) {
        setError('Authentication required. Please log in.');
        return;
      }
      
      // Use relative URL to go through Static Web App proxy
      
      // Create headers with auth data
      const authHeaders = {
        'Content-Type': 'application/json',
        'x-ms-client-principal': btoa(JSON.stringify(authData.clientPrincipal))
      };

      const uploadPromises = files.map(async (file) => {
        try {
          // Update progress: Step 1 - Requesting upload URL
          setUploadProgress(prev => ({
            ...prev,
            [file.name]: { step: 'requesting', message: 'Getting upload URL...' }
          }));

          // Step 1: Request SAS token from backend
          console.log(`Requesting SAS token for: ${file.name}`);
          const sasResponse = await axios.post('/api/files/sas', {
            fileName: file.name,
            contentType: file.type || 'text/csv',
            fileSize: file.size
          }, {
            headers: authHeaders,
            timeout: 10000 // 10 second timeout for SAS request
          });

          if (!sasResponse.data.success || !sasResponse.data.uploadUrl) {
            throw new Error(`Failed to get upload URL for ${file.name}: ${sasResponse.data.error || 'Unknown error'}`);
          }

          const { uploadUrl } = sasResponse.data;

          // Update progress: Step 2 - Uploading to storage
          setUploadProgress(prev => ({
            ...prev,
            [file.name]: { step: 'uploading', message: 'Uploading to storage...' }
          }));

          // Step 2: PUT file directly to blob storage
          console.log(`Uploading ${file.name} to blob storage`);
          const blobResponse = await fetch(uploadUrl, {
            method: 'PUT',
            body: file,
            headers: {
              'x-ms-blob-type': 'BlockBlob',
              'Content-Type': file.type || 'text/csv',
              'Content-Length': file.size.toString()
            }
          });

          if (!blobResponse.ok) {
            const errorText = await blobResponse.text();
            throw new Error(`Blob upload failed for ${file.name}: ${blobResponse.status} ${blobResponse.statusText} - ${errorText}`);
          }

          console.log(`Successfully uploaded ${file.name} to blob storage`);

          // Update progress: Complete
          setUploadProgress(prev => ({
            ...prev,
            [file.name]: { step: 'complete', message: 'Upload complete!' }
          }));

          // Return file data for the parent component
          return {
            name: file.name,
            size: file.size,
            type: file.type || 'text/csv',
            lastModified: new Date(file.lastModified).toISOString(),
            originalFile: file // Keep reference to original file for download
          };
        } catch (fileError) {
          console.error(`Upload error for ${file.name}:`, fileError);
          throw new Error(`${file.name}: ${fileError.message}`);
        }
      });

      const uploadedFiles = await Promise.all(uploadPromises);
      
      // Call onFileUploaded for each successfully uploaded file
      uploadedFiles.forEach(fileData => {
        onFileUploaded(fileData);
      });

      // Clear the files and progress after successful upload
      setFiles([]);
      setUploadProgress({});
      
    } catch (err) {
      console.error('Upload process failed:', err);
      
      // Handle different types of errors
      let errorMessage = 'Failed to upload files';
      
      if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      // If it's a quota error, show the specific message
      if (errorMessage.includes('quota') || errorMessage.includes('storage limit')) {
        errorMessage += '. Please delete some files to free up space.';
      }
      
      setError(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-800">Upload CSV Files</h2>
        <span className="text-sm text-gray-500">
          {files.length}/{MAX_FILES - uploadedFilesCount} files selected ({uploadedFilesCount} in storage)
        </span>
      </div>
      
      {/* Privacy Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-medium text-blue-900 mb-1">Data Privacy & Storage</h4>
            <p className="text-sm text-blue-800 mb-2">
              Your files are securely stored in Azure Blob Storage with enterprise-grade encryption. 
              Files are automatically deleted after 90 days of inactivity, and you can delete them anytime.
            </p>
            <p className="text-xs text-blue-700">
              By uploading files, you consent to processing for document analysis and AI chat functionality. 
              Your data remains private and is not shared with third parties.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {/* Drag and Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200 ${
            uploadedFilesCount >= MAX_FILES || files.length >= (MAX_FILES - uploadedFilesCount)
              ? 'border-gray-200 bg-gray-50'
              : isDragOver
              ? 'border-primary-400 bg-primary-50'
              : 'border-gray-300 hover:border-gray-400'
          } ${uploading || uploadedFilesCount >= MAX_FILES || files.length >= (MAX_FILES - uploadedFilesCount) ? 'opacity-50 pointer-events-none' : ''}`}
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
                {uploadedFilesCount >= MAX_FILES
                  ? `Maximum ${MAX_FILES} files in storage - delete some to add more`
                  : files.length >= (MAX_FILES - uploadedFilesCount)
                  ? `Maximum ${MAX_FILES - uploadedFilesCount} files can be staged`
                  : isDragOver
                  ? 'Drop your CSV files here'
                  : 'Drag and drop your CSV files here'}
              </p>
              {uploadedFilesCount < MAX_FILES && files.length < (MAX_FILES - uploadedFilesCount) && (
                <p className="text-sm text-gray-500 mt-1">or</p>
              )}
            </div>
            {uploadedFilesCount < MAX_FILES && files.length < (MAX_FILES - uploadedFilesCount) && (
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
              disabled={uploading || uploadedFilesCount >= MAX_FILES || files.length >= (MAX_FILES - uploadedFilesCount)}
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
                            {uploading && uploadProgress[file.name] ? (
                              <>
                                <div className={`w-2 h-2 rounded-full mr-1 ${
                                  uploadProgress[file.name].step === 'requesting' ? 'bg-blue-400 animate-pulse' :
                                  uploadProgress[file.name].step === 'uploading' ? 'bg-orange-400 animate-pulse' :
                                  uploadProgress[file.name].step === 'complete' ? 'bg-green-400' : 'bg-yellow-400'
                                }`}></div>
                                {uploadProgress[file.name].message}
                              </>
                            ) : (
                              <>
                                <div className="w-2 h-2 bg-yellow-400 rounded-full mr-1"></div>
                                Ready to upload
                              </>
                            )}
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
                  {Math.max(0, MAX_FILES - uploadedFilesCount - files.length)} slot{Math.max(0, MAX_FILES - uploadedFilesCount - files.length) !== 1 ? 's' : ''} remaining
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
            ? `Uploading ${files.length} file${files.length > 1 ? 's' : ''} to blob storage...`
            : `Upload ${files.length} CSV file${files.length > 1 ? 's' : ''} to Storage`}
        </button>
      </div>
    </div>
  );
};

export default FileUpload;
