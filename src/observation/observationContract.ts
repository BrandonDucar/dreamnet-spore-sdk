import crypto from 'crypto';

export interface StandardObservation {
  timestamp: string;
  provenance: string;
  confidence: number;
  source: string;
  evidence: Record<string, any>;
  hashes: { payloadHash: string };
  metadata: Record<string, any>;
  health: 'HEALTHY' | 'DEGRADED';
}

export function createObservationPayload(params: {
  provenance: string;
  source: string;
  evidence: Record<string, any>;
  confidence?: number;
  metadata?: Record<string, any>;
  health?: 'HEALTHY' | 'DEGRADED';
}): StandardObservation {
  const payloadStr = JSON.stringify(params.evidence);
  const payloadHash = crypto.createHash('sha256').update(payloadStr).digest('hex');

  return {
    schemaVersion: 'observation.v1',
    timestamp: new Date().toISOString(),
    provenance: params.provenance,
    confidence: params.confidence ?? 0.95,
    source: params.source,
    evidence: params.evidence,
    hashes: { payloadHash },
    metadata: params.metadata || {},
    health: params.health || 'HEALTHY'
  };
}

