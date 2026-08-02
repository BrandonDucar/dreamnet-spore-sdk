import { type KeyLike } from 'node:crypto';
export declare const SPORE_ENVELOPE_VERSION: "spore-envelope.v1";
export declare const SPORE_HASH_ALGORITHM: "sha256:rfc8785";
export type SporeEnvelopeKind = 'OBSERVATION' | 'ASSIGNMENT' | 'RESULT' | 'PROOF_DROP' | 'RECEIPT' | 'CLAIM' | 'COUNTERCLAIM' | 'VERIFICATION' | 'CAPABILITY' | 'MUTATION' | 'LEASE' | 'REVOCATION' | 'POLICY' | 'PROFILE' | 'SETTLEMENT';
export interface SporeIssuer {
    id: string;
    keyId: string;
}
export interface UnsignedSporeEnvelope<TPayload = unknown> {
    specVersion: typeof SPORE_ENVELOPE_VERSION;
    kind: SporeEnvelopeKind;
    issuer: SporeIssuer;
    subject?: string;
    issuedAt: string;
    expiresAt?: string;
    nonce: string;
    audience: string[];
    schema: string;
    payload: TPayload;
    parents?: string[];
    dependencies?: string[];
    policyRef?: string;
    privacyClass?: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';
}
export interface SporeEnvelopeSignature {
    algorithm: 'Ed25519';
    keyId: string;
    value: string;
}
export interface SporeEnvelope<TPayload = unknown> extends UnsignedSporeEnvelope<TPayload> {
    id: string;
    hash: {
        algorithm: typeof SPORE_HASH_ALGORITHM;
        digest: string;
    };
    signature: SporeEnvelopeSignature;
}
export interface VerifyEnvelopeOptions {
    now?: Date;
    expectedAudience?: string;
    clockSkewMs?: number;
}
export interface EnvelopeVerification {
    valid: boolean;
    checks: {
        structure: boolean;
        contentId: boolean;
        signature: boolean;
        freshness: boolean;
        audience: boolean;
    };
    errors: string[];
}
export declare function assertUnsignedEnvelope(value: UnsignedSporeEnvelope<unknown>): void;
export declare function envelopeSigningBytes(unsigned: UnsignedSporeEnvelope<unknown>): Buffer;
export declare function computeEnvelopeDigest(unsigned: UnsignedSporeEnvelope<unknown>): string;
export declare function createSignedEnvelope<TPayload>(unsigned: UnsignedSporeEnvelope<TPayload>, privateKey: KeyLike): SporeEnvelope<TPayload>;
export declare function unsignedEnvelopeOf<TPayload>(envelope: SporeEnvelope<TPayload>): UnsignedSporeEnvelope<TPayload>;
export declare function verifyEnvelope<TPayload>(envelope: SporeEnvelope<TPayload>, publicKey: KeyLike, options?: VerifyEnvelopeOptions): EnvelopeVerification;
