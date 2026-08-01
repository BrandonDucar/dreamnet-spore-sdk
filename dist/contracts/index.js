import { canonicalizeJson, sha256CanonicalJson } from '../protocol/canonicalize.js';
/**
 * RFC 8785 JSON Canonicalization Scheme serialization.
 */
export function canonicalJsonStringify(obj) {
    return canonicalizeJson(obj);
}
/**
 * Canonical SHA-256 hashing utility using RFC 8785 bytes.
 */
export function computeCanonicalHash(data) {
    return sha256CanonicalJson(data);
}
