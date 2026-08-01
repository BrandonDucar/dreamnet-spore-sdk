import { verifyEnvelope, } from './envelope.js';
import { assertProofDropPayload } from './proofDrop.js';
import { assertSporeLeasePayload } from './lease.js';
import { assertFederationCanaryPayload, FEDERATION_CANARY_SCHEMA } from './federationCanary.js';
export class SchemaRegistry {
    validators = new Map();
    register(schema, validator) {
        if (!schema || this.validators.has(schema)) {
            throw new TypeError(`Schema must be non-empty and registered once: ${schema}.`);
        }
        this.validators.set(schema, validator);
        return this;
    }
    validate(schema, payload) {
        const validator = this.validators.get(schema);
        if (!validator)
            return { valid: false, errors: [`Unknown payload schema: ${schema}.`] };
        try {
            validator(payload);
            return { valid: true, errors: [] };
        }
        catch (error) {
            return {
                valid: false,
                errors: [error instanceof Error ? error.message : `Payload failed schema ${schema}.`],
            };
        }
    }
}
export function createCoreSchemaRegistry() {
    return new SchemaRegistry()
        .register('https://schemas.dreamnet.ink/spore/proof-drop.v1.json', (payload) => {
        assertProofDropPayload(payload);
    })
        .register('https://schemas.dreamnet.ink/spore/lease.v1.json', (payload) => {
        assertSporeLeasePayload(payload);
    })
        .register(FEDERATION_CANARY_SCHEMA, (payload) => {
        assertFederationCanaryPayload(payload);
    });
}
function parseOptionalTimestamp(value) {
    if (value === undefined)
        return undefined;
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? timestamp : Number.NaN;
}
export async function verifyEnvelopeWithTrust(envelope, policy, dependencies, now = new Date()) {
    const errors = [];
    const checks = {
        issuerPolicy: false,
        keyResolution: false,
        keyValidity: false,
        envelope: false,
        schema: false,
        revocation: false,
        replay: false,
    };
    if (!envelope ||
        typeof envelope.issuer?.id !== 'string' ||
        typeof envelope.issuer?.keyId !== 'string' ||
        typeof envelope.kind !== 'string' ||
        typeof envelope.issuedAt !== 'string') {
        errors.push('Envelope is missing the issuer, key, kind, or issue time required for trust resolution.');
        return { valid: false, disposition: 'REJECT', checks, errors };
    }
    checks.issuerPolicy =
        (!policy.allowedIssuers || policy.allowedIssuers.includes(envelope.issuer?.id)) &&
            (!policy.allowedKinds || policy.allowedKinds.includes(envelope.kind));
    if (!checks.issuerPolicy)
        errors.push('Envelope issuer or kind is not allowed by policy.');
    let keyRecord;
    try {
        keyRecord = await dependencies.keyResolver.resolve(envelope.issuer.id, envelope.issuer.keyId);
    }
    catch (error) {
        errors.push(`Issuer key resolution failed: ${error instanceof Error ? error.message : 'unknown error'}.`);
        return { valid: false, disposition: 'REJECT', checks, errors };
    }
    checks.keyResolution =
        keyRecord !== undefined &&
            keyRecord.issuerId === envelope.issuer?.id &&
            keyRecord.keyId === envelope.issuer?.keyId;
    if (!checks.keyResolution || !keyRecord) {
        errors.push('No trusted issuer key was resolved for the envelope.');
        return { valid: false, disposition: 'REJECT', checks, errors };
    }
    const issuedAt = Date.parse(envelope.issuedAt);
    const validFrom = parseOptionalTimestamp(keyRecord.validFrom);
    const validUntil = parseOptionalTimestamp(keyRecord.validUntil);
    const revokedAt = parseOptionalTimestamp(keyRecord.revokedAt);
    checks.keyValidity =
        Number.isFinite(issuedAt) &&
            (validFrom === undefined || (Number.isFinite(validFrom) && issuedAt >= validFrom)) &&
            (validUntil === undefined || (Number.isFinite(validUntil) && issuedAt < validUntil)) &&
            (revokedAt === undefined || (Number.isFinite(revokedAt) && now.getTime() < revokedAt));
    if (!checks.keyValidity)
        errors.push('Issuer key is outside its validity window or revoked.');
    const envelopeVerification = verifyEnvelope(envelope, keyRecord.publicKey, {
        now,
        expectedAudience: policy.expectedAudience,
        clockSkewMs: policy.clockSkewMs ?? 30_000,
    });
    checks.envelope = envelopeVerification.valid;
    errors.push(...envelopeVerification.errors);
    if (policy.requireExpiry && !envelope.expiresAt) {
        checks.envelope = false;
        errors.push('Trust policy requires an envelope expiry.');
    }
    if (policy.maxEnvelopeAgeMs !== undefined &&
        Number.isFinite(issuedAt) &&
        now.getTime() - issuedAt > policy.maxEnvelopeAgeMs) {
        checks.envelope = false;
        errors.push('Envelope exceeds the maximum age allowed by policy.');
    }
    const schemaResult = dependencies.schemaRegistry.validate(envelope.schema, envelope.payload);
    checks.schema = schemaResult.valid;
    errors.push(...schemaResult.errors);
    if (policy.requireRevocationCheck) {
        if (!dependencies.revocationResolver) {
            errors.push('Trust policy requires a revocation resolver.');
        }
        else {
            try {
                checks.revocation = !(await dependencies.revocationResolver.isRevoked(envelope.id, now));
                if (!checks.revocation)
                    errors.push('Envelope has been revoked.');
            }
            catch (error) {
                errors.push(`Revocation check failed: ${error instanceof Error ? error.message : 'unknown error'}.`);
            }
        }
    }
    else {
        checks.revocation = true;
    }
    const preReplayValid = Object.entries(checks)
        .filter(([name]) => name !== 'replay')
        .every(([, valid]) => valid);
    if (!preReplayValid)
        return { valid: false, disposition: 'REJECT', checks, envelopeVerification, errors };
    let replayClaim;
    if (policy.requireReplayProtection) {
        if (!dependencies.replayStore) {
            errors.push('Trust policy requires a replay store.');
            return { valid: false, disposition: 'REJECT', checks, envelopeVerification, errors };
        }
        const replayTtlMs = policy.replayTtlMs ?? 24 * 60 * 60 * 1000;
        if (!Number.isFinite(replayTtlMs) || replayTtlMs <= 0) {
            errors.push('Trust policy replayTtlMs must be positive.');
            return { valid: false, disposition: 'REJECT', checks, envelopeVerification, errors };
        }
        const replayExpiresAt = envelope.expiresAt ?? new Date(now.getTime() + replayTtlMs).toISOString();
        try {
            replayClaim = await dependencies.replayStore.claim(policy.replayScope ?? `${policy.expectedAudience}:${envelope.issuer.id}`, envelope.nonce, envelope.id, replayExpiresAt);
        }
        catch (error) {
            errors.push(`Replay check failed: ${error instanceof Error ? error.message : 'unknown error'}.`);
            return { valid: false, disposition: 'REJECT', checks, envelopeVerification, errors };
        }
        checks.replay = replayClaim !== 'CONFLICT';
        if (!checks.replay)
            errors.push('Envelope nonce conflicts with another content ID.');
    }
    else {
        checks.replay = true;
    }
    const valid = Object.values(checks).every(Boolean);
    return {
        valid,
        disposition: valid ? (replayClaim === 'DUPLICATE' ? 'DUPLICATE' : 'ACCEPT') : 'REJECT',
        checks,
        replayClaim,
        envelopeVerification,
        errors,
    };
}
export class StaticIssuerKeyResolver {
    records = new Map();
    constructor(records = []) {
        records.forEach((record) => this.register(record));
    }
    register(record) {
        if (!record.issuerId || !record.keyId)
            throw new TypeError('Issuer key record requires issuerId and keyId.');
        const id = `${record.issuerId}\0${record.keyId}`;
        if (this.records.has(id))
            throw new TypeError(`Issuer key is already registered: ${record.keyId}.`);
        this.records.set(id, record);
        return this;
    }
    async resolve(issuerId, keyId) {
        return this.records.get(`${issuerId}\0${keyId}`);
    }
}
/** Process-local test implementation. Production runtimes need a durable atomic store. */
export class InMemoryReplayStore {
    now;
    claims = new Map();
    constructor(now = Date.now) {
        this.now = now;
    }
    async claim(scope, nonce, envelopeId, expiresAt) {
        const now = this.now();
        for (const [key, value] of this.claims) {
            if (value.expiresAt <= now)
                this.claims.delete(key);
        }
        const key = `${scope}\0${nonce}`;
        const existing = this.claims.get(key);
        if (existing)
            return existing.envelopeId === envelopeId ? 'DUPLICATE' : 'CONFLICT';
        const expiry = Date.parse(expiresAt);
        if (!Number.isFinite(expiry) || expiry <= now)
            throw new TypeError('Replay claim expiry must be in the future.');
        this.claims.set(key, { envelopeId, expiresAt: expiry });
        return 'CLAIMED';
    }
}
/** Process-local test implementation. Production runtimes need durable revocation state. */
export class InMemoryRevocationResolver {
    revoked = new Set();
    revoke(envelopeId) {
        this.revoked.add(envelopeId);
    }
    async isRevoked(envelopeId) {
        return this.revoked.has(envelopeId);
    }
}
