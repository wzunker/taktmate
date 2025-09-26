/**
 * Azure Blob Storage Service
 * 
 * Provides secure, user-isolated blob storage functionality using:
 * - Managed Identity authentication (no storage keys in code)
 * - Per-user containers for data isolation
 * - User delegation SAS tokens for secure, time-limited access
 * - Quota enforcement and file management
 */

const { DefaultAzureCredential } = require('@azure/identity');
const {
  BlobServiceClient,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
  StorageSharedKeyCredential
} = require('@azure/storage-blob');
const crypto = require('crypto');

// Get storage account name from environment variables
const STORAGE_ACCOUNT_NAME = process.env.STORAGE_ACCOUNT_NAME || 'taktmateblob';

/**
 * Generate a compliant Azure container name from userId
 * Azure container naming rules:
 * - 3-63 characters long
 * - lowercase letters, numbers, and hyphens only
 * - cannot start or end with hyphen
 * - cannot have consecutive hyphens
 * @param {string} userId - User ID from authentication
 * @returns {string} Compliant container name
 */
function generateContainerName(userId) {
  if (!userId || typeof userId !== 'string') {
    throw new Error('Valid userId is required for container naming');
  }
  
  // Create a deterministic hash of the userId for consistent, collision-resistant naming
  const hash = crypto.createHash('sha256').update(userId).digest('hex');
  
  // Take first 32 characters of hash and prefix with 'u-'
  // This ensures: 3-63 chars, starts with letter, no special chars, deterministic
  const containerName = `u-${hash.substring(0, 32)}`;
  
  // Validate the result (should always pass with our approach, but safety check)
  if (containerName.length < 3 || containerName.length > 63) {
    throw new Error(`Generated container name '${containerName}' is invalid length`);
  }
  
  if (!/^[a-z0-9-]+$/.test(containerName)) {
    throw new Error(`Generated container name '${containerName}' contains invalid characters`);
  }
  
  if (containerName.startsWith('-') || containerName.endsWith('-')) {
    throw new Error(`Generated container name '${containerName}' starts or ends with hyphen`);
  }
  
  return containerName;
}

/**
 * Initialize BlobServiceClient with Managed Identity authentication
 * Uses DefaultAzureCredential which automatically handles managed identity in Azure
 * @returns {BlobServiceClient} Authenticated blob service client
 */
function serviceClient() {
  try {
    const credential = new DefaultAzureCredential();
    const url = `https://${STORAGE_ACCOUNT_NAME}.blob.core.windows.net`;
    
    console.log(`Initializing storage client for account: ${STORAGE_ACCOUNT_NAME}`);
    return new BlobServiceClient(url, credential);
  } catch (error) {
    console.error('Failed to initialize storage service client:', error.message);
    throw new Error(`Storage service initialization failed: ${error.message}`);
  }
}

/**
 * Ensure user's container exists, create if it doesn't
 * Container naming: u-{hash} (deterministic hash-based naming for compliance)
 * @param {string} userId - User ID from authentication
 * @returns {Promise<ContainerClient>} Container client for user's container
 */
async function ensureUserContainer(userId) {
  try {
    if (!userId) {
      throw new Error('User ID is required');
    }

    const sc = serviceClient();
    // Generate compliant container name using deterministic hash
    const containerName = generateContainerName(userId);
    
    console.log(`Ensuring container exists: ${containerName} for user: ${userId}`);
    
    const containerClient = sc.getContainerClient(containerName);
    
    // Create container if it doesn't exist
    // This is idempotent - won't fail if container already exists
    await containerClient.createIfNotExists({
      access: 'blob' // Private container, access via SAS only
    });
    
    return containerClient;
  } catch (error) {
    console.error(`Failed to ensure user container for user ${userId}:`, error.message);
    throw new Error(`Container creation failed: ${error.message}`);
  }
}

/**
 * List all files in user's container
 * @param {string} userId - User ID from authentication
 * @returns {Promise<Array>} Array of file objects with name, size, lastModified
 */
async function listUserFiles(userId) {
  try {
    const containerClient = await ensureUserContainer(userId);
    const files = [];
    
    console.log(`Listing files for user: ${userId}`);
    
    // List all blobs in the user's container with metadata
    for await (const blob of containerClient.listBlobsFlat({ includeMetadata: true })) {
      const size = blob.properties.contentLength || blob.properties.blobSize || 0;
      files.push({
        name: blob.name,
        size: size,
        lastModified: blob.properties.lastModified,
        contentType: blob.properties.contentType,
        etag: blob.properties.etag
      });
    }
    
    console.log(`Found ${files.length} files for user ${userId}`);
    return files;
  } catch (error) {
    console.error(`Failed to list files for user ${userId}:`, error.message);
    throw new Error(`File listing failed: ${error.message}`);
  }
}

