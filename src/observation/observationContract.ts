import { StandardObservation, computeCanonicalHash } from '../contracts/index.js';

export function createObservationPayload(params: {
  provenance: string;
  sourceDomain: string;
  sourceType?: 'poll' | 'stream' | 'webhook';
  evidence: Record<string, any>;
  confidenceScore?: number;
  confidenceMethod?: 'HEURISTIC' | 'MODEL_INFERENCE' | 'PROVENANCE_ASSURED';
  metadata?: Record<string, any>;
  health?: 'HEALTHY' | 'DEGRADED';
}): StandardObservation {
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
      hashAlgorithm: 'sha256:jcs-rfc8785:v1'
    },
    metadata: params.metadata || {},
    health: params.health || 'HEALTHY'
  };
}
