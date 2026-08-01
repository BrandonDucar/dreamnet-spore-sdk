export type JsonPrimitive = null | boolean | number | string;
export type JsonValue = JsonPrimitive | JsonValue[] | {
    [key: string]: JsonValue;
};
/**
 * Canonicalize an I-JSON value according to RFC 8785 (JCS).
 *
 * Callers must provide data-shaped values. Runtime objects such as Date,
 * Map, Set, sparse arrays, undefined, bigint and cyclic structures fail
 * closed instead of being silently transformed.
 */
export declare function canonicalizeJson(value: unknown): string;
export declare function sha256CanonicalJson(value: unknown): string;
export declare function sha256DomainSeparatedJson(domain: string, value: unknown): string;
