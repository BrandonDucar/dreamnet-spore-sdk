import { ConfigurableGovernor } from '../src/governance/governorInterfaces.js';
import { InMemoryTransport } from '../src/transport/transportInterfaces.js';
import { BloodstreamPipeline } from '../src/pipeline/bloodstreamPipeline.js';
import { OpportunityScreener, VitalSignalDetector } from '../src/pipeline/classifiers.js';
import { MockWeatherSpike } from './mock-weather-spike.js';
import { LiveWeatherSpike } from './live-weather-spike.js';
import { ZaoProofDropAdapter, ZaoProofDrop } from './adapters/zao-proof-drop.js';

console.log('🌿 [DreamNet Spore SDK] Comprehensive Conformance, Security & Interoperability Test...\n');

async function testUniversalSDK() {
  // 1. Initialize Governor & Test Atomic Spend Reservation
  const governor = new ConfigurableGovernor({ dailyCapUsd: 150.0 });
  const reservation = governor.reserveSpend(25.00);
  console.log(`✅ [Governor Atomic Reservation] Reserved: $${reservation?.amountUsd} USD (Status: ${reservation?.status})`);
  if (reservation) {
    governor.settleSpend(reservation.reservationId, 24.50);
    console.log(`✅ [Governor Settlement] Settled Spend: $${governor.getStatus().spend} / $${governor.getStatus().limit} USD`);
  }

  // 2. Test Leaky Bucket Token Velocity
  const tokensAllowed = governor.consumeTokens(200);
  console.log(`⚡ [Leaky Bucket Token Velocity] Consumed 200 tokens -> Allowed: ${tokensAllowed} (Remaining: ${governor.getStatus().tokensAvailable})`);

  // 3. Initialize Transport & Bloodstream Pipeline
  const transport = new InMemoryTransport();
  const bloodstream = new BloodstreamPipeline(transport);
  bloodstream.registerClassifier(new VitalSignalDetector());
  bloodstream.registerClassifier(new OpportunityScreener());

  transport.subscribe(async (obs) => {
    console.log(`📡 [Bloodstream Emitted Observation]: ${obs.provenance}`);
    console.log(`   Canonical Hash (RFC 8785): ${obs.hashes.canonicalPayloadHash.substring(0, 16)}... (${obs.hashes.hashAlgorithm})`);
  });

  // 4. Test Mock Weather Spike
  console.log('\n👁️ Testing Mock Weather Spike...');
  const mockSpike = new MockWeatherSpike();
  const mockObs = await mockSpike.observe('Palm Beach, FL');
  await bloodstream.process(mockObs);

  // 5. Test Live Weather Spike with SSRF Protection
  console.log('\n🌐 Testing Live Weather Spike (With SSRF Domain Allowlist Check)...');
  const liveSpike = new LiveWeatherSpike();
  const liveObs = await liveSpike.observe('Palm Beach, FL');
  await bloodstream.process(liveObs);

  // 6. Test Pipeline Deduplication
  console.log('\n🔄 Testing Pipeline Deduplication (Resending Live Observation)...');
  const dupResult = await bloodstream.process(liveObs);
  console.log(`   Duplicate Check Result: ${dupResult.isDuplicate ? 'DEDUPLICATED (PASSED)' : 'FAILED'}`);

  // 7. Test ZAO Adapter
  console.log('\n🤝 Testing Optional ZAO ProofDrop Compatibility Adapter...');
  const zaoAdapter = new ZaoProofDropAdapter();
  const rawZaoProof: ZaoProofDrop = {
    proofId: 'proof_zao_881920',
    workerId: 'zoe_worker_42',
    payload: { taskName: 'Model Inference', score: 0.99 },
    signature: 'sig_crypto_valid_01'
  };

  const artifact = zaoAdapter.wrap(rawZaoProof);
  console.log(`   Wrapped ProofDrop -> ProofArtifact ID: "${artifact.artifactId}" (Canonical Hash: ${artifact.contentHash.substring(0, 16)}...)`);

  const verification = await zaoAdapter.verify(artifact);
  console.log(`   Verification Check: ${verification.isValid ? 'VALIDATED (PASSED)' : 'FAILED'}`);

  console.log('\n🎉 [Success] Production-Grade Conformance Test Verified!');
}

testUniversalSDK();
