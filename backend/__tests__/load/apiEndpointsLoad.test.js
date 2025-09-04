// API Endpoints Load Testing
// Tests API performance under concurrent user load

const request = require('supertest');
const app = require('../../index');
const fs = require('fs');
const path = require('path');

// Mock dependencies for load testing
jest.mock('@azure/msal-node');
jest.mock('../../services/azureB2CApiService');

describe('API Endpoints Load Testing', () => {
  const mockUsers = Array.from({ length: 50 }, (_, i) => ({
    id: `load-user-${i + 1}`,
    email: `loadtest${i + 1}@example.com`,
    accessToken: `mock-token-${i + 1}`
  }));

  // Create test CSV content for file operations
  const testCsvContent = Array.from({ length: 1000 }, (_, i) => 
    `${i + 1},Product ${i + 1},${(Math.random() * 100).toFixed(2)},${Math.floor(Math.random() * 100)}`
  ).join('\n');

  const testCsvHeader = 'id,name,price,quantity\n';
  const fullTestCsv = testCsvHeader + testCsvContent;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('File Upload Load Testing', () => {
    test('should handle concurrent file uploads', async () => {
      const concurrentUploads = 25;
      const startTime = Date.now();
      
      const uploadPromises = Array.from({ length: concurrentUploads }, (_, i) =>
        request(app)
          .post('/api/upload')
          .set('Authorization', `Bearer ${mockUsers[i % mockUsers.length].accessToken}`)
          .attach('file', Buffer.from(fullTestCsv), `load-test-${i + 1}.csv`)
          .expect(res => {
            expect([200, 201, 413, 429, 503]).toContain(res.status);
          })
      );

      const results = await Promise.allSettled(uploadPromises);
      const duration = Date.now() - startTime;
      
      const successful = results.filter(r => 
        r.status === 'fulfilled' && [200, 201].includes(r.value.status)
      ).length;
      const tooLarge = results.filter(r => 
        r.status === 'fulfilled' && r.value.status === 413
      ).length;
      const rateLimited = results.filter(r => 
        r.status === 'fulfilled' && r.value.status === 429
      ).length;
      const serviceUnavailable = results.filter(r => 
        r.status === 'fulfilled' && r.value.status === 503
      ).length;
      
      console.log(`File Upload Load Test Results:`);
      console.log(`  Duration: ${duration}ms`);
      console.log(`  Successful: ${successful}/${concurrentUploads}`);
      console.log(`  Too Large: ${tooLarge}/${concurrentUploads}`);
      console.log(`  Rate Limited: ${rateLimited}/${concurrentUploads}`);
      console.log(`  Service Unavailable: ${serviceUnavailable}/${concurrentUploads}`);
      console.log(`  Average Response Time: ${(duration / concurrentUploads).toFixed(2)}ms`);
      
      // Performance assertions
      expect(duration).toBeLessThan(30000); // Should complete within 30 seconds
      expect(successful + rateLimited).toBeGreaterThan(concurrentUploads * 0.7); // 70% should not fail
      expect(serviceUnavailable).toBeLessThan(concurrentUploads * 0.1); // Less than 10% service unavailable
    });

    test('should handle large file uploads under load', async () => {
      const concurrentLargeUploads = 10;
      const largeFileSize = 5 * 1024 * 1024; // 5MB
      const largeFileContent = Buffer.alloc(largeFileSize, 'a');
      const startTime = Date.now();
      
      const uploadPromises = Array.from({ length: concurrentLargeUploads }, (_, i) =>
        request(app)
          .post('/api/upload')
          .set('Authorization', `Bearer ${mockUsers[i % mockUsers.length].accessToken}`)
          .attach('file', largeFileContent, `large-load-test-${i + 1}.txt`)
          .timeout(60000) // 60 second timeout for large files
          .expect(res => {
            expect([200, 201, 413, 429, 503]).toContain(res.status);
          })
      );

      const results = await Promise.allSettled(uploadPromises);
      const duration = Date.now() - startTime;
      
      const successful = results.filter(r => 
        r.status === 'fulfilled' && [200, 201].includes(r.value.status)
      ).length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      console.log(`Large File Upload Load Test Results:`);
      console.log(`  File Size: ${(largeFileSize / 1024 / 1024).toFixed(2)}MB each`);
      console.log(`  Duration: ${duration}ms`);
      console.log(`  Successful: ${successful}/${concurrentLargeUploads}`);
      console.log(`  Failed: ${failed}/${concurrentLargeUploads}`);
      console.log(`  Average Time per Upload: ${(duration / concurrentLargeUploads).toFixed(2)}ms`);
      
      // Performance assertions for large files
      expect(duration).toBeLessThan(120000); // Should complete within 2 minutes
      expect(successful).toBeGreaterThan(concurrentLargeUploads * 0.5); // 50% success rate for large files
      expect(failed).toBeLessThan(concurrentLargeUploads * 0.3); // Less than 30% complete failures
    });
  });

  describe('CSV Processing Load Testing', () => {
    test('should handle concurrent CSV processing requests', async () => {
      const concurrentProcessing = 20;
      const startTime = Date.now();
      
      const processingPromises = Array.from({ length: concurrentProcessing }, (_, i) =>
        request(app)
          .post('/api/process-csv')
          .set('Authorization', `Bearer ${mockUsers[i % mockUsers.length].accessToken}`)
          .send({
            csvData: fullTestCsv,
            filename: `load-test-${i + 1}.csv`
          })
          .expect(res => {
            expect([200, 400, 429, 503]).toContain(res.status);
          })
      );

      const results = await Promise.allSettled(processingPromises);
      const duration = Date.now() - startTime;
      
      const successful = results.filter(r => 
        r.status === 'fulfilled' && r.value.status === 200
      ).length;
      const badRequest = results.filter(r => 
        r.status === 'fulfilled' && r.value.status === 400
      ).length;
      const rateLimited = results.filter(r => 
        r.status === 'fulfilled' && r.value.status === 429
      ).length;
      
      console.log(`CSV Processing Load Test Results:`);
      console.log(`  Duration: ${duration}ms`);
      console.log(`  Successful: ${successful}/${concurrentProcessing}`);
      console.log(`  Bad Request: ${badRequest}/${concurrentProcessing}`);
      console.log(`  Rate Limited: ${rateLimited}/${concurrentProcessing}`);
      console.log(`  Processing Rate: ${((successful / duration) * 1000).toFixed(2)} files/second`);
      
      // Performance assertions
      expect(duration).toBeLessThan(25000); // Should complete within 25 seconds
      expect(successful + rateLimited).toBeGreaterThan(concurrentProcessing * 0.8); // 80% should not fail
    });

    test('should handle large CSV processing under load', async () => {
      const concurrentLargeProcessing = 8;
      const largeRowCount = 10000;
      const largeCsvContent = testCsvHeader + Array.from({ length: largeRowCount }, (_, i) => 
        `${i + 1},Product ${i + 1},${(Math.random() * 100).toFixed(2)},${Math.floor(Math.random() * 100)}`
      ).join('\n');
      
      const startTime = Date.now();
      
      const processingPromises = Array.from({ length: concurrentLargeProcessing }, (_, i) =>
        request(app)
          .post('/api/process-csv')
          .set('Authorization', `Bearer ${mockUsers[i % mockUsers.length].accessToken}`)
          .send({
            csvData: largeCsvContent,
            filename: `large-load-test-${i + 1}.csv`
          })
          .timeout(120000) // 2 minute timeout for large CSV processing
          .expect(res => {
            expect([200, 400, 413, 429, 503]).toContain(res.status);
          })
      );

      const results = await Promise.allSettled(processingPromises);
      const duration = Date.now() - startTime;
      
      const successful = results.filter(r => 
        r.status === 'fulfilled' && r.value.status === 200
      ).length;
      
      console.log(`Large CSV Processing Load Test Results:`);
      console.log(`  Rows per CSV: ${largeRowCount}`);
      console.log(`  Duration: ${duration}ms`);
      console.log(`  Successful: ${successful}/${concurrentLargeProcessing}`);
      console.log(`  Average Processing Time: ${(duration / concurrentLargeProcessing).toFixed(2)}ms`);
      console.log(`  Rows Processed per Second: ${((successful * largeRowCount / duration) * 1000).toFixed(2)}`);
      
      // Performance assertions for large CSV processing
      expect(duration).toBeLessThan(180000); // Should complete within 3 minutes
      expect(successful).toBeGreaterThan(concurrentLargeProcessing * 0.6); // 60% success rate
    });
  });

  describe('Chat API Load Testing', () => {
    test('should handle concurrent chat requests', async () => {
      const concurrentChats = 30;
      const startTime = Date.now();
      
      const chatPromises = Array.from({ length: concurrentChats }, (_, i) =>
        request(app)
          .post('/api/chat')
          .set('Authorization', `Bearer ${mockUsers[i % mockUsers.length].accessToken}`)
          .send({
            message: `Load test message ${i + 1}: What insights can you provide about this data?`,
            csvData: fullTestCsv.substring(0, 1000) // Truncated for faster processing
          })
          .expect(res => {
            expect([200, 400, 429, 503]).toContain(res.status);
          })
      );

      const results = await Promise.allSettled(chatPromises);
      const duration = Date.now() - startTime;
      
      const successful = results.filter(r => 
        r.status === 'fulfilled' && r.value.status === 200
      ).length;
      const rateLimited = results.filter(r => 
        r.status === 'fulfilled' && r.value.status === 429
      ).length;
      const serviceUnavailable = results.filter(r => 
        r.status === 'fulfilled' && r.value.status === 503
      ).length;
      
      console.log(`Chat API Load Test Results:`);
      console.log(`  Duration: ${duration}ms`);
      console.log(`  Successful: ${successful}/${concurrentChats}`);
      console.log(`  Rate Limited: ${rateLimited}/${concurrentChats}`);
      console.log(`  Service Unavailable: ${serviceUnavailable}/${concurrentChats}`);
      console.log(`  Average Response Time: ${(duration / concurrentChats).toFixed(2)}ms`);
      
      // Performance assertions
      expect(duration).toBeLessThan(45000); // Should complete within 45 seconds
      expect(successful + rateLimited).toBeGreaterThan(concurrentChats * 0.6); // 60% should not fail
      expect(serviceUnavailable).toBeLessThan(concurrentChats * 0.2); // Less than 20% service unavailable
    });

    test('should handle streaming chat responses under load', async () => {
      const concurrentStreams = 15;
      const startTime = Date.now();
      
      const streamPromises = Array.from({ length: concurrentStreams }, (_, i) =>
        new Promise((resolve, reject) => {
          const chunks = [];
          const req = request(app)
            .post('/api/chat/stream')
            .set('Authorization', `Bearer ${mockUsers[i % mockUsers.length].accessToken}`)
            .send({
              message: `Streaming load test ${i + 1}: Analyze this data in detail.`,
              csvData: fullTestCsv.substring(0, 500)
            });

          req.on('data', chunk => {
            chunks.push(chunk);
          });

          req.on('end', () => {
            resolve({
              status: 200,
              chunks: chunks.length,
              totalSize: chunks.reduce((sum, chunk) => sum + chunk.length, 0)
            });
          });

          req.on('error', error => {
            if (error.status && [429, 503].includes(error.status)) {
              resolve({ status: error.status, error: error.message });
            } else {
              reject(error);
            }
          });

          // Timeout after 30 seconds
          setTimeout(() => {
            req.abort();
            resolve({ status: 'timeout' });
          }, 30000);
        })
      );

      const results = await Promise.allSettled(streamPromises);
      const duration = Date.now() - startTime;
      
      const successful = results.filter(r => 
        r.status === 'fulfilled' && r.value.status === 200
      ).length;
      const rateLimited = results.filter(r => 
        r.status === 'fulfilled' && [429, 503].includes(r.value.status)
      ).length;
      const timeouts = results.filter(r => 
        r.status === 'fulfilled' && r.value.status === 'timeout'
      ).length;
      
      console.log(`Streaming Chat Load Test Results:`);
      console.log(`  Duration: ${duration}ms`);
      console.log(`  Successful: ${successful}/${concurrentStreams}`);
      console.log(`  Rate Limited: ${rateLimited}/${concurrentStreams}`);
      console.log(`  Timeouts: ${timeouts}/${concurrentStreams}`);
      
      // Performance assertions for streaming
      expect(successful + rateLimited).toBeGreaterThan(concurrentStreams * 0.7); // 70% should not timeout
      expect(timeouts).toBeLessThan(concurrentStreams * 0.2); // Less than 20% timeouts
    });
  });

  describe('Mixed API Operations Load Testing', () => {
    test('should handle mixed API operations under realistic load', async () => {
      const totalOperations = 100;
      const startTime = Date.now();
      
      // Realistic mix of operations
      const operations = [
        // File uploads (20%)
        ...Array.from({ length: Math.floor(totalOperations * 0.2) }, (_, i) =>
          () => request(app)
            .post('/api/upload')
            .set('Authorization', `Bearer ${mockUsers[i % mockUsers.length].accessToken}`)
            .attach('file', Buffer.from(fullTestCsv), `mixed-test-${i}.csv`)
        ),
        // CSV processing (30%)
        ...Array.from({ length: Math.floor(totalOperations * 0.3) }, (_, i) =>
          () => request(app)
            .post('/api/process-csv')
            .set('Authorization', `Bearer ${mockUsers[i % mockUsers.length].accessToken}`)
            .send({ csvData: fullTestCsv, filename: `mixed-process-${i}.csv` })
        ),
        // Chat requests (25%)
        ...Array.from({ length: Math.floor(totalOperations * 0.25) }, (_, i) =>
          () => request(app)
            .post('/api/chat')
            .set('Authorization', `Bearer ${mockUsers[i % mockUsers.length].accessToken}`)
            .send({ message: `Mixed load test ${i}`, csvData: fullTestCsv.substring(0, 800) })
        ),
        // File list requests (15%)
        ...Array.from({ length: Math.floor(totalOperations * 0.15) }, (_, i) =>
          () => request(app)
            .get('/api/files')
            .set('Authorization', `Bearer ${mockUsers[i % mockUsers.length].accessToken}`)
        ),
        // Health checks (10%)
        ...Array.from({ length: Math.floor(totalOperations * 0.1) }, () =>
          () => request(app).get('/api/health')
        )
      ];

      // Shuffle operations for realistic mixed load
      const shuffledOperations = operations.sort(() => Math.random() - 0.5);
      
      const operationPromises = shuffledOperations.map(operation => 
        operation().expect(res => {
          expect(res.status).toBeGreaterThanOrEqual(200);
          expect(res.status).toBeLessThan(600);
        })
      );

      const results = await Promise.allSettled(operationPromises);
      const duration = Date.now() - startTime;
      
      const successful = results.filter(r => 
        r.status === 'fulfilled' && r.value.status < 400
      ).length;
      const clientErrors = results.filter(r => 
        r.status === 'fulfilled' && r.value.status >= 400 && r.value.status < 500
      ).length;
      const serverErrors = results.filter(r => 
        r.status === 'fulfilled' && r.value.status >= 500
      ).length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      console.log(`Mixed API Operations Load Test Results:`);
      console.log(`  Total Operations: ${totalOperations}`);
      console.log(`  Duration: ${duration}ms`);
      console.log(`  Successful (2xx-3xx): ${successful}`);
      console.log(`  Client Errors (4xx): ${clientErrors}`);
      console.log(`  Server Errors (5xx): ${serverErrors}`);
      console.log(`  Failed: ${failed}`);
      console.log(`  Throughput: ${((totalOperations / duration) * 1000).toFixed(2)} ops/sec`);
      console.log(`  Average Response Time: ${(duration / totalOperations).toFixed(2)}ms`);
      
      // Performance assertions
      expect(duration).toBeLessThan(60000); // Should complete within 1 minute
      expect(successful).toBeGreaterThan(totalOperations * 0.6); // 60% success rate
      expect(serverErrors).toBeLessThan(totalOperations * 0.1); // Less than 10% server errors
      expect(failed).toBeLessThan(totalOperations * 0.05); // Less than 5% complete failures
    });

    test('should maintain API performance under sustained mixed load', async () => {
      const sustainedDuration = 15000; // 15 seconds
      const operationsPerSecond = 8;
      const interval = 1000 / operationsPerSecond;
      
      const results = [];
      const startTime = Date.now();
      
      const performMixedOperation = async () => {
        const userIndex = Math.floor(Math.random() * mockUsers.length);
        const operationType = Math.random();
        
        try {
          let response;
          
          if (operationType < 0.3) {
            // File upload (30%)
            response = await request(app)
              .post('/api/upload')
              .set('Authorization', `Bearer ${mockUsers[userIndex].accessToken}`)
              .attach('file', Buffer.from(fullTestCsv.substring(0, 1000)), 'sustained-test.csv');
          } else if (operationType < 0.6) {
            // CSV processing (30%)
            response = await request(app)
              .post('/api/process-csv')
              .set('Authorization', `Bearer ${mockUsers[userIndex].accessToken}`)
              .send({ csvData: fullTestCsv.substring(0, 1000), filename: 'sustained-process.csv' });
          } else if (operationType < 0.8) {
            // Chat request (20%)
            response = await request(app)
              .post('/api/chat')
              .set('Authorization', `Bearer ${mockUsers[userIndex].accessToken}`)
              .send({ message: 'Sustained load test', csvData: fullTestCsv.substring(0, 500) });
          } else {
            // File list (20%)
            response = await request(app)
              .get('/api/files')
              .set('Authorization', `Bearer ${mockUsers[userIndex].accessToken}`);
          }
          
          results.push({
            timestamp: Date.now(),
            status: response.status,
            duration: Date.now() - startTime,
            type: operationType < 0.3 ? 'upload' : 
                  operationType < 0.6 ? 'process' :
                  operationType < 0.8 ? 'chat' : 'list'
          });
        } catch (error) {
          results.push({
            timestamp: Date.now(),
            status: 'error',
            error: error.message,
            duration: Date.now() - startTime
          });
        }
      };

      // Start sustained mixed load
      const intervalId = setInterval(performMixedOperation, interval);
      
      // Wait for sustained duration
      await new Promise(resolve => setTimeout(resolve, sustainedDuration));
      
      // Stop sustained load
      clearInterval(intervalId);
      
      // Wait for any pending operations
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const totalDuration = Date.now() - startTime;
      const successfulOperations = results.filter(r => r.status < 400).length;
      const averageResponseTime = results.reduce((sum, r) => sum + (r.duration || 0), 0) / results.length;
      
      // Analyze by operation type
      const operationTypes = ['upload', 'process', 'chat', 'list'];
      operationTypes.forEach(type => {
        const typeResults = results.filter(r => r.type === type);
        const typeSuccessful = typeResults.filter(r => r.status < 400).length;
        console.log(`${type}: ${typeSuccessful}/${typeResults.length} successful`);
      });
      
      console.log(`Sustained Mixed Load Test Results:`);
      console.log(`  Duration: ${totalDuration}ms`);
      console.log(`  Total Operations: ${results.length}`);
      console.log(`  Successful Operations: ${successfulOperations}`);
      console.log(`  Success Rate: ${((successfulOperations / results.length) * 100).toFixed(2)}%`);
      console.log(`  Average Response Time: ${averageResponseTime.toFixed(2)}ms`);
      console.log(`  Actual Throughput: ${((results.length / totalDuration) * 1000).toFixed(2)} ops/sec`);
      
      // Performance assertions
      expect(results.length).toBeGreaterThan(100); // Should have processed significant operations
      expect(successfulOperations / results.length).toBeGreaterThan(0.65); // 65% success rate
      expect(averageResponseTime).toBeLessThan(3000); // Average response time under 3 seconds
    });
  });
});
