#!/usr/bin/env node

// TaktMate Input Validation Testing Script
// Tests input validation, sanitization, and security features

const { InputValidationService } = require('../middleware/inputValidation');
const fs = require('fs');
const path = require('path');

class InputValidationTest {
    constructor() {
        this.inputValidator = new InputValidationService();
        this.testResults = [];
        this.startTime = Date.now();
        
        console.log('🧪 TaktMate Input Validation Testing Suite');
        console.log('');
    }
    
    /**
     * Record test result
     */
    recordResult(testName, status, message, details = {}) {
        const result = {
            test: testName,
            status: status,
            message: message,
            details: details,
            timestamp: new Date().toISOString()
        };
        
        this.testResults.push(result);
        
        const statusIcon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
        console.log(`${statusIcon} ${testName}: ${message}`);
        
        if (Object.keys(details).length > 0) {
            console.log(`   Details: ${JSON.stringify(details, null, 2)}`);
        }
    }
    
    /**
     * Test input sanitization
     */
    testInputSanitization() {
        console.log('\n🛡️ Testing Input Sanitization...');
        
        const testCases = [
            {
                name: 'Basic XSS Script Tag',
                input: '<script>alert("XSS")</script>Hello World',
                expected: 'Hello World'
            },
            {
                name: 'HTML Entities',
                input: '<h1>Title</h1><p>Paragraph</p>',
                expected: '&lt;h1&gt;Title&lt;/h1&gt;&lt;p&gt;Paragraph&lt;/p&gt;'
            },
            {
                name: 'JavaScript URL',
                input: 'javascript:alert("XSS")',
                expected: ''
            },
            {
                name: 'Event Handler',
                input: '<img src="x" onerror="alert(\'XSS\')">',
                expected: ''
            },
            {
                name: 'Null Bytes',
                input: 'Hello\x00World',
                expected: 'HelloWorld'
            },
            {
                name: 'Unicode Normalization',
                input: 'café', // Contains combining characters
                expected: 'café'
            },
            {
                name: 'Whitespace Trimming',
                input: '   Hello World   ',
                expected: 'Hello World'
            }
        ];
        
        testCases.forEach(testCase => {
            try {
                const sanitized = this.inputValidator.sanitizeInput(testCase.input);
                
                if (sanitized.includes('<script>') || sanitized.includes('javascript:') || sanitized.includes('onerror=')) {
                    this.recordResult(
                        `Sanitization: ${testCase.name}`,
                        'FAIL',
                        'Dangerous content not removed',
                        { input: testCase.input, sanitized: sanitized }
                    );
                } else {
                    this.recordResult(
                        `Sanitization: ${testCase.name}`,
                        'PASS',
                        'Input properly sanitized',
                        { input: testCase.input, sanitized: sanitized }
                    );
                }
            } catch (error) {
                this.recordResult(
                    `Sanitization: ${testCase.name}`,
                    'FAIL',
                    `Sanitization failed: ${error.message}`,
                    { input: testCase.input, error: error.message }
                );
            }
        });
    }
    
