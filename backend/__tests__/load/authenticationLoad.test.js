// Authentication Load Testing
// Tests authentication performance under concurrent user load

const request = require('supertest');
const app = require('../../index');

// Mock Azure AD B2C for load testing
jest.mock('@azure/msal-node');
jest.mock('../../services/entraExternalIdApiService');

describe('Authentication Load Testing', () => {
  const mockUsers = Array.from({ length: 100 }, (_, i) => ({
    id: `load-user-${i + 1}`,
    email: `loadtest${i + 1}@example.com`,
    name: `Load Test User ${i + 1}`,
    accessToken: `mock-token-${i + 1}`
  }));

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Concurrent Login Load Testing', () => {
    test('should handle 50 concurrent login requests', async () => {
      const concurrentLogins = 50;
      const startTime = Date.now();
      
      const loginPromises = Array.from({ length: concurrentLogins }, (_, i) =>
        request(app)
          .post('/api/auth/login')
          .send({
            email: mockUsers[i].email,
            password: 'test-password'
          })
          .expect(res => {
            expect([200, 401, 429]).toContain(res.status); // Accept success, auth failure, or rate limit
          })
      );

      const results = await Promise.allSettled(loginPromises);
      const duration = Date.now() - startTime;
      
      const successful = results.filter(r => r.status === 'fulfilled' && r.value.status === 200).length;
      const rateLimited = results.filter(r => r.status === 'fulfilled' && r.value.status === 429).length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      console.log(`Login Load Test Results:`);
      console.log(`  Duration: ${duration}ms`);
      console.log(`  Successful: ${successful}/${concurrentLogins}`);
      console.log(`  Rate Limited: ${rateLimited}/${concurrentLogins}`);
      console.log(`  Failed: ${failed}/${concurrentLogins}`);
      console.log(`  Average Response Time: ${duration / concurrentLogins}ms`);
      
      // Performance assertions
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
      expect(successful + rateLimited).toBeGreaterThan(concurrentLogins * 0.8); // 80% should not fail
      expect(failed).toBeLessThan(concurrentLogins * 0.1); // Less than 10% should fail completely
    });

    test('should handle 100 concurrent token validation requests', async () => {
      const concurrentValidations = 100;
      const startTime = Date.now();
      
      const validationPromises = Array.from({ length: concurrentValidations }, (_, i) =>
        request(app)
          .get('/api/auth/validate')
          .set('Authorization', `Bearer ${mockUsers[i % mockUsers.length].accessToken}`)
          .expect(res => {
            expect([200, 401, 429, 503]).toContain(res.status);
          })
      );

      const results = await Promise.allSettled(validationPromises);
      const duration = Date.now() - startTime;
      
      const successful = results.filter(r => r.status === 'fulfilled' && r.value.status === 200).length;
      const unauthorized = results.filter(r => r.status === 'fulfilled' && r.value.status === 401).length;
      const rateLimited = results.filter(r => r.status === 'fulfilled' && r.value.status === 429).length;
      const serviceUnavailable = results.filter(r => r.status === 'fulfilled' && r.value.status === 503).length;
      
      console.log(`Token Validation Load Test Results:`);
      console.log(`  Duration: ${duration}ms`);
      console.log(`  Successful: ${successful}/${concurrentValidations}`);
      console.log(`  Unauthorized: ${unauthorized}/${concurrentValidations}`);
      console.log(`  Rate Limited: ${rateLimited}/${concurrentValidations}`);
      console.log(`  Service Unavailable: ${serviceUnavailable}/${concurrentValidations}`);
      
      // Performance assertions
      expect(duration).toBeLessThan(15000); // Should complete within 15 seconds
      expect(successful + unauthorized).toBeGreaterThan(concurrentValidations * 0.7); // 70% should get proper response
      expect(serviceUnavailable).toBeLessThan(concurrentValidations * 0.1); // Less than 10% service unavailable
    });

    test('should handle token refresh under load', async () => {
      const concurrentRefreshes = 75;
      const startTime = Date.now();
      
      const refreshPromises = Array.from({ length: concurrentRefreshes }, (_, i) =>
        request(app)
          .post('/api/auth/refresh')
          .send({
            refreshToken: `mock-refresh-token-${i + 1}`
          })
          .expect(res => {
            expect([200, 401, 429, 503]).toContain(res.status);
          })
      );

      const results = await Promise.allSettled(refreshPromises);
      const duration = Date.now() - startTime;
      
      const successful = results.filter(r => r.status === 'fulfilled' && r.value.status === 200).length;
      const rateLimited = results.filter(r => r.status === 'fulfilled' && r.value.status === 429).length;
      
      console.log(`Token Refresh Load Test Results:`);
      console.log(`  Duration: ${duration}ms`);
      console.log(`  Successful: ${successful}/${concurrentRefreshes}`);
      console.log(`  Rate Limited: ${rateLimited}/${concurrentRefreshes}`);
      console.log(`  Average Response Time: ${duration / concurrentRefreshes}ms`);
      
      // Performance assertions
      expect(duration).toBeLessThan(12000); // Should complete within 12 seconds
      expect(successful + rateLimited).toBeGreaterThan(concurrentRefreshes * 0.8); // 80% should not fail
    });
  });

  describe('Session Management Load Testing', () => {
    test('should handle concurrent session creation', async () => {
      const concurrentSessions = 60;
      const startTime = Date.now();
      
      const sessionPromises = Array.from({ length: concurrentSessions }, (_, i) =>
        request(app)
          .post('/api/auth/session')
          .set('Authorization', `Bearer ${mockUsers[i % mockUsers.length].accessToken}`)
          .send({
            userId: mockUsers[i % mockUsers.length].id,
            sessionData: { lastActivity: new Date().toISOString() }
          })
          .expect(res => {
            expect([200, 201, 429, 503]).toContain(res.status);
          })
      );

      const results = await Promise.allSettled(sessionPromises);
      const duration = Date.now() - startTime;
      
      const successful = results.filter(r => 
        r.status === 'fulfilled' && [200, 201].includes(r.value.status)
      ).length;
      
      console.log(`Session Creation Load Test Results:`);
      console.log(`  Duration: ${duration}ms`);
      console.log(`  Successful: ${successful}/${concurrentSessions}`);
      console.log(`  Success Rate: ${((successful / concurrentSessions) * 100).toFixed(2)}%`);
      
      // Performance assertions
      expect(duration).toBeLessThan(8000); // Should complete within 8 seconds
      expect(successful).toBeGreaterThan(concurrentSessions * 0.7); // 70% success rate
    });

    test('should handle concurrent session cleanup', async () => {
      const concurrentCleanups = 40;
      const startTime = Date.now();
      
      const cleanupPromises = Array.from({ length: concurrentCleanups }, (_, i) =>
        request(app)
          .delete(`/api/auth/session/${mockUsers[i % mockUsers.length].id}`)
          .set('Authorization', `Bearer ${mockUsers[i % mockUsers.length].accessToken}`)
          .expect(res => {
            expect([200, 204, 404, 429]).toContain(res.status);
          })
      );

      const results = await Promise.allSettled(cleanupPromises);
      const duration = Date.now() - startTime;
      
      const successful = results.filter(r => 
        r.status === 'fulfilled' && [200, 204, 404].includes(r.value.status)
      ).length;
      
      console.log(`Session Cleanup Load Test Results:`);
      console.log(`  Duration: ${duration}ms`);
      console.log(`  Successful: ${successful}/${concurrentCleanups}`);
      
      // Performance assertions
      expect(duration).toBeLessThan(6000); // Should complete within 6 seconds
      expect(successful).toBeGreaterThan(concurrentCleanups * 0.8); // 80% success rate
    });
  });

  describe('Authentication Flow Stress Testing', () => {
    test('should handle mixed authentication operations under stress', async () => {
      const totalOperations = 150;
      const startTime = Date.now();
      
      // Mix of different authentication operations
      const operations = [
        // Login operations (30%)
        ...Array.from({ length: Math.floor(totalOperations * 0.3) }, (_, i) =>
          () => request(app)
            .post('/api/auth/login')
            .send({
              email: mockUsers[i % mockUsers.length].email,
              password: 'test-password'
            })
        ),
        // Token validation operations (40%)
        ...Array.from({ length: Math.floor(totalOperations * 0.4) }, (_, i) =>
          () => request(app)
            .get('/api/auth/validate')
            .set('Authorization', `Bearer ${mockUsers[i % mockUsers.length].accessToken}`)
        ),
        // Token refresh operations (20%)
        ...Array.from({ length: Math.floor(totalOperations * 0.2) }, (_, i) =>
          () => request(app)
            .post('/api/auth/refresh')
            .send({ refreshToken: `mock-refresh-token-${i + 1}` })
        ),
        // Logout operations (10%)
        ...Array.from({ length: Math.floor(totalOperations * 0.1) }, (_, i) =>
          () => request(app)
            .post('/api/auth/logout')
            .set('Authorization', `Bearer ${mockUsers[i % mockUsers.length].accessToken}`)
        )
      ];

      // Shuffle operations to simulate realistic mixed load
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
      
      console.log(`Mixed Authentication Operations Stress Test Results:`);
      console.log(`  Total Operations: ${totalOperations}`);
      console.log(`  Duration: ${duration}ms`);
      console.log(`  Successful (2xx-3xx): ${successful}`);
      console.log(`  Client Errors (4xx): ${clientErrors}`);
      console.log(`  Server Errors (5xx): ${serverErrors}`);
      console.log(`  Failed: ${failed}`);
      console.log(`  Operations per second: ${((totalOperations / duration) * 1000).toFixed(2)}`);
      console.log(`  Average response time: ${(duration / totalOperations).toFixed(2)}ms`);
      
      // Performance assertions
      expect(duration).toBeLessThan(20000); // Should complete within 20 seconds
      expect(successful).toBeGreaterThan(totalOperations * 0.6); // 60% success rate
      expect(serverErrors).toBeLessThan(totalOperations * 0.1); // Less than 10% server errors
      expect(failed).toBeLessThan(totalOperations * 0.05); // Less than 5% complete failures
    });

    test('should maintain performance under sustained load', async () => {
      const sustainedDuration = 10000; // 10 seconds
      const operationsPerSecond = 10;
      const interval = 1000 / operationsPerSecond;
      
      const results = [];
      const startTime = Date.now();
      
      const performOperation = async () => {
        const userIndex = Math.floor(Math.random() * mockUsers.length);
        const operationType = Math.random();
        
        try {
          let response;
          if (operationType < 0.5) {
            // Token validation (50% of operations)
            response = await request(app)
              .get('/api/auth/validate')
              .set('Authorization', `Bearer ${mockUsers[userIndex].accessToken}`);
          } else {
            // Login (50% of operations)
            response = await request(app)
              .post('/api/auth/login')
              .send({
                email: mockUsers[userIndex].email,
                password: 'test-password'
              });
          }
          
          results.push({
            timestamp: Date.now(),
            status: response.status,
            duration: Date.now() - startTime
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

      // Start sustained load
      const intervalId = setInterval(performOperation, interval);
      
      // Wait for sustained duration
      await new Promise(resolve => setTimeout(resolve, sustainedDuration));
      
      // Stop sustained load
      clearInterval(intervalId);
      
      // Wait for any pending operations
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const totalDuration = Date.now() - startTime;
      const successfulOperations = results.filter(r => r.status < 400).length;
      const averageResponseTime = results.reduce((sum, r) => sum + (r.duration || 0), 0) / results.length;
      
      console.log(`Sustained Load Test Results:`);
      console.log(`  Duration: ${totalDuration}ms`);
      console.log(`  Total Operations: ${results.length}`);
      console.log(`  Successful Operations: ${successfulOperations}`);
      console.log(`  Success Rate: ${((successfulOperations / results.length) * 100).toFixed(2)}%`);
      console.log(`  Average Response Time: ${averageResponseTime.toFixed(2)}ms`);
      console.log(`  Actual Operations per Second: ${((results.length / totalDuration) * 1000).toFixed(2)}`);
      
      // Performance assertions
      expect(results.length).toBeGreaterThan(80); // Should have processed significant operations
      expect(successfulOperations / results.length).toBeGreaterThan(0.7); // 70% success rate
      expect(averageResponseTime).toBeLessThan(2000); // Average response time under 2 seconds
    });
  });

  describe('Resource Utilization Under Load', () => {
    test('should monitor memory usage during load testing', async () => {
      const initialMemory = process.memoryUsage();
      const concurrentOperations = 100;
      
      console.log(`Initial Memory Usage:`);
      console.log(`  RSS: ${(initialMemory.rss / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  Heap Used: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  Heap Total: ${(initialMemory.heapTotal / 1024 / 1024).toFixed(2)} MB`);
      
      const operationPromises = Array.from({ length: concurrentOperations }, (_, i) =>
        request(app)
          .get('/api/auth/validate')
          .set('Authorization', `Bearer ${mockUsers[i % mockUsers.length].accessToken}`)
      );

      await Promise.allSettled(operationPromises);
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = {
        rss: finalMemory.rss - initialMemory.rss,
        heapUsed: finalMemory.heapUsed - initialMemory.heapUsed,
        heapTotal: finalMemory.heapTotal - initialMemory.heapTotal
      };
      
      console.log(`Final Memory Usage:`);
      console.log(`  RSS: ${(finalMemory.rss / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  Heap Used: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  Heap Total: ${(finalMemory.heapTotal / 1024 / 1024).toFixed(2)} MB`);
      
      console.log(`Memory Increase:`);
      console.log(`  RSS: ${(memoryIncrease.rss / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  Heap Used: ${(memoryIncrease.heapUsed / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  Heap Total: ${(memoryIncrease.heapTotal / 1024 / 1024).toFixed(2)} MB`);
      
      // Memory assertions
      expect(memoryIncrease.rss).toBeLessThan(100 * 1024 * 1024); // Less than 100MB RSS increase
      expect(memoryIncrease.heapUsed).toBeLessThan(50 * 1024 * 1024); // Less than 50MB heap increase
    });

    test('should handle concurrent requests without blocking event loop', async () => {
      const concurrentOperations = 50;
      const eventLoopDelays = [];
      
      // Monitor event loop delay
      const monitorInterval = setInterval(() => {
        const start = process.hrtime.bigint();
        setImmediate(() => {
          const delay = Number(process.hrtime.bigint() - start) / 1000000; // Convert to milliseconds
          eventLoopDelays.push(delay);
        });
      }, 100);

      const operationPromises = Array.from({ length: concurrentOperations }, (_, i) =>
        request(app)
          .post('/api/auth/login')
          .send({
            email: mockUsers[i % mockUsers.length].email,
            password: 'test-password'
          })
      );

      await Promise.allSettled(operationPromises);
      
      // Stop monitoring
      clearInterval(monitorInterval);
      
      // Wait for final measurements
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const averageDelay = eventLoopDelays.reduce((sum, delay) => sum + delay, 0) / eventLoopDelays.length;
      const maxDelay = Math.max(...eventLoopDelays);
      
      console.log(`Event Loop Performance:`);
      console.log(`  Measurements: ${eventLoopDelays.length}`);
      console.log(`  Average Delay: ${averageDelay.toFixed(2)}ms`);
      console.log(`  Max Delay: ${maxDelay.toFixed(2)}ms`);
      
      // Event loop assertions
      expect(averageDelay).toBeLessThan(50); // Average delay should be less than 50ms
      expect(maxDelay).toBeLessThan(200); // Max delay should be less than 200ms
      expect(eventLoopDelays.length).toBeGreaterThan(10); // Should have multiple measurements
    });
  });
});
