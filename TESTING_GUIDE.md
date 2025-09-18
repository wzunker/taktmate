# TaktMate Testing Guide

## Blob Storage Test Suite

### Quick Start
```bash
# Navigate to test directory
cd tests/blob-storage

# Install test dependencies (first time only)
npm install

# Run all tests
npm test

# Run specific test suites
npm run test:unit        # Unit tests only
npm run test:integration # Integration tests only
npm run test:security    # Security tests only

# Run with coverage
npm run coverage

# Clean up test data
npm run cleanup
```

### Test Structure
```
tests/blob-storage/
├── unit/                  # Unit tests for individual functions
├── integration/           # End-to-end workflow tests
├── fixtures/              # Test data and configuration
├── scripts/               # Utility scripts
└── package.json           # Test dependencies and scripts
```

### Test Categories

#### Unit Tests (`unit/`)
- **storage.test.js**: Storage service functions
- **routes.test.js**: API endpoint validation
- **validation.test.js**: File validation and security

#### Integration Tests (`integration/`)
- **upload-flow.test.js**: Complete upload workflow
- **download-flow.test.js**: Complete download workflow  
- **user-isolation.test.js**: Security and cross-user access prevention

#### Security Tests
- File name validation (path traversal, reserved names)
- Authentication bypass attempts
- Cross-user access prevention
- Rate limiting enforcement
- SAS token security

### Managing Test Files

#### Temporary Test Files
- Tests create temporary containers prefixed with 'test-'
- Automatic cleanup after each test run
- Manual cleanup: `npm run cleanup`

#### Removing Test Suite Entirely
```bash
# Remove all test files and dependencies
rm -rf tests/blob-storage/

# Or just the dependencies
cd tests/blob-storage && rm -rf node_modules/ package-lock.json
```

### Environment Setup

#### Test Environment Variables
```bash
# Optional: Use separate test storage account
export STORAGE_ACCOUNT_NAME="taktmatetestblob"
export NODE_ENV="test"
```

#### Safety Measures
- Tests use separate containers (prefixed with 'test-')
- Automatic cleanup prevents data accumulation
- No impact on production data
- Can run against test storage account

### Test Development

#### Adding New Tests
1. Create test file in appropriate directory (`unit/` or `integration/`)
2. Follow existing naming convention: `*.test.js`
3. Use global test helpers from `fixtures/test-setup.js`
4. Add cleanup tracking for any test data created

#### Test Helpers Available
```javascript
// Global test configuration
global.testConfig
global.testUsers
global.mockAuthHeaders
global.testCleanup

// Example usage
global.testCleanup.addContainer('test-container-name');
global.testCleanup.addFile('user-id', 'file-name');
```

### Integration with CI/CD

#### GitHub Actions Example
```yaml
- name: Run Blob Storage Tests
  run: |
    cd tests/blob-storage
    npm install
    npm test
    npm run cleanup
  env:
    STORAGE_ACCOUNT_NAME: ${{ secrets.TEST_STORAGE_ACCOUNT }}
```

#### Local Development
```bash
# Watch mode for development
npm run test:watch

# Run specific test file
npx jest unit/storage.test.js

# Debug mode
npx jest --detectOpenHandles --forceExit
```

### Troubleshooting

#### Common Issues
1. **Azure credentials**: Ensure `az login` or managed identity is configured
2. **Storage account**: Verify `STORAGE_ACCOUNT_NAME` environment variable
3. **Permissions**: Ensure test identity has Storage Blob Data Contributor role
4. **Network**: Tests require internet access to Azure Storage

#### Cleanup Issues
```bash
# Manual cleanup if automated cleanup fails
node scripts/cleanup-test-data.js

# Or use Azure CLI
az storage container list --account-name taktmateblob
az storage container delete --name test-container-name --account-name taktmateblob
```

### Test Coverage Goals
- **Storage Service**: 95%+ coverage
- **API Routes**: 90%+ coverage
- **Security Functions**: 100% coverage
- **Error Handling**: 85%+ coverage

### Best Practices
- Always clean up test data
- Use descriptive test names
- Test both success and failure scenarios
- Mock external dependencies where appropriate
- Keep tests independent and isolated
