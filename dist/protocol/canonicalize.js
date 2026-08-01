import { createHash } from 'node:crypto';
function assertUnicodeScalarString(value, path) {
    for (let index = 0; index < value.length; index += 1) {
        const codeUnit = value.charCodeAt(index);
        if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
            const next = value.charCodeAt(index + 1);
            if (!(next >= 0xdc00 && next <= 0xdfff)) {
                throw new TypeError(`RFC 8785 canonicalization rejected a lone high surrogate at ${path}.`);
            }
            index += 1;
        }
        else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
            throw new TypeError(`RFC 8785 canonicalization rejected a lone low surrogate at ${path}.`);
        }
    }
}
/**
 * Canonicalize an I-JSON value according to RFC 8785 (JCS).
 *
 * Callers must provide data-shaped values. Runtime objects such as Date,
 * Map, Set, sparse arrays, undefined, bigint and cyclic structures fail
 * closed instead of being silently transformed.
 */
export function canonicalizeJson(value) {
    const ancestors = new Set();
    const serialize = (input, path) => {
        if (input === null || typeof input === 'boolean') {
            return JSON.stringify(input);
        }
        if (typeof input === 'string') {
            assertUnicodeScalarString(input, path);
            return JSON.stringify(input);
        }
        if (typeof input === 'number') {
            if (!Number.isFinite(input) || Object.is(input, -0)) {
                throw new TypeError(`RFC 8785 canonicalization rejected a non-I-JSON number at ${path}.`);
            }
            return JSON.stringify(input);
        }
        if (typeof input !== 'object') {
            throw new TypeError(`RFC 8785 canonicalization rejected ${typeof input} at ${path}.`);
        }
        if (ancestors.has(input)) {
            throw new TypeError(`RFC 8785 canonicalization rejected a cyclic value at ${path}.`);
        }
        ancestors.add(input);
        try {
            if (Array.isArray(input)) {
                const values = [];
                for (let index = 0; index < input.length; index += 1) {
                    if (!Object.prototype.hasOwnProperty.call(input, index)) {
                        throw new TypeError(`RFC 8785 canonicalization rejected a sparse array at ${path}[${index}].`);
                    }
                    values.push(serialize(input[index], `${path}[${index}]`));
                }
                return `[${values.join(',')}]`;
            }
            const prototype = Object.getPrototypeOf(input);
            if (prototype !== Object.prototype && prototype !== null) {
                throw new TypeError(`RFC 8785 canonicalization rejected a non-data object at ${path}.`);
            }
            const ownKeys = Reflect.ownKeys(input);
            if (ownKeys.some((key) => typeof key !== 'string')) {
                throw new TypeError(`RFC 8785 canonicalization rejected a symbol property at ${path}.`);
            }
            if (ownKeys.some((key) => !Object.prototype.propertyIsEnumerable.call(input, key))) {
                throw new TypeError(`RFC 8785 canonicalization rejected a non-enumerable property at ${path}.`);
            }
            if (ownKeys.some((key) => {
                const descriptor = Object.getOwnPropertyDescriptor(input, key);
                return descriptor?.get !== undefined || descriptor?.set !== undefined;
            })) {
                throw new TypeError(`RFC 8785 canonicalization rejected an accessor property at ${path}.`);
            }
            const record = input;
            const keys = Object.keys(record).sort();
            const fields = keys.map((key) => {
                assertUnicodeScalarString(key, `${path}.<key>`);
                return `${JSON.stringify(key)}:${serialize(record[key], `${path}.${key}`)}`;
            });
            return `{${fields.join(',')}}`;
        }
        finally {
            ancestors.delete(input);
        }
    };
    return serialize(value, '$');
}
export function sha256CanonicalJson(value) {
    return createHash('sha256').update(canonicalizeJson(value), 'utf8').digest('hex');
}
export function sha256DomainSeparatedJson(domain, value) {
    if (!domain || domain.includes('\0')) {
        throw new TypeError('Hash domain must be non-empty and cannot contain a null byte.');
    }
    return createHash('sha256')
        .update(domain, 'utf8')
        .update(Buffer.from([0]))
        .update(canonicalizeJson(value), 'utf8')
        .digest('hex');
}
