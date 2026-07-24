import { StandardObservation, createObservationPayload } from './observationContract.js';

export interface RateLimitPolicy {
  requestsPerMinute: number;
  burstAllowance: number;
}

export interface VacuumSpikeManifest {
  id: string;
  version: string;
  sourceType: 'poll' | 'stream' | 'webhook';
  domains: string[];
  dataLicense?: string;
  attributionRequired?: boolean;
  retentionPolicy?: string;
  rateLimit?: RateLimitPolicy;
  requiredSecrets: string[];
  outputSchemas: string[];
  healthEndpoint?: string;
}

export abstract class VacuumSpike {
  abstract manifest: VacuumSpikeManifest;

  protected createObservation(evidence: Record<string, any>, confidence = 0.95, metadata = {}): StandardObservation {
    return createObservationPayload({
      provenance: `VacuumSpike:${this.manifest.id}`,
      source: this.manifest.domains[0] || 'Unknown Domain',
      evidence,
      confidence,
      metadata
    });
  }

  abstract observe(target?: string): Promise<StandardObservation>;
}
