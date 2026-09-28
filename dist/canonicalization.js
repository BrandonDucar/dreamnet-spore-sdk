import canonicalize from 'canonicalize';
/** Shared JSON-only domain for observation and federation hashes. */
export function canonicalizeJson(value) {
    const ancestors = new Set();
    let nodes = 0;
    let stringUnits = 0;
    function string(input) {
        stringUnits += input.length;
        if (stringUnits > 1_048_576)
            throw new TypeError('JSON string budget exceeded');
        for (let i = 0; i < input.length; i++) {
            const unit = input.charCodeAt(i);
            if (unit >= 0xd800 && unit <= 0xdbff) {
                const next = input.charCodeAt(++i);
                if (!(next >= 0xdc00 && next <= 0xdfff))
                    throw new TypeError('Invalid Unicode surrogate');
            }
            else if (unit >= 0xdc00 && unit <= 0xdfff)
                throw new TypeError('Invalid Unicode surrogate');
        }
    }
    function visit(input, depth) {
        if (++nodes > 100_000 || depth > 64)
            throw new TypeError('JSON complexity budget exceeded');
        if (input === null || typeof input === 'boolean')
            return;
        if (typeof input === 'string')
            return string(input);
        if (typeof input === 'number' && Number.isFinite(input))
            return;
        if (typeof input !== 'object')
            throw new TypeError('Only finite JSON values are supported');
        if (ancestors.has(input))
            throw new TypeError('Cyclic JSON is not supported');
        const array = Array.isArray(input);
        if (array && Object.getPrototypeOf(input) !== Array.prototype)
            throw new TypeError('Only plain JSON arrays are supported');
        if (!array && ![Object.prototype, null].includes(Object.getPrototypeOf(input))) {
            throw new TypeError('Only plain JSON objects are supported');
        }
        const keys = Reflect.ownKeys(input);
        if (keys.length > 100_001 || (array && input.length > 100_000))
            throw new TypeError('JSON container budget exceeded');
        ancestors.add(input);
        try {
            if (array && keys.length !== input.length + 1)
                throw new TypeError('Sparse or extended arrays are not JSON');
            for (const key of keys) {
                if (array && key === 'length')
                    continue;
                if (typeof key !== 'string')
                    throw new TypeError('Symbol keys are not JSON');
                string(key);
                if (array && (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= input.length))
                    throw new TypeError('Extended arrays are not JSON');
                const descriptor = Object.getOwnPropertyDescriptor(input, key);
                if (!descriptor.enumerable || !('value' in descriptor))
                    throw new TypeError('Accessors and hidden fields are not JSON');
                visit(descriptor.value, depth + 1);
            }
        }
        finally {
            ancestors.delete(input);
        }
    }
    visit(value, 0);
    const result = canonicalize(value);
    if (result === undefined || Buffer.byteLength(result, 'utf8') > 1_048_576)
        throw new TypeError('Canonical JSON exceeds byte budget');
    return result;
}
