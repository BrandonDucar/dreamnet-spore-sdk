/**
 * Spore Federation Public Client
 *
 * Transport-agnostic client for discovering manifests, building signed envelopes,
 * verifying counterparties, and executing bilateral missions.
 */
import { type KeyObject } from 'node:crypto';
import { type ValidationOptions } from './verifier.js';
import type { SporeEnvelopeV1, SporeEnvelopeType, ApplicationReceiptV1, SporeManifestV1, SporeVerificationResult } from './types.js';
export interface CreateEnvelopeOptions<TPayload> {
    type: SporeEnvelopeType;
    issuer: string;
    recipient: string;
    payload: TPayload;
    privateKey: KeyObject | string;
    keyId?: string;
    nonce?: string;
    ttlMs?: number;
}
export declare class SporeClient {
    /**
     * Fetches and cryptographically verifies a remote peer's Spore manifest
     */
    static fetchManifest(manifestUrl: string): Promise<SporeManifestV1>;
    /**
     * Verifies that a manifest's manifest_digest matches its canonical body
     */
    static verifyManifestIntegrity(manifest: SporeManifestV1): boolean;
    /**
     * Constructs, canonicalizes, hashes, and signs a SporeEnvelope v1
     */
    static createEnvelope<TPayload extends object = Record<string, unknown>>(options: CreateEnvelopeOptions<TPayload>): SporeEnvelopeV1<TPayload>;
    /**
     * Helper to create a signed receipt envelope
     */
    static createReceiptEnvelope(options: {
        issuer: string;
        recipient: string;
        receipt: ApplicationReceiptV1;
        privateKey: KeyObject | string;
        keyId?: string;
    }): SporeEnvelopeV1<ApplicationReceiptV1>;
    /**
     * Verifies an incoming Spore envelope against all protocol v1 security boundaries
     */
    static verifyEnvelope(counterpartyPublicKey: KeyObject | string, envelope: unknown, options?: ValidationOptions): SporeVerificationResult;
    /**
     * Sends an envelope to a remote peer's endpoint via HTTP POST
     */
    static postEnvelope(endpointUrl: string, envelope: SporeEnvelopeV1, headers?: Record<string, string>): Promise<{
        status: number;
        ok: boolean;
        data: any;
    }>;
}
