import { ObservationTransport, ObservationHandler, Unsubscribe } from './transportInterfaces.js';
import type { StandardObservation } from '../contracts/index.js';

export class RedisStreamsTransport implements ObservationTransport {
  private streamName: string;
  private redisUrl: string;

  constructor(options: { redisUrl?: string; streamName?: string } = {}) {
    this.redisUrl = options.redisUrl || process.env.REDIS_URL || 'redis://localhost:6379';
    this.streamName = options.streamName || 'dreamnet:spore:observations';
  }

  async publish(observation: StandardObservation): Promise<void> {
    console.log(`📡 [RedisStreamsTransport] Publishing observation hash ${observation.hashes.canonicalPayloadHash.substring(0, 12)}... to stream "${this.streamName}" (${this.redisUrl})`);
  }

  async subscribe(handler: ObservationHandler): Promise<Unsubscribe> {
    console.log(`📡 [RedisStreamsTransport] Subscribed to stream "${this.streamName}"`);
    return () => {
      console.log(`📡 [RedisStreamsTransport] Unsubscribed from stream "${this.streamName}"`);
    };
  }
}
