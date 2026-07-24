import { type StandardObservation, computeCanonicalHash } from '../contracts/index.js';

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

export function createObservationPayload(params: CreateObservationOptions): StandardObservation {
  const payloadHash = computeCanonicalHash(params.evidence);

  return {
    schemaVersion: 'observation.v1',
    timestamp: new Date().toISOString(),
    provenance: params.provenance,
    confidence: {
      score: params.confidenceScore ?? 0.95,
      method: params.confidenceMethod || 'PROVENANCE_ASSURED',
      assessor: params.provenance
    },
    source: {
      domain: params.sourceDomain,
      sourceType: params.sourceType || 'poll'
    },
    evidence: params.evidence,
    hashes: {
      canonicalPayloadHash: payloadHash,
      hashAlgorithm: 'sha256:dreamnet-sorted-json:v0'
    },
    metadata: params.metadata || {},
    health: params.health || 'HEALTHY'
  };
}
