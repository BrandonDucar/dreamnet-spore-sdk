/**
 * Spore Federation Public Client
 *
 * Transport-agnostic client for discovering manifests, building signed envelopes,
 * verifying counterparties, and executing bilateral missions.
 */
import crypto from 'node:crypto';
import { canonicalizeRfc8785, computeSha256, signEnvelopeBody } from './crypto.js';
import { validateSporeEnvelope } from './verifier.js';
export class SporeClient {
    /**
     * Fetches and cryptographically verifies a remote peer's Spore manifest
     */
    static async fetchManifest(manifestUrl) {
        const res = await fetch(manifestUrl, {
            headers: { 'Accept': 'application/json' }
        });
        if (!res.ok) {
            throw new Error(`FETCH_MANIFEST_FAILED: HTTP ${res.status} from ${manifestUrl}`);
        }
        const manifest = (await res.json());
        this.verifyManifestIntegrity(manifest);
        return manifest;
    }
    /**
     * Verifies that a manifest's manifest_digest matches its canonical body
     */
    static verifyManifestIntegrity(manifest) {
        const { manifest_digest, ...bodyWithoutDigest } = manifest;
        if (!manifest_digest) {
            throw new Error('MISSING_MANIFEST_DIGEST');
        }
        const canonicalBody = canonicalizeRfc8785(bodyWithoutDigest);
        const computedHash = computeSha256(canonicalBody);
        const normalizedActual = manifest_digest.startsWith('sha256:')
            ? manifest_digest.slice(7)
            : manifest_digest;
        if (normalizedActual !== computedHash) {
            throw new Error(`MANIFEST_TAMPERED: Digest '${manifest_digest}' does not match computed 'sha256:${computedHash}'`);
        }
        return true;
    }
    /**
     * Constructs, canonicalizes, hashes, and signs a SporeEnvelope v1
     */
    static createEnvelope(options) {
        const now = Date.now();
        const ttl = options.ttlMs ?? 300_000; // 5 minutes default
        const nonce = options.nonce ?? `nonce-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
        const bodyWithoutSigAndId = {
            v: 'spore-envelope-v1',
            type: options.type,
            issuer: options.issuer,
            recipient: options.recipient,
            nonce,
            created_at: new Date(now).toISOString(),
            expires_at: new Date(now + ttl).toISOString(),
            payload: options.payload,
            ...(options.keyId ? { key_id: options.keyId } : {})
        };
        const { id, signature } = signEnvelopeBody(options.privateKey, bodyWithoutSigAndId);
        return {
            ...bodyWithoutSigAndId,
            id,
            signature
        };
    }
    /**
     * Helper to create a signed receipt envelope
     */
    static createReceiptEnvelope(options) {
        return this.createEnvelope({
            type: 'receipt',
            issuer: options.issuer,
            recipient: options.recipient,
            payload: options.receipt,
            privateKey: options.privateKey,
            keyId: options.keyId
        });
    }
    /**
     * Verifies an incoming Spore envelope against all protocol v1 security boundaries
     */
    static verifyEnvelope(counterpartyPublicKey, envelope, options) {
        return validateSporeEnvelope(counterpartyPublicKey, envelope, options);
    }
    /**
     * Sends an envelope to a remote peer's endpoint via HTTP POST
     */
    static async postEnvelope(endpointUrl, envelope, headers = {}) {
        const res = await fetch(endpointUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                ...headers
            },
            body: JSON.stringify(envelope)
        });
        const data = await res.json().catch(() => ({}));
        return {
            status: res.status,
            ok: res.ok,
            data
        };
    }
}
