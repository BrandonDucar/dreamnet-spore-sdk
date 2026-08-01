import type { KeyLike } from 'node:crypto';
import { type EnvelopeVerification, type SporeEnvelope, type SporeEnvelopeKind } from './envelope.js';
export interface IssuerKeyRecord {
    issuerId: string;
    keyId: string;
    publicKey: KeyLike;
    validFrom?: string;
    validUntil?: string;
    revokedAt?: string;
}
export interface IssuerKeyResolver {
    resolve(issuerId: string, keyId: string): Promise<IssuerKeyRecord | undefined>;
}
export type ReplayClaim = 'CLAIMED' | 'DUPLICATE' | 'CONFLICT';
export interface ReplayStore {
    claim(scope: string, nonce: string, envelopeId: string, expiresAt: string): Promise<ReplayClaim>;
}
export interface RevocationResolver {
    isRevoked(envelopeId: string, at: Date): Promise<boolean>;
}
export type PayloadValidator = (payload: unknown) => void;
export declare class SchemaRegistry {
    private readonly validators;
    register(schema: string, validator: PayloadValidator): this;
    validate(schema: string, payload: unknown): {
        valid: boolean;
        errors: string[];
    };
}
export declare function createCoreSchemaRegistry(): SchemaRegistry;
export interface TrustPolicy {
    expectedAudience: string;
    requireExpiry: boolean;
    requireReplayProtection: boolean;
    requireRevocationCheck: boolean;
    allowedIssuers?: string[];
    allowedKinds?: SporeEnvelopeKind[];
    maxEnvelopeAgeMs?: number;
    clockSkewMs?: number;
    replayTtlMs?: number;
    replayScope?: string;
}
export interface TrustDependencies {
    keyResolver: IssuerKeyResolver;
    schemaRegistry: SchemaRegistry;
    replayStore?: ReplayStore;
    revocationResolver?: RevocationResolver;
}
export interface TrustVerification {
    valid: boolean;
    disposition: 'ACCEPT' | 'DUPLICATE' | 'REJECT';
    checks: {
        issuerPolicy: boolean;
        keyResolution: boolean;
        keyValidity: boolean;
        envelope: boolean;
        schema: boolean;
        revocation: boolean;
        replay: boolean;
    };
    replayClaim?: ReplayClaim;
    envelopeVerification?: EnvelopeVerification;
    errors: string[];
}
export declare function verifyEnvelopeWithTrust<TPayload>(envelope: SporeEnvelope<TPayload>, policy: TrustPolicy, dependencies: TrustDependencies, now?: Date): Promise<TrustVerification>;
export declare class StaticIssuerKeyResolver implements IssuerKeyResolver {
    private readonly records;
    constructor(records?: IssuerKeyRecord[]);
    register(record: IssuerKeyRecord): this;
    resolve(issuerId: string, keyId: string): Promise<IssuerKeyRecord | undefined>;
}
/** Process-local test implementation. Production runtimes need a durable atomic store. */
export declare class InMemoryReplayStore implements ReplayStore {
    private readonly now;
    private readonly claims;
    constructor(now?: () => number);
    claim(scope: string, nonce: string, envelopeId: string, expiresAt: string): Promise<ReplayClaim>;
}
/** Process-local test implementation. Production runtimes need durable revocation state. */
export declare class InMemoryRevocationResolver implements RevocationResolver {
    private readonly revoked;
    revoke(envelopeId: string): void;
    isRevoked(envelopeId: string): Promise<boolean>;
}