    /**
     * Test file upload validation
     */
    testFileUploadValidation() {
        console.log('\n📁 Testing File Upload Validation...');
        
        const testFiles = [
            {
                name: 'Valid CSV File',
                file: {
                    originalname: 'test.csv',
                    mimetype: 'text/csv',
                    size: 1024,
                    buffer: Buffer.from('name,age\nJohn,25\nJane,30')
                },
                shouldPass: true
            },
            {
                name: 'File Too Large',
                file: {
                    originalname: 'large.csv',
                    mimetype: 'text/csv',
                    size: 10 * 1024 * 1024, // 10MB
                    buffer: Buffer.alloc(10 * 1024 * 1024)
                },
                shouldPass: false
            },
            {
                name: 'Invalid MIME Type',
                file: {
                    originalname: 'test.exe',
                    mimetype: 'application/x-executable',
                    size: 1024,
                    buffer: Buffer.from('MZ...')
                },
                shouldPass: false
            },
            {
                name: 'Suspicious Filename',
                file: {
                    originalname: '../../../etc/passwd',
                    mimetype: 'text/csv',
                    size: 1024,
                    buffer: Buffer.from('name,age\nJohn,25')
                },
                shouldPass: false
            },
            {
                name: 'Long Filename',
                file: {
                    originalname: 'a'.repeat(300) + '.csv',
                    mimetype: 'text/csv',
                    size: 1024,
                    buffer: Buffer.from('name,age\nJohn,25')
                },
                shouldPass: false
            },
            {
                name: 'Windows Reserved Name',
                file: {
                    originalname: 'CON.csv',
                    mimetype: 'text/csv',
                    size: 1024,
                    buffer: Buffer.from('name,age\nJohn,25')
                },
                shouldPass: false
            }
        ];
        
        testFiles.forEach(testFile => {
            try {
                const validation = this.inputValidator.validateFileUpload(testFile.file);
                
                if (testFile.shouldPass && validation.isValid) {
                    this.recordResult(
                        `File Upload: ${testFile.name}`,
                        'PASS',
                        'Valid file correctly accepted',
                        { 
                            filename: testFile.file.originalname,
                            sanitizedFilename: validation.sanitizedFilename,
                            errors: validation.errors,
                            warnings: validation.warnings
                        }
                    );
                } else if (!testFile.shouldPass && !validation.isValid) {
                    this.recordResult(
                        `File Upload: ${testFile.name}`,
                        'PASS',
                        'Invalid file correctly rejected',
                        { 
                            filename: testFile.file.originalname,
                            errors: validation.errors,
                            warnings: validation.warnings
                        }
                    );
                } else {
                    this.recordResult(
                        `File Upload: ${testFile.name}`,
                        'FAIL',
                        `Validation result mismatch (expected ${testFile.shouldPass ? 'valid' : 'invalid'}, got ${validation.isValid ? 'valid' : 'invalid'})`,
                        { 
                            filename: testFile.file.originalname,
                            expected: testFile.shouldPass,
                            actual: validation.isValid,
                            errors: validation.errors,
                            warnings: validation.warnings
                        }
                    );
                }
            } catch (error) {
                this.recordResult(
                    `File Upload: ${testFile.name}`,
                    'FAIL',
                    `Validation failed: ${error.message}`,
                    { filename: testFile.file.originalname, error: error.message }
                );
            }
        });
    }
    
    /**
     * Test CSV content validation
     */
    testCsvContentValidation() {
        console.log('\n📊 Testing CSV Content Validation...');
        
        const testCsvs = [
            {
                name: 'Valid CSV',
                content: 'name,age,city\nJohn,25,New York\nJane,30,Los Angeles',
                filename: 'valid.csv',
                shouldPass: true
            },
            {
                name: 'Empty CSV',
                content: '',
                filename: 'empty.csv',
                shouldPass: false
            },
            {
                name: 'Header Only CSV',
                content: 'name,age,city',
                filename: 'header-only.csv',
                shouldPass: false
            },
            {
                name: 'CSV with Script Tags',
                content: 'name,description\nJohn,"<script>alert(\'XSS\')</script>"\nJane,"Normal description"',
                filename: 'malicious.csv',
                shouldPass: true // Should pass but with warnings
            },
            {
                name: 'CSV with Iframe',
                content: 'name,bio\nHacker,"<iframe src=\'javascript:alert(1)\'></iframe>"\nNormal,"Just a person"',
                filename: 'iframe.csv',
                shouldPass: true // Should pass but with warnings
            },
            {
                name: 'Very Large CSV',
                content: 'name,data\n' + Array(100000).fill('John,data').join('\n'),
                filename: 'large.csv',
                shouldPass: false // Exceeds size limit
            },
            {
                name: 'CSV with Null Bytes',
                content: 'name,age\nJohn\x00,25\nJane,30',
                filename: 'null-bytes.csv',
                shouldPass: true // Should pass after sanitization
            }
        ];
        
        testCsvs.forEach(testCsv => {
            try {
                const validation = this.inputValidator.validateCsvContent(testCsv.content, testCsv.filename);
                
                if (testCsv.shouldPass && validation.isValid) {
                    this.recordResult(
                        `CSV Content: ${testCsv.name}`,
                        'PASS',
                        'Valid CSV correctly accepted',
                        { 
                            originalSize: validation.originalSize,
                            sanitizedSize: validation.sanitizedSize,
                            warnings: validation.warnings,
                            hasSuspiciousContent: validation.hasSuspiciousContent
                        }
                    );
                } else if (!testCsv.shouldPass && !validation.isValid) {
                    this.recordResult(
                        `CSV Content: ${testCsv.name}`,
                        'PASS',
                        'Invalid CSV correctly rejected',
                        { 
                            errors: validation.errors,
                            warnings: validation.warnings
                        }
                    );
                } else {
                    this.recordResult(
                        `CSV Content: ${testCsv.name}`,
                        'FAIL',
                        `Validation result mismatch (expected ${testCsv.shouldPass ? 'valid' : 'invalid'}, got ${validation.isValid ? 'valid' : 'invalid'})`,
                        { 
                            expected: testCsv.shouldPass,
                            actual: validation.isValid,
                            errors: validation.errors,
                            warnings: validation.warnings
                        }
                    );
                }
            } catch (error) {
                this.recordResult(
                    `CSV Content: ${testCsv.name}`,
                    'FAIL',
                    `Validation failed: ${error.message}`,
                    { filename: testCsv.filename, error: error.message }
                );
            }
        });
    }
    
