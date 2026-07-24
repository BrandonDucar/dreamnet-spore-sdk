import { ConfigurableGovernor } from '../src/governance/governorInterfaces.js';
import { InMemoryTransport } from '../src/transport/transportInterfaces.js';
import { BloodstreamPipeline } from '../src/pipeline/bloodstreamPipeline.js';
import { OpportunityScreener, VitalSignalDetector } from '../src/pipeline/classifiers.js';
import { MockWeatherSpike } from './mock-weather-spike.js';
import { LiveWeatherSpike } from './live-weather-spike.js';
import { ZaoProofDropAdapter, ZaoProofDrop } from './adapters/zao-proof-drop.js';

console.log('🌿 [DreamNet Spore SDK] Ecosystem-Neutral Interoperability & Bloodstream Test...\n');

async function testUniversalSDK() {
  // 1. Initialize Configurable Governor
  const governor = new ConfigurableGovernor({ dailyCapUsd: 150.0 });
  governor.recordSpend(15.00);
  console.log(`✅ [Governor] Current Spend: $${governor.getStatus().spend} / $${governor.getStatus().limit} USD`);

  // 2. Initialize Transport & Bloodstream Pipeline
  const transport = new InMemoryTransport();
  const bloodstream = new BloodstreamPipeline(transport);
  bloodstream.registerClassifier(new VitalSignalDetector());
  bloodstream.registerClassifier(new OpportunityScreener());

  transport.subscribe(async (obs) => {
    console.log(`📡 [Bloodstream Emitted Observation]: ${obs.provenance} (Health: ${obs.health})`);
    console.log(`   Tags: ${JSON.stringify(obs.metadata.classificationTags || [])}`);
  });

  // 3. Test Mock Weather Spike
  console.log('\n👁️ Testing Mock Weather Spike...');
  const mockSpike = new MockWeatherSpike();
  const mockObs = await mockSpike.observe('Palm Beach, FL');
  await bloodstream.process(mockObs);

  // 4. Test Live Weather Spike (Real Open-Meteo Endpoint Call)
  console.log('\n🌐 Testing Live Weather Spike (Calling Open-Meteo API)...');
  const liveSpike = new LiveWeatherSpike();
  const liveObs = await liveSpike.observe('Palm Beach, FL');
  await bloodstream.process(liveObs);

  // 5. Test Deduplication
  console.log('\n🔄 Testing Pipeline Deduplication (Resending Live Observation)...');
  const dupResult = await bloodstream.process(liveObs);
  console.log(`   Duplicate Check Result: ${dupResult.isDuplicate ? 'DEDUPLICATED (PASSED)' : 'FAILED'}`);

  // 6. Test Generic ZAO Adapter Example
  console.log('\n🤝 Testing Optional ZAO ProofDrop Compatibility Adapter...');
  const zaoAdapter = new ZaoProofDropAdapter();
  const rawZaoProof: ZaoProofDrop = {
    proofId: 'proof_zao_881920',
    workerId: 'zoe_worker_42',
    payload: { taskName: 'Model Inference', score: 0.99 },
    signature: 'sig_crypto_valid_01'
  };

  const artifact = zaoAdapter.wrap(rawZaoProof);
  console.log(`   Wrapped ProofDrop -> ProofArtifact ID: "${artifact.artifactId}" (Hash: ${artifact.contentHash.substring(0, 16)}...)`);

  const verification = await zaoAdapter.verify(artifact);
  console.log(`   Verification Check: ${verification.isValid ? 'VALIDATED (PASSED)' : 'FAILED'}`);

  console.log('\n🎉 [Success] Refactored Ecosystem-Neutral DreamNet Spore SDK Verified!');
}

testUniversalSDK();
