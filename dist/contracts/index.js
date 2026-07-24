import crypto from 'crypto';
/**
 * Deterministic JSON Serialization (DreamNet Sorted JSON v0)
 */
export function canonicalJsonStringify(obj) {
    if (obj === null || typeof obj === 'boolean' || typeof obj === 'string') {
        return JSON.stringify(obj);
    }
    if (typeof obj === 'number') {
        if (!Number.isFinite(obj)) {
            throw new Error(`Canonical JSON Error: Non-finite number ${obj} cannot be serialized.`);
        }
        return JSON.stringify(obj);
    }
    if (Array.isArray(obj)) {
        return '[' + obj.map(item => (item === undefined ? 'null' : canonicalJsonStringify(item))).join(',') + ']';
    }
    if (typeof obj === 'object') {
        const sortedKeys = Object.keys(obj).sort();
        const keyValues = sortedKeys
            .filter(k => obj[k] !== undefined && typeof obj[k] !== 'function' && typeof obj[k] !== 'symbol')
            .map(k => `${JSON.stringify(k)}:${canonicalJsonStringify(obj[k])}`);
        return '{' + keyValues.join(',') + '}';
    }
    throw new Error(`Canonical JSON Error: Unsupported value type ${typeof obj}`);
}
/**
 * Canonical SHA-256 Hashing Utility (DreamNet Sorted JSON v0)
 */
export function computeCanonicalHash(data) {
    const canonicalJson = canonicalJsonStringify(data);
    return crypto.createHash('sha256').update(canonicalJson, 'utf8').digest('hex');
}