    /**
     * Test chat message validation
     */
    testChatMessageValidation() {
        console.log('\n💬 Testing Chat Message Validation...');
        
        const testMessages = [
            {
                name: 'Normal Message',
                message: 'What is the average age in the dataset?',
                shouldPass: true
            },
            {
                name: 'Empty Message',
                message: '',
                shouldPass: false
            },
            {
                name: 'Whitespace Only',
                message: '   \n\t   ',
                shouldPass: false
            },
            {
                name: 'Very Long Message',
                message: 'A'.repeat(15000),
                shouldPass: false
            },
            {
                name: 'Message with XSS',
                message: 'Show me data <script>alert("XSS")</script> please',
                shouldPass: true // Should pass after sanitization
            },
            {
                name: 'Message with HTML',
                message: 'Show me <b>bold</b> data and <i>italic</i> text',
                shouldPass: true
            },
            {
                name: 'Repeated Characters (Spam)',
                message: 'A'.repeat(100),
                shouldPass: true // Should pass but with warnings
            },
            {
                name: 'Multiple URLs',
                message: 'Check http://site1.com and http://site2.com and http://site3.com and http://site4.com and http://site5.com',
                shouldPass: true // Should pass but with warnings
            },
            {
                name: 'Excessive Caps',
                message: 'SHOW ME ALL THE DATA RIGHT NOW PLEASE',
                shouldPass: true // Should pass but with warnings
            },
            {
                name: 'Multiple Currency Symbols',
                message: 'Show me data with $$$€€€£££',
                shouldPass: true // Should pass but with warnings
            }
        ];
        
        testMessages.forEach(testMessage => {
            try {
                const validation = this.inputValidator.validateChatMessage(testMessage.message);
                
                if (testMessage.shouldPass && validation.isValid) {
                    this.recordResult(
                        `Chat Message: ${testMessage.name}`,
                        'PASS',
                        'Valid message correctly accepted',
                        { 
                            originalLength: validation.originalLength,
                            sanitizedLength: validation.sanitizedLength,
                            warnings: validation.warnings
                        }
                    );
                } else if (!testMessage.shouldPass && !validation.isValid) {
                    this.recordResult(
                        `Chat Message: ${testMessage.name}`,
                        'PASS',
                        'Invalid message correctly rejected',
                        { 
                            errors: validation.errors,
                            warnings: validation.warnings
                        }
                    );
                } else {
                    this.recordResult(
                        `Chat Message: ${testMessage.name}`,
                        'FAIL',
                        `Validation result mismatch (expected ${testMessage.shouldPass ? 'valid' : 'invalid'}, got ${validation.isValid ? 'valid' : 'invalid'})`,
                        { 
                            expected: testMessage.shouldPass,
                            actual: validation.isValid,
                            errors: validation.errors,
                            warnings: validation.warnings,
                            sanitizedMessage: validation.sanitizedMessage
                        }
                    );
                }
            } catch (error) {
                this.recordResult(
                    `Chat Message: ${testMessage.name}`,
                    'FAIL',
                    `Validation failed: ${error.message}`,
                    { message: testMessage.message, error: error.message }
                );
            }
        });
    }
    
