#!/usr/bin/env node

// GDPR Compliance Test Runner
const { execSync } = require('child_process');

console.log('🛡️  GDPR Compliance Test Runner');
console.log('===============================');

const tests = [
  'npm test -- --testPathPattern=gdpr/dataPortability.test.js',
  'npm test -- --testPathPattern=gdpr/rightToErasure.test.js', 
  'npm test -- --testPathPattern=gdpr/consentManagement.test.js',
  'npm test -- --testPathPattern=gdpr/auditCompliance.test.js'
];

let passed = 0;
let failed = 0;

tests.forEach((test, index) => {
  console.log(`\n🔄 Running test ${index + 1}/4...`);
  try {
    execSync(test, { stdio: 'inherit' });
    passed++;
    console.log(`✅ Test ${index + 1} passed`);
  } catch (error) {
    failed++;
    console.log(`❌ Test ${index + 1} failed`);
  }
});

console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  console.log('🚨 GDPR compliance issues detected!');
  process.exit(1);
} else {
  console.log('✅ All GDPR compliance tests passed!');
  process.exit(0);
}
