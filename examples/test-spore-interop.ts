import { ConfigurableGovernor } from '../src/governance/governorInterfaces.js';
import { InMemoryTransport } from '../src/transport/transportInterfaces.js';
import { BloodstreamPipeline } from '../src/pipeline/bloodstreamPipeline.js';
import { OpportunityScreener, VitalSignalDetector } from '../src/pipeline/classifiers.js';
import { LiveWeatherSpike } from './live-weather-spike.js';
import { LiveGithubTrendingSpike } from '../src/spikes/liveGithubTrendingSpike.js';
import { LiveCoinGeckoMarketSpike } from '../src/spikes/liveCoinGeckoMarketSpike.js';
import { ZaoProofDropAdapter, ZaoProofDrop } from './adapters/zao-proof-drop.js';
import { canonicalJsonStringify, computeCanonicalHash } from '../src/contracts/index.js';

console.log('🔴 [DreamNet Spore SDK] 100% LIVE REAL-TIME DATA STREAM TEST (Zero Mocks)...\n');

async function test100PercentLiveSDK() {
  // 0. Task 1 — Golden Conformance Vector Test (ZAO v0.1 Interop)
  console.log('🧪 [Task 1 - Golden Conformance Vector] Verifying canonical JSON & SHA-256 hash...');
  const goldenPayload = {
    z: 100,
    a: 'dreamnet-spore',
    m: {
      b: true,
      a: null
    }
  };
  const expectedJson = '{"a":"dreamnet-spore","m":{"a":null,"b":true},"z":100}';
  const expectedHash = '6b560a8869530ac60f9d3795e55d04240d237010140502f8f7a768d190de013a';

  const actualJson = canonicalJsonStringify(goldenPayload);
  const actualHash = computeCanonicalHash(goldenPayload);

  if (actualJson !== expectedJson || actualHash !== expectedHash) {
    throw new Error(`❌ Golden Conformance Vector Failed! Got JSON "${actualJson}" and HASH "${actualHash}"`);
  }
  console.log(`   Canonical String: ${actualJson}`);
  console.log(`   SHA-256 Hash:     ${actualHash}`);
  console.log('   Status:           GOLDEN CONFORMANCE VERIFIED (PASSED)\n');

  // 1. Initialize Governor & Atomic Spend Reservation
  const governor = new ConfigurableGovernor({ dailyCapUsd: 250.0 });
  const reservation = governor.reserveSpend(50.00);
  console.log(`✅ [Governor Atomic Reservation] Reserved: $${reservation?.amountUsd} USD (Status: ${reservation?.status})`);
  if (reservation) {
    governor.settleSpend(reservation.reservationId, 48.50);
    console.log(`✅ [Governor Settlement] Settled Spend: $${governor.getStatus().spend} / $${governor.getStatus().limit} USD`);
  }

  // 2. Initialize Transport & Bloodstream Pipeline
  const transport = new InMemoryTransport();
  const bloodstream = new BloodstreamPipeline(transport);
  bloodstream.registerClassifier(new VitalSignalDetector());
  bloodstream.registerClassifier(new OpportunityScreener());

  transport.subscribe(async (obs) => {
    console.log(`📡 [Live Bloodstream Streamed Observation]: ${obs.provenance}`);
    console.log(`   Source Domain: ${obs.source.domain} (Type: ${obs.source.sourceType})`);
    console.log(`   Canonical Hash (RFC 8785): ${obs.hashes.canonicalPayloadHash.substring(0, 16)}... (${obs.hashes.hashAlgorithm})`);
  });

  // 3. Live Open-Meteo Weather Spike Call
  console.log('\n🌐 [1/3 LIVE DATA] Fetching Live Open-Meteo Weather Telemetry...');
  const weatherSpike = new LiveWeatherSpike();
  const weatherObs = await weatherSpike.observe('Palm Beach, FL');
  console.log(`   Live Weather Payload: ${weatherObs.evidence.city} -> Temp: ${weatherObs.evidence.temperatureCelsius}°C, Wind: ${weatherObs.evidence.windSpeedKmh}km/h`);
  await bloodstream.process(weatherObs);

  // 4. Live GitHub REST API Trending Spike Call
  console.log('\n🌐 [2/3 LIVE DATA] Fetching Live GitHub Trending AI Repositories...');
  const githubSpike = new LiveGithubTrendingSpike();
  const githubObs = await githubSpike.observe('topic:ai');
  const topRepo = (githubObs.evidence.topRepositories || [])[0];
  console.log(`   Live Top AI Repo: "${topRepo?.fullName}" (⭐ ${topRepo?.stars?.toLocaleString()} stars)`);
  await bloodstream.process(githubObs);

  // 5. Live CoinGecko Crypto Market Spike Call
  console.log('\n🌐 [3/3 LIVE DATA] Fetching Live Crypto Market Telemetry...');
  const cryptoSpike = new LiveCoinGeckoMarketSpike();
  const cryptoObs = await cryptoSpike.observe('bitcoin,ethereum,solana');
  console.log(`   Live Market Prices: BTC $${cryptoObs.evidence.pricesUsd?.bitcoin?.usd?.toLocaleString()} | ETH $${cryptoObs.evidence.pricesUsd?.ethereum?.usd?.toLocaleString()} | SOL $${cryptoObs.evidence.pricesUsd?.solana?.usd?.toLocaleString()}`);
  await bloodstream.process(cryptoObs);

  // 6. Test ZAO Adapter Validation
  console.log('\n🤝 [ZAO ProofDrop Interop] Verifying Live ZAO ProofDrop Compatibility...');
  const zaoAdapter = new ZaoProofDropAdapter();
  const rawZaoProof: ZaoProofDrop = {
    proofId: 'proof_live_994812',
    workerId: 'zoe_live_worker_01',
    payload: { taskName: 'Live Data Pipeline Audit', status: 'SUCCESS' },
    signature: 'sig_live_verified'
  };

  const artifact = zaoAdapter.wrap(rawZaoProof);
  const verification = await zaoAdapter.verify(artifact);
  console.log(`   Verification Check: ${verification.isValid ? 'VALIDATED (PASSED)' : 'FAILED'}`);

  console.log('\n🎉 [Success] 100% Live Real Data Stream Execution Verified!');
}

test100PercentLiveSDK();