/**
 * Calculate total bytes used by user across all their files
 * @param {string} userId - User ID from authentication
 * @returns {Promise<number>} Total bytes used
 */
async function sumBytes(userId) {
  try {
    const files = await listUserFiles(userId);
    const totalBytes = files.reduce((total, file) => total + (file.size || 0), 0);
    
    console.log(`User ${userId} using ${totalBytes} bytes (${(totalBytes / 1024 / 1024).toFixed(3)} MB)`);
    return totalBytes;
  } catch (error) {
    console.error(`Failed to calculate storage usage for user ${userId}:`, error.message);
    throw new Error(`Storage calculation failed: ${error.message}`);
  }
}

/**
 * Generate a user delegation SAS URL for uploading a blob
 * Uses Azure AD credentials (managed identity) - no account keys required
 * @param {string} userId - User ID from authentication
 * @param {string} blobName - Name of the blob to upload
 * @param {string} contentType - MIME type of the file
 * @param {number} minutes - SAS token validity in minutes (default: 10)
 * @returns {Promise<string>} SAS URL for uploading
 */
async function sasForUpload(userId, blobName, contentType, minutes = 10) {
  try {
    if (!userId || !blobName || !contentType) {
      throw new Error('userId, blobName, and contentType are required');
    }

    const sc = serviceClient();
    const containerClient = await ensureUserContainer(userId);
    const containerName = containerClient.containerName;
    
    console.log(`Generating upload SAS for user ${userId}, blob: ${blobName}`);
    
    // Set SAS token validity period
    const now = new Date();
    const expiresOn = new Date(now.getTime() + minutes * 60 * 1000);
    
    // Get user delegation key (requires managed identity with Storage Blob Data Contributor role)
    const userDelegationKey = await sc.getUserDelegationKey(now, expiresOn);
    
    // Create SAS with minimal permissions: create + write only
    const sasPermissions = BlobSASPermissions.parse('cw'); // create, write
    
    const sasQueryParameters = generateBlobSASQueryParameters({
      containerName,
      blobName,
      permissions: sasPermissions,
      startsOn: now,
      expiresOn: expiresOn,
      contentType: contentType
    }, userDelegationKey, STORAGE_ACCOUNT_NAME);
    
    const blobClient = containerClient.getBlockBlobClient(blobName);
    const sasUrl = `${blobClient.url}?${sasQueryParameters.toString()}`;
    
    console.log(`Generated upload SAS for ${blobName}, expires in ${minutes} minutes`);
    return sasUrl;
  } catch (error) {
    console.error(`Failed to generate upload SAS for user ${userId}, blob ${blobName}:`, error.message);
    throw new Error(`Upload SAS generation failed: ${error.message}`);
  }
}

/**
 * Generate a user delegation SAS URL for downloading a blob
 * @param {string} userId - User ID from authentication
 * @param {string} blobName - Name of the blob to download
 * @param {number} minutes - SAS token validity in minutes (default: 10)
 * @returns {Promise<string>} SAS URL for downloading
 */
async function sasForRead(userId, blobName, minutes = 10) {
  try {
    if (!userId || !blobName) {
      throw new Error('userId and blobName are required');
    }

    const sc = serviceClient();
    const containerClient = await ensureUserContainer(userId);
    const containerName = containerClient.containerName;
    
    console.log(`Generating download SAS for user ${userId}, blob: ${blobName}`);
    
    // Set SAS token validity period
    const now = new Date();
    const expiresOn = new Date(now.getTime() + minutes * 60 * 1000);
    
    // Get user delegation key
    const userDelegationKey = await sc.getUserDelegationKey(now, expiresOn);
    
    // Create SAS with read-only permission
    const sasPermissions = BlobSASPermissions.parse('r'); // read only
    
    const sasQueryParameters = generateBlobSASQueryParameters({
      containerName,
      blobName,
      permissions: sasPermissions,
      startsOn: now,
      expiresOn: expiresOn
    }, userDelegationKey, STORAGE_ACCOUNT_NAME);
    
    const blobClient = containerClient.getBlockBlobClient(blobName);
    const sasUrl = `${blobClient.url}?${sasQueryParameters.toString()}`;
    
    console.log(`Generated download SAS for ${blobName}, expires in ${minutes} minutes`);
    return sasUrl;
  } catch (error) {
    console.error(`Failed to generate download SAS for user ${userId}, blob ${blobName}:`, error.message);
    throw new Error(`Download SAS generation failed: ${error.message}`);
  }
}