    /**
     * Test filename sanitization
     */
    testFilenameSanitization() {
        console.log('\n📝 Testing Filename Sanitization...');
        
        const testFilenames = [
            {
                name: 'Normal Filename',
                filename: 'data.csv',
                expected: 'data.csv'
            },
            {
                name: 'Filename with Spaces',
                filename: 'my data file.csv',
                expected: 'my data file.csv'
            },
            {
                name: 'Directory Traversal',
                filename: '../../../etc/passwd',
                expected: 'etcpasswd.csv'
            },
            {
                name: 'Windows Invalid Characters',
                filename: 'file<>:"|?*.csv',
                expected: 'file.csv'
            },
            {
                name: 'Windows Reserved Name',
                filename: 'CON.csv',
                expected: 'CON.csv' // May be allowed but flagged
            },
            {
                name: 'Very Long Filename',
                filename: 'a'.repeat(300) + '.csv',
                expected: 'a'.repeat(251) + '.csv' // Truncated to 255 chars
            },
            {
                name: 'No Extension',
                filename: 'datafile',
                expected: 'datafile.csv'
            },
            {
                name: 'Empty Filename',
                filename: '',
                expected: 'untitled.csv'
            }
        ];
        
        testFilenames.forEach(testFilename => {
            try {
                const sanitized = this.inputValidator.sanitizeFilename(testFilename.filename);
                
                // Check if sanitized filename is safe
                const isSafe = !sanitized.includes('..') && 
                              !sanitized.includes('<') && 
                              !sanitized.includes('>') && 
                              !sanitized.includes(':') && 
                              !sanitized.includes('"') && 
                              !sanitized.includes('|') && 
                              !sanitized.includes('?') && 
                              !sanitized.includes('*') &&
                              sanitized.length <= 255 &&
                              sanitized.includes('.');
                
                if (isSafe) {
                    this.recordResult(
                        `Filename Sanitization: ${testFilename.name}`,
                        'PASS',
                        'Filename properly sanitized',
                        { 
                            original: testFilename.filename,
                            sanitized: sanitized
                        }
                    );
                } else {
                    this.recordResult(
                        `Filename Sanitization: ${testFilename.name}`,
                        'FAIL',
                        'Sanitized filename still contains unsafe elements',
                        { 
                            original: testFilename.filename,
                            sanitized: sanitized
                        }
                    );
                }
            } catch (error) {
                this.recordResult(
                    `Filename Sanitization: ${testFilename.name}`,
                    'FAIL',
                    `Sanitization failed: ${error.message}`,
                    { filename: testFilename.filename, error: error.message }
                );
            }
        });
    }
    
