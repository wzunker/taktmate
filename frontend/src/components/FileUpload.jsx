import React, { useState } from 'react';
import axios from 'axios';
import Card, { CardHeader, CardContent, InfoCard } from './Card';

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
            sizeBytes: file.size
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
          
          // Handle specific error types
          if (fileError.response?.status === 409) {
            // Duplicate file error
            throw new Error(`${file.name}: File already exists. Please rename or delete the existing file first.`);
          } else if (fileError.response?.status === 413) {
            // Quota exceeded error
            throw new Error(`${file.name}: ${fileError.response.data.message || 'Storage quota exceeded'}`);
          } else {
            throw new Error(`${file.name}: ${fileError.response?.data?.message || fileError.message}`);
          }
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
    <Card variant="interactive">
      <CardHeader
        title="Upload CSV Files"
        subtitle="Drag and drop your files or browse to select"
        action={
          <span className="body-small text-text-secondary">
            {files.length}/{MAX_FILES - uploadedFilesCount} selected ({uploadedFilesCount} in storage)
          </span>
        }
      />
      
      {/* Privacy Notice */}
      <InfoCard
        variant="accent"
        className="mb-6"
        icon={
          <svg className="w-6 h-6 text-primary-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        }
        title="Data Privacy & Security"
        description={
          <div className="space-y-2">
            <p className="body-small text-primary-700">
              Your files are securely stored in Azure Blob Storage with enterprise-grade encryption. 
              Files are automatically deleted after 90 days of inactivity, and you can delete them anytime.
            </p>
            <p className="body-xs text-primary-600">
              By uploading files, you consent to processing for document analysis and AI chat functionality. 
              Your data remains private and is not shared with third parties.
            </p>
          </div>
        }
      />

      <CardContent className="space-y-6">
        {/* Drag and Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative border-2 border-dashed rounded-card p-10 text-center transition-all duration-300 ${
            uploadedFilesCount >= MAX_FILES || files.length >= (MAX_FILES - uploadedFilesCount)
              ? 'border-gray-200 bg-background-cream'
              : isDragOver
              ? 'border-primary-500 bg-primary-50 shadow-lg shadow-primary-100'
              : 'border-gray-300 hover:border-primary-400 hover:bg-primary-25'
          } ${uploading || uploadedFilesCount >= MAX_FILES || files.length >= (MAX_FILES - uploadedFilesCount) ? 'opacity-50 pointer-events-none' : ''}`}
        >
          <div className="space-y-6">
            <div className={`mx-auto w-16 h-16 transition-colors duration-300 ${
              isDragOver ? 'text-primary-500' : 'text-gray-400'
            }`}>
              <svg fill="none" stroke="currentColor" viewBox="0 0 64 64" className="w-full h-full">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M32 8v32m0 0l8-8m-8 8l-8-8m24 8v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-8m32-24H16a4 4 0 00-4 4v16"
                />
                <circle cx="32" cy="20" r="2" fill="currentColor" />
              </svg>
            </div>
            <div>
              <p className={`heading-5 transition-colors duration-300 ${
                isDragOver ? 'text-primary-600' : 'text-text-primary'
              }`}>
                {uploadedFilesCount >= MAX_FILES
                  ? `Maximum ${MAX_FILES} files in storage - delete some to add more`
                  : files.length >= (MAX_FILES - uploadedFilesCount)
                  ? `Maximum ${MAX_FILES - uploadedFilesCount} files can be staged`
                  : isDragOver
                  ? '✨ Drop your CSV files here ✨'
                  : 'Drag and drop your CSV files here'}
              </p>
              <p className={`body-small mt-2 transition-colors duration-300 ${
                isDragOver ? 'text-primary-700' : 'text-text-secondary'
              }`}>
                {isDragOver 
                  ? 'Release to upload your files'
                  : 'Supports CSV files up to 5MB each'
                }
              </p>
              {uploadedFilesCount < MAX_FILES && files.length < (MAX_FILES - uploadedFilesCount) && !isDragOver && (
                <p className="body-small mt-1 text-text-muted">or</p>
              )}
            </div>
            {uploadedFilesCount < MAX_FILES && files.length < (MAX_FILES - uploadedFilesCount) && !isDragOver && (
              <label
                htmlFor="csvFile"
                className="inline-flex items-center px-6 py-3 border border-transparent body-normal font-medium rounded-button text-white bg-primary-600 hover:bg-primary-700 cursor-pointer transition-all duration-300 warm-shadow hover:warm-shadow-lg"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                </svg>
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
          <div className="border border-gray-200 rounded-card bg-background-warm-white warm-shadow">
            <div className="px-4 py-3 border-b border-gray-200 bg-background-cream rounded-t-card">
              <h3 className="text-emphasis">
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
                        <div className="w-10 h-10 bg-secondary-100 rounded-card flex items-center justify-center">
                          <svg className="w-5 h-5 text-secondary-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M3 4a1 1 0 011-1h4a1 1 0 01.707.293L10.414 5H16a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm2 3v8h10V8H5z" clipRule="evenodd" />
                            <path d="M7 10h6M7 12h4" stroke="currentColor" strokeWidth="0.5" fill="none" />
                          </svg>
                        </div>
                      </div>
                      
                      {/* File Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => downloadFile(file)}
                            className="text-emphasis truncate hover:text-primary-600 transition-colors cursor-pointer text-left"
                          >
                            {file.name}
                          </button>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-badge text-xs font-medium bg-secondary-100 text-secondary-800">
                            CSV
                          </span>
                        </div>
                        <div className="flex items-center mt-1 space-x-4 body-xs">
                          <span>{(file.size / 1024).toFixed(1)} KB</span>
                          <span>•</span>
                          <span>{new Date().toLocaleDateString()}</span>
                          <span>•</span>
                          <span className="inline-flex items-center">
                            {uploading && uploadProgress[file.name] ? (
                              <>
                                <div className={`w-2 h-2 rounded-full mr-2 ${
                                  uploadProgress[file.name].step === 'requesting' ? 'bg-secondary-400 animate-pulse' :
                                  uploadProgress[file.name].step === 'uploading' ? 'bg-primary-400 animate-pulse' :
                                  uploadProgress[file.name].step === 'complete' ? 'bg-green-400' : 'bg-primary-300'
                                }`}></div>
                                <span className="font-medium">{uploadProgress[file.name].message}</span>
                              </>
                            ) : (
                              <>
                                <div className="w-2 h-2 bg-primary-300 rounded-full mr-2"></div>
                                <span className="text-text-muted">Ready to upload</span>
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
            <div className="px-4 py-3 bg-background-cream border-t border-gray-200 rounded-b-card">
              <div className="flex items-center justify-between body-xs">
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
          <div className="body-small text-red-700 bg-red-50 border border-red-200 p-4 rounded-card warm-shadow">
            <div className="flex items-start space-x-2">
              <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span className="flex-1">{error}</span>
            </div>
          </div>
        )}

        <button
          onClick={handleUpload}
          disabled={files.length === 0 || uploading}
          className="w-full bg-primary-600 text-white py-3 px-4 rounded-button hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors body-normal font-medium warm-shadow-lg"
        >
          {uploading
            ? `Uploading ${files.length} file${files.length > 1 ? 's' : ''} to blob storage...`
            : `Upload ${files.length} CSV file${files.length > 1 ? 's' : ''} to Storage`}
        </button>
      </CardContent>
    </Card>
  );
};

export default FileUpload;
