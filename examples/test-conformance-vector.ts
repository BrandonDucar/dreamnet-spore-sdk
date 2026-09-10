import { canonicalJsonStringify, computeCanonicalHash } from '../src/contracts/index.js';

const testPayload = {
  z: 100,
  a: 'dreamnet-spore',
  m: { b: true, a: null }
};

const canonicalStr = canonicalJsonStringify(testPayload);
const hash = computeCanonicalHash(testPayload);

console.log('=== REAL SPORE SDK CONFORMANCE VECTOR ===');
console.log('Test Payload:', JSON.stringify(testPayload));
console.log('Canonical Serialized String:', canonicalStr);
console.log('Computed SHA-256 Hash:', hash);