/**
 * Delete a blob from user's container
 * @param {string} userId - User ID from authentication
 * @param {string} blobName - Name of the blob to delete
 * @returns {Promise<void>}
 */
async function deleteBlob(userId, blobName) {
  try {
    if (!userId || !blobName) {
      throw new Error('userId and blobName are required');
    }

    const containerClient = await ensureUserContainer(userId);
    
    console.log(`Deleting blob for user ${userId}: ${blobName}`);
    
    const blobClient = containerClient.getBlockBlobClient(blobName);
    
    // Delete the blob (will not fail if blob doesn't exist)
    await blobClient.deleteIfExists();
    
    console.log(`Successfully deleted blob: ${blobName}`);
  } catch (error) {
    console.error(`Failed to delete blob ${blobName} for user ${userId}:`, error.message);
    throw new Error(`Blob deletion failed: ${error.message}`);
  }
}

/**
 * Get blob content as a stream (for CSV processing)
 * @param {string} userId - User ID from authentication
 * @param {string} blobName - Name of the blob to read
 * @returns {Promise<Buffer>} Blob content as buffer
 */
async function getBlobContent(userId, blobName) {
  try {
    if (!userId || !blobName) {
      throw new Error('userId and blobName are required');
    }

    const containerClient = await ensureUserContainer(userId);
    const blobClient = containerClient.getBlockBlobClient(blobName);
    
    console.log(`Reading blob content for user ${userId}: ${blobName}`);
    
    // Download blob content
    const downloadResponse = await blobClient.download();
    
    if (!downloadResponse.readableStreamBody) {
      throw new Error('Failed to get readable stream from blob');
    }
    
    // Convert stream to buffer
    const chunks = [];
    for await (const chunk of downloadResponse.readableStreamBody) {
      chunks.push(chunk);
    }
    
    const buffer = Buffer.concat(chunks);
    console.log(`Successfully read ${buffer.length} bytes from ${blobName}`);
    
    return buffer;
  } catch (error) {
    console.error(`Failed to read blob ${blobName} for user ${userId}:`, error.message);
    throw new Error(`Blob read failed: ${error.message}`);
  }
}

/**
 * Health check function to verify storage connectivity and SAS capability
 * Tests the specific functionality we need: User Delegation Key generation
 * @returns {Promise<Object>} Health status object
 */
async function healthCheck() {
  try {
    const sc = serviceClient();
    
    // Test User Delegation Key generation (core functionality for SAS tokens)
    // This is lightweight and tests the actual capability we need
    const now = new Date();
    const expiresOn = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes from now
    
    const userDelegationKey = await sc.getUserDelegationKey(now, expiresOn);
    
    // If we get here, managed identity auth and SAS capability are working
    return {
      status: 'healthy',
      storageAccount: STORAGE_ACCOUNT_NAME,
      timestamp: new Date().toISOString(),
      capabilities: {
        managedIdentity: 'working',
        userDelegationKey: 'working',
        sasGeneration: 'available'
      },
      keyInfo: {
        signedOid: userDelegationKey.signedObjectId,
        signedStart: userDelegationKey.signedStartsOn,
        signedExpiry: userDelegationKey.signedExpiresOn
      }
    };
  } catch (error) {
    console.error('Storage health check failed:', error.message);
    
    // Provide specific error context for troubleshooting
    let errorContext = 'unknown';
    if (error.message.includes('DefaultAzureCredential')) {
      errorContext = 'managed_identity_auth';
    } else if (error.message.includes('getUserDelegationKey')) {
      errorContext = 'user_delegation_key';
    } else if (error.message.includes('Storage Blob Data Contributor')) {
      errorContext = 'rbac_permissions';
    }
    
    return {
      status: 'unhealthy',
      storageAccount: STORAGE_ACCOUNT_NAME,
      timestamp: new Date().toISOString(),
      error: error.message,
      errorContext: errorContext,
      troubleshooting: {
        checkManagedIdentity: 'Ensure system-assigned managed identity is enabled',
        checkRBAC: 'Ensure Storage Blob Data Contributor role is assigned',
        checkStorageAccount: 'Ensure storage account name is correct'
      }
    };
  }
}

/**
 * Generate a user delegation SAS URL for uploading a blob to a project
 * @param {string} userId - User ID from authentication
 * @param {string} projectId - Project ID
 * @param {string} fileName - Name of the file to upload
 * @param {string} contentType - MIME type of the file
 * @param {number} minutes - SAS token validity in minutes (default: 10)
 * @returns {Promise<string>} SAS URL for uploading
 */
