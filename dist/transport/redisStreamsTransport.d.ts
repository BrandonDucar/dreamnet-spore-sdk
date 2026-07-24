import { ObservationTransport, ObservationHandler, Unsubscribe } from './transportInterfaces.js';
import type { StandardObservation } from '../contracts/index.js';
export declare class RedisStreamsTransport implements ObservationTransport {
    private streamName;
    private redisUrl;
    constructor(options?: {
        redisUrl?: string;
        streamName?: string;
    });
    publish(observation: StandardObservation): Promise<void>;
    subscribe(handler: ObservationHandler): Promise<Unsubscribe>;
}
