/**
 * Standards-Compliant RFC 8785 JSON Canonicalization & Ed25519 Primitives
 *
 * Rules:
 * 1. Strictly conforms to RFC 8785 (JSON Canonicalization Scheme - JCS).
 * 2. Hash is SHA-256 over raw canonical UTF-8 bytes with zero prefix.
 * 3. Signature is Ed25519 over raw 32-byte binary hash, encoded as 128 lowercase hex characters.
 */
import crypto from 'node:crypto';
import { canonicalizeJson } from '../canonicalization.js';
/**
 * Standard RFC 8785 Canonicalization
 */
export function canonicalizeRfc8785(obj) {
    return canonicalizeJson(obj);
}
/**
 * Computes SHA-256 digest of a canonical string
 */
export function computeSha256(canonicalString) {
    return crypto.createHash('sha256').update(canonicalString, 'utf8').digest('hex');
}
/**
 * Generates an Ed25519 keypair for Spore federation
 */
export function generateSporeKeypair() {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
    return {
        publicKey,
        privateKey,
        publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }),
        privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' })
    };
}
/**
 * Signs an envelope body (all fields except id and signature)
 */
export function signEnvelopeBody(privateKey, bodyWithoutSigAndId) {
    const canonicalJson = canonicalizeRfc8785(bodyWithoutSigAndId);
    const hashHex = computeSha256(canonicalJson);
    const hashBuffer = Buffer.from(hashHex, 'hex');
    const keyObj = typeof privateKey === 'string'
        ? crypto.createPrivateKey(privateKey)
        : privateKey;
    const signature = crypto.sign(null, hashBuffer, keyObj).toString('hex');
    return {
        id: `sha256:${hashHex}`,
        signature
    };
}
/**
 * Verifies Ed25519 signature over SHA-256 hash buffer
 */
export function verifyRawSignature(publicKey, hashHex, signatureHex) {
    try {
        if (!/^[a-f0-9]{64}$/.test(hashHex) || !/^[a-f0-9]{128}$/.test(signatureHex))
            return false;
        const keyObj = typeof publicKey === 'string'
            ? crypto.createPublicKey(publicKey)
            : publicKey;
        const hashBuffer = Buffer.from(hashHex, 'hex');
        const sigBuffer = Buffer.from(signatureHex, 'hex');
        return crypto.verify(null, hashBuffer, keyObj, sigBuffer);
    }
    catch {
        return false;
    }
}
