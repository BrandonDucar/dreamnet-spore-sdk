import { StandardObservation, createObservationPayload } from './observationContract.js';

export interface RateLimitPolicy {
  requestsPerMinute: number;
  burstAllowance: number;
}

export interface SecurityPolicy {
  allowedDomains: string[];
  maxResponseSizeBytes: number; // Default 5MB
  timeoutMs: number; // Default 5000ms
  allowPrivateIps: boolean; // Default false (SSRF Protection)
}

export interface VacuumSpikeManifest {
  id: string;
  version: string;
  sourceType: 'poll' | 'stream' | 'webhook';
  domains: string[];
  securityPolicy?: SecurityPolicy;
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

  /**
   * SSRF Protection: Validates target URL against manifest domain allowlists & private IP blocks
   */
  protected validateTargetUrl(urlStr: string): { valid: boolean; reason?: string } {
    try {
      const parsed = new URL(urlStr);

      // 1. Host allowlist validation
      const isAllowed = this.manifest.domains.some(d => parsed.hostname === d || parsed.hostname.endsWith(`.${d}`));
      if (!isAllowed) {
        return { valid: false, reason: `Host "${parsed.hostname}" is not in manifest domain allowlist` };
      }

      // 2. Private IP SSRF Blocking
      const host = parsed.hostname;
      const isPrivateIp = 
        host === 'localhost' ||
        host === '127.0.0.1' ||
        host === '::1' ||
        host.startsWith('10.') ||
        host.startsWith('192.168.') ||
        host.startsWith('169.254.') ||
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host);

      const allowPrivate = this.manifest.securityPolicy?.allowPrivateIps ?? false;
      if (isPrivateIp && !allowPrivate) {
        return { valid: false, reason: `SSRF Violation: Target host "${host}" is a private IP address.` };
      }

      return { valid: true };
    } catch (err: any) {
      return { valid: false, reason: `Invalid URL format: ${err.message}` };
    }
  }

  protected createObservation(evidence: Record<string, any>, confidenceScore = 0.95, metadata = {}): StandardObservation {
    return createObservationPayload({
      provenance: `VacuumSpike:${this.manifest.id}`,
      sourceDomain: this.manifest.domains[0] || 'Unknown Domain',
      sourceType: this.manifest.sourceType,
      evidence,
      confidenceScore,
      metadata
    });
  }

  abstract observe(target?: string): Promise<StandardObservation>;
}