    /**
     * Test performance impact
     */
    testPerformanceImpact() {
        console.log('\n⚡ Testing Performance Impact...');
        
        const testData = [
            {
                name: 'Small Input',
                data: 'Hello World',
                iterations: 1000
            },
            {
                name: 'Medium Input',
                data: 'A'.repeat(1000),
                iterations: 100
            },
            {
                name: 'Large Input',
                data: 'A'.repeat(10000),
                iterations: 10
            }
        ];
        
        testData.forEach(test => {
            const startTime = Date.now();
            
            try {
                for (let i = 0; i < test.iterations; i++) {
                    this.inputValidator.sanitizeInput(test.data);
                }
                
                const endTime = Date.now();
                const totalTime = endTime - startTime;
                const avgTime = totalTime / test.iterations;
                
                if (avgTime < 10) { // Less than 10ms per operation
                    this.recordResult(
                        `Performance: ${test.name}`,
                        'PASS',
                        `Average time: ${avgTime.toFixed(2)}ms per operation`,
                        { 
                            totalTime: totalTime,
                            iterations: test.iterations,
                            avgTime: avgTime,
                            dataSize: test.data.length
                        }
                    );
                } else {
                    this.recordResult(
                        `Performance: ${test.name}`,
                        'WARN',
                        `Performance may be slow: ${avgTime.toFixed(2)}ms per operation`,
                        { 
                            totalTime: totalTime,
                            iterations: test.iterations,
                            avgTime: avgTime,
                            dataSize: test.data.length
                        }
                    );
                }
            } catch (error) {
                this.recordResult(
                    `Performance: ${test.name}`,
                    'FAIL',
                    `Performance test failed: ${error.message}`,
                    { error: error.message }
                );
            }
        });
    }
    
    /**
     * Generate test report
     */
    generateReport() {
        const endTime = Date.now();
        const duration = endTime - this.startTime;
        
        const summary = {
            totalTests: this.testResults.length,
            passed: this.testResults.filter(r => r.status === 'PASS').length,
            failed: this.testResults.filter(r => r.status === 'FAIL').length,
            warnings: this.testResults.filter(r => r.status === 'WARN').length,
            duration: Math.round(duration),
            timestamp: new Date().toISOString()
        };
        
        const report = {
            summary,
            testResults: this.testResults,
            environment: {
                nodeVersion: process.version,
                platform: process.platform
            }
        };
        
        console.log('\n📊 Input Validation Test Summary');
        console.log('==================================');
        console.log(`Total Tests: ${summary.totalTests}`);
        console.log(`✅ Passed: ${summary.passed}`);
        console.log(`❌ Failed: ${summary.failed}`);
        console.log(`⚠️  Warnings: ${summary.warnings}`);
        console.log(`⏱️  Duration: ${summary.duration}ms`);
        
        if (summary.failed > 0) {
            console.log('\n❌ Failed Tests:');
            this.testResults
                .filter(r => r.status === 'FAIL')
                .forEach(test => {
                    console.log(`   - ${test.test}: ${test.message}`);
                });
        }
        
        if (summary.warnings > 0) {
            console.log('\n⚠️  Warnings:');
            this.testResults
                .filter(r => r.status === 'WARN')
                .forEach(test => {
                    console.log(`   - ${test.test}: ${test.message}`);
                });
        }
        
        const successRate = summary.totalTests > 0 ? 
            ((summary.passed / summary.totalTests) * 100).toFixed(1) : 0;
        
        console.log(`\n🎯 Success Rate: ${successRate}%`);
        
        // Save report to file
        const reportDir = path.join(__dirname, '..', 'reports');
        
        if (!fs.existsSync(reportDir)) {
            fs.mkdirSync(reportDir, { recursive: true });
        }
        
        const reportFile = path.join(reportDir, `input-validation-test-${Date.now()}.json`);
        fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
        
        console.log(`\n📄 Detailed report saved to: ${reportFile}`);
        
        return report;
    }
    
    /**
     * Run all input validation tests
     */
    async runAllTests() {
        try {
            this.testInputSanitization();
            this.testFileUploadValidation();
            this.testCsvContentValidation();
            this.testChatMessageValidation();
            this.testFilenameSanitization();
            this.testPerformanceImpact();
            
            const report = this.generateReport();
            
            // Exit with appropriate code
            const hasFailures = report.summary.failed > 0;
            process.exit(hasFailures ? 1 : 0);
        } catch (error) {
            console.error('\n❌ Test suite failed:', error.message);
            process.exit(1);
        }
    }
}

// Run tests if called directly
if (require.main === module) {
    const tester = new InputValidationTest();
    tester.runAllTests().catch(error => {
        console.error('❌ Test execution failed:', error);
        process.exit(1);
    });
}

module.exports = InputValidationTest;
