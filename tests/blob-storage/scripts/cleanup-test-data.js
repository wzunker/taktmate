#!/usr/bin/env node

/**
 * Test Data Cleanup Script
 * Removes all test-generated containers and blobs
 */

const { BlobServiceClient } = require('@azure/storage-blob');
const { DefaultAzureCredential } = require('@azure/identity');

async function cleanupTestData() {
  console.log('Starting test data cleanup...');
  
  try {
    const storageAccountName = process.env.STORAGE_ACCOUNT_NAME || 'taktmateblob';
    const credential = new DefaultAzureCredential();
    const blobServiceClient = new BlobServiceClient(
      `https://${storageAccountName}.blob.core.windows.net`,
      credential
    );
    
    console.log(`Connected to storage account: ${storageAccountName}`);
    
    let deletedContainers = 0;
    let totalBlobs = 0;
    
    // List all containers
    for await (const container of blobServiceClient.listContainers()) {
      // Only delete test containers (those starting with 'test-' or containing 'test')
      if (container.name.includes('test') || container.name.startsWith('u-test')) {
        console.log(`Found test container: ${container.name}`);
        
        const containerClient = blobServiceClient.getContainerClient(container.name);
        
        // Count blobs in container
        let blobCount = 0;
        try {
          for await (const blob of containerClient.listBlobsFlat()) {
            blobCount++;
          }
          totalBlobs += blobCount;
          
          // Delete the entire container (this deletes all blobs within it)
          await containerClient.delete();
          console.log(`  ✓ Deleted container with ${blobCount} blobs`);
          deletedContainers++;
          
        } catch (error) {
          console.log(`  ✗ Failed to delete container: ${error.message}`);
        }
      }
    }
    
    console.log('\n=== Cleanup Summary ===');
    console.log(`Deleted containers: ${deletedContainers}`);
    console.log(`Total blobs removed: ${totalBlobs}`);
    console.log('✓ Test data cleanup completed');
    
  } catch (error) {
    console.error('Failed to cleanup test data:', error.message);
    console.error('Make sure you have proper Azure credentials configured');
    process.exit(1);
  }
}

// Handle command line execution
if (require.main === module) {
  cleanupTestData()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Cleanup failed:', error);
      process.exit(1);
    });
}

module.exports = { cleanupTestData };
