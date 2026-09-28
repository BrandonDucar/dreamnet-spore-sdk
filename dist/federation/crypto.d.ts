/**
 * Standards-Compliant RFC 8785 JSON Canonicalization & Ed25519 Primitives
 *
 * Rules:
 * 1. Strictly conforms to RFC 8785 (JSON Canonicalization Scheme - JCS).
 * 2. Hash is SHA-256 over raw canonical UTF-8 bytes with zero prefix.
 * 3. Signature is Ed25519 over raw 32-byte binary hash, encoded as 128 lowercase hex characters.
 */
import { type KeyObject } from 'node:crypto';
import type { SporeKeypair } from './types.js';
/**
 * Standard RFC 8785 Canonicalization
 */
export declare function canonicalizeRfc8785(obj: unknown): string;
/**
 * Computes SHA-256 digest of a canonical string
 */
export declare function computeSha256(canonicalString: string): string;
/**
 * Generates an Ed25519 keypair for Spore federation
 */
export declare function generateSporeKeypair(): SporeKeypair;
/**
 * Signs an envelope body (all fields except id and signature)
 */
export declare function signEnvelopeBody(privateKey: KeyObject | string, bodyWithoutSigAndId: Record<string, unknown>): {
    id: string;
    signature: string;
};
/**
 * Verifies Ed25519 signature over SHA-256 hash buffer
 */
export declare function verifyRawSignature(publicKey: KeyObject | string, hashHex: string, signatureHex: string): boolean;
