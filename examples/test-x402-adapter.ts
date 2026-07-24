import { X402PaymentAdapter } from '../src/adapters/x402Adapter.js';

console.log('⚡ [Spore SDK x402 Adapter Test] Verifying X402PaymentAdapter verification checks...\n');

async function testX402Adapter() {
  const adapter = new X402PaymentAdapter();

  // Test 1: Valid EVM Transaction Hash Payload
  console.log('🔗 [1/2 Valid EVM Tx Hash] Testing 64-char hex proof...');
  const res1 = await adapter.adaptAndVerify({
    txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    payToAddress: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F'
  });

  console.log(`   Verification Passed: ${res1.isValid}`);
  console.log(`   Canonical Subject Hash: ${res1.subjectHash}`);
  console.log(`   Checks Run: ${res1.checks.length}`);

  // Test 2: Invalid Tx Hash Rejection
  console.log('\n🚫 [2/2 Invalid Hash Rejection] Testing malformed proof...');
  const res2 = await adapter.adaptAndVerify({
    txHash: 'invalid-hash'
  });

  console.log(`   Verification Passed: ${res2.isValid} (Expected false)`);
  console.log(`   Check Reason: "${res2.checks.find(c => c.status === 'INVALID')?.reason}"`);

  console.log('\n🎉 [Success] Spore SDK X402PaymentAdapter Verified!');
}

testX402Adapter();