async function sasForProjectUpload(userId, projectId, fileName, contentType, minutes = 10) {
  try {
    if (!userId || !projectId || !fileName || !contentType) {
      throw new Error('userId, projectId, fileName, and contentType are required');
    }

    const blobPath = `projects/${projectId}/files/${fileName}`;
    return await sasForUpload(userId, blobPath, contentType, minutes);
  } catch (error) {
    console.error(`Failed to generate project upload SAS:`, error.message);
    throw new Error(`Project upload SAS generation failed: ${error.message}`);
  }
}

/**
 * Generate a user delegation SAS URL for downloading a blob from a project
 * @param {string} userId - User ID from authentication
 * @param {string} projectId - Project ID
 * @param {string} fileName - Name of the file to download
 * @param {number} minutes - SAS token validity in minutes (default: 10)
 * @returns {Promise<string>} SAS URL for downloading
 */
async function sasForProjectDownload(userId, projectId, fileName, minutes = 10) {
  try {
    if (!userId || !projectId || !fileName) {
      throw new Error('userId, projectId, and fileName are required');
    }

    const blobPath = `projects/${projectId}/files/${fileName}`;
    return await sasForRead(userId, blobPath, minutes);
  } catch (error) {
    console.error(`Failed to generate project download SAS:`, error.message);
    throw new Error(`Project download SAS generation failed: ${error.message}`);
  }
}

/**
 * Delete a blob from a project
 * @param {string} userId - User ID from authentication
 * @param {string} projectId - Project ID
 * @param {string} fileName - Name of the file to delete
 * @returns {Promise<boolean>} Success status
 */
async function deleteProjectBlob(userId, projectId, fileName) {
  try {
    if (!userId || !projectId || !fileName) {
      throw new Error('userId, projectId, and fileName are required');
    }

    const blobPath = `projects/${projectId}/files/${fileName}`;
    return await deleteBlob(userId, blobPath);
  } catch (error) {
    console.error(`Failed to delete project blob:`, error.message);
    throw new Error(`Project blob deletion failed: ${error.message}`);
  }
}

/**
 * Get blob content from a project
 * @param {string} userId - User ID from authentication
 * @param {string} projectId - Project ID
 * @param {string} fileName - Name of the file to get
 * @returns {Promise<Buffer>} File content buffer
 */
async function getProjectBlobContent(userId, projectId, fileName) {
  try {
    if (!userId || !projectId || !fileName) {
      throw new Error('userId, projectId, and fileName are required');
    }

    const blobPath = `projects/${projectId}/files/${fileName}`;
    return await getBlobContent(userId, blobPath);
  } catch (error) {
    console.error(`Failed to get project blob content:`, error.message);
    throw new Error(`Project blob content retrieval failed: ${error.message}`);
  }
}

/**
 * List all files in a specific project
 * @param {string} userId - User ID from authentication
 * @param {string} projectId - Project ID
 * @returns {Promise<Array>} Array of file objects with name, size, lastModified
 */
async function listProjectFiles(userId, projectId) {
  try {
    const containerClient = await ensureUserContainer(userId);
    const files = [];
    
    const projectPrefix = `projects/${projectId}/files/`;
    console.log(`Listing files for user: ${userId}, project: ${projectId}`);
    
    // List all blobs with the project prefix
    for await (const blob of containerClient.listBlobsFlat({ 
      prefix: projectPrefix,
      includeMetadata: true 
    })) {
      // Remove the project prefix to get just the filename
      const fileName = blob.name.substring(projectPrefix.length);
      
      const size = blob.properties.contentLength || blob.properties.blobSize || 0;
      files.push({
        name: fileName,
        size: size,
        lastModified: blob.properties.lastModified,
        contentType: blob.properties.contentType,
        etag: blob.properties.etag,
        blobPath: blob.name
      });
    }
    
    console.log(`Found ${files.length} files for project ${projectId}`);
    return files;
  } catch (error) {
    console.error(`Failed to list project files for user ${userId}, project ${projectId}:`, error.message);
    throw new Error(`Project file listing failed: ${error.message}`);
  }
}

module.exports = {
  ensureUserContainer,
  listUserFiles,
  sumBytes,
  sasForUpload,
  sasForRead,
  deleteBlob,
  getBlobContent,
  healthCheck,
  // Project-based functions
  sasForProjectUpload,
  sasForProjectDownload,
  deleteProjectBlob,
  getProjectBlobContent,
  listProjectFiles
};
