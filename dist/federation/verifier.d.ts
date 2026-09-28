/**
 * Spore Federation Envelope Verifier (V1 Freeze)
 *
 * Enforces all 5 Adversarial Vectors:
 * 1. Strict Unknown Top-Level Field Rejection (UNKNOWN_FIELD_REJECTED)
 * 2. Payload / Digest Tampering Rejection (DIGEST_MISMATCH)
 * 3. Counterparty Cryptographic Signature Verification (INVALID_SIGNATURE)
 * 4. Temporal Expiry & Freshness Enforcement (ENVELOPE_EXPIRED)
 * 5. Consumed Nonce Replay Detection (409_REPLAY_ATTACK_DETECTED) vs Idempotent Retry (200 OK)
 */
import type { KeyObject } from 'node:crypto';
import type { SporeVerificationResult } from './types.js';
export declare const ALLOWED_TOP_LEVEL_FIELDS: Set<string>;
export interface ValidationOptions {
    nowMs?: number;
    maxClockSkewMs?: number;
    maxLifetimeMs?: number;
    expectedIssuer?: string;
    expectedRecipient?: string;
    expectedKeyId?: string;
    consumedNoncesStore?: Map<string, string>;
}
/**
 * Validates a Spore envelope against all protocol v1 security boundaries
 */
export declare function validateSporeEnvelope(counterpartyPublicKey: KeyObject | string, envelope: unknown, options?: ValidationOptions): SporeVerificationResult;
