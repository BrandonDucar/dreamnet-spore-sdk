import crypto from 'crypto';
import { canonicalizeJson } from '../canonicalization.js';
/**
 * Deterministic JSON Serialization (DreamNet Sorted JSON v0)
 */
export function canonicalJsonStringify(obj) {
    return canonicalizeJson(obj);
}
/**
 * Canonical SHA-256 Hashing Utility (DreamNet Sorted JSON v0)
 */
export function computeCanonicalHash(data) {
    const canonicalJson = canonicalJsonStringify(data);
    return crypto.createHash('sha256').update(canonicalJson, 'utf8').digest('hex');
}
