import { type StandardObservation } from './observationContract.js';
export interface RateLimitPolicy {
    requestsPerMinute: number;
    burstAllowance: number;
}
export interface SecurityPolicy {
    allowedDomains: string[];
    maxResponseSizeBytes: number;
    timeoutMs: number;
    allowPrivateIps: boolean;
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
export declare abstract class VacuumSpike {
    abstract manifest: VacuumSpikeManifest;
    protected validateTargetUrl(urlStr: string): {
        valid: boolean;
        reason?: string;
    };
    protected createObservation(evidence: Record<string, any>, confidenceScore?: number, options?: {
        metadata?: Record<string, any>;
        health?: 'HEALTHY' | 'DEGRADED';
    }): StandardObservation;
    abstract observe(target?: string): Promise<StandardObservation>;
}
