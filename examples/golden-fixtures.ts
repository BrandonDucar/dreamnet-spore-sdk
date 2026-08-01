import { canonicalJsonStringify, computeCanonicalHash } from '../src/contracts/index.js';
import crypto from 'crypto';

console.log('🧪 [DreamNet Spore SDK] Golden JSON Byte Fixture Verification...\n');

const hashVector1 = crypto.createHash('sha256').update('{"a":1,"b":2}', 'utf8').digest('hex');

const testCases = [
  {
    name: 'Simple Key Sorting',
    input: { b: 2, a: 1 },
    expectedCanonicalJson: '{"a":1,"b":2}',
    expectedHash: hashVector1
  },
  {
    name: 'Nested Key Sorting & Array Handling',
    input: { z: [3, 2, 1], a: { y: 'test', x: true } },
    expectedCanonicalJson: '{"a":{"x":true,"y":"test"},"z":[3,2,1]}'
  },
];

let passed = 0;
testCases.forEach((tc, idx) => {
  const resultJson = canonicalJsonStringify(tc.input);
  const resultHash = computeCanonicalHash(tc.input);

  const jsonMatches = resultJson === tc.expectedCanonicalJson;
  const hashMatches = !tc.expectedHash || resultHash === tc.expectedHash;

  if (jsonMatches && hashMatches) {
    console.log(`✅ [Fixture ${idx + 1}: ${tc.name}] PASSED -> "${resultJson}" (Hash: ${resultHash.substring(0, 12)}...)`);
    passed++;
  } else {
    console.error(`❌ [Fixture ${idx + 1}: ${tc.name}] FAILED: Expected "${tc.expectedCanonicalJson}", Got "${resultJson}"`);
  }
});

console.log(`\n🎉 [Golden Fixtures] ${passed} / ${testCases.length} Test Vectors Passed!`);

try {
  canonicalJsonStringify({ active: true, missing: undefined });
  console.error('❌ [Non-I-JSON Fixture] FAILED: undefined was not rejected.');
  process.exitCode = 1;
} catch {
  console.log('✅ [Non-I-JSON Fixture] PASSED: undefined was rejected.');
}

if (passed !== testCases.length) process.exitCode = 1;
