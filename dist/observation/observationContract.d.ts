import { type StandardObservation } from '../contracts/index.js';
export type { StandardObservation };
export interface CreateObservationOptions {
    provenance: string;
    sourceDomain: string;
    sourceType?: 'poll' | 'stream' | 'webhook';
    evidence: Record<string, any>;
    confidenceScore?: number;
    confidenceMethod?: 'HEURISTIC' | 'MODEL_INFERENCE' | 'PROVENANCE_ASSURED';
    metadata?: Record<string, any>;
    health?: 'HEALTHY' | 'DEGRADED';
}
export declare function createObservationPayload(params: CreateObservationOptions): StandardObservation;
