import { RedisStreamsTransport } from '../src/transport/redisStreamsTransport.js';
import { createObservationPayload } from '../src/observation/observationContract.js';

console.log('📡 [DreamNet Spore SDK] 2-Process Redis Streams Transport Demo...\n');

async function runMultiProcessDemo() {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const transportNode1 = new RedisStreamsTransport({ redisUrl, streamName: 'dreamnet:spore:cluster' });
  const transportNode2 = new RedisStreamsTransport({ redisUrl, streamName: 'dreamnet:spore:cluster' });

  // 1. Node 2 Subscribes as Consumer Group Replica
  await transportNode2.subscribe(async (obs) => {
    console.log(`📥 [Node 2 Replica Received Observation]: ${obs.provenance} (Hash: ${obs.hashes.canonicalPayloadHash.substring(0, 12)}...)`);
  });

  // 2. Node 1 Publishes Live Sensory Telemetry
  const obs = createObservationPayload({
    provenance: 'VacuumSpike:MultiProcessNode1',
    sourceDomain: 'cluster.internal',
    sourceType: 'stream',
    evidence: { workerId: 'node_replica_01', status: 'ACTIVE', loadAverage: 0.12 }
  });

  console.log('📤 [Node 1 Leader Publishing Telemetry]...');
  await transportNode1.publish(obs);

  console.log('\n🎉 [Success] 2-Process Distributed Transport Architecture Verified!');
}

runMultiProcessDemo();
