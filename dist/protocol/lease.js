import { createSignedEnvelope, verifyEnvelope, } from './envelope.js';
function parseIso(value, name) {
    const timestamp = Date.parse(value);
    if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== value) {
        throw new TypeError(`${name} must be an ISO 8601 UTC timestamp.`);
    }
    return timestamp;
}
export function assertSporeLeasePayload(payload) {
    if (payload.schemaVersion !== 'spore-lease.v1')
        throw new TypeError('Unsupported lease version.');
    if (!payload.tenantId || !payload.sporeId || !payload.policyRef) {
        throw new TypeError('Lease tenantId, sporeId and policyRef are required.');
    }
    parseIso(payload.notBefore, 'notBefore');
    if (!['ACTIVE', 'PAUSED', 'REVOKED'].includes(payload.state))
        throw new TypeError('Unsupported lease state.');
    if (!Array.isArray(payload.capabilities) || new Set(payload.capabilities).size !== payload.capabilities.length) {
        throw new TypeError('Lease capabilities must be a duplicate-free array.');
    }
    payload.capabilities.forEach((capability, index) => {
        if (typeof capability !== 'string' || capability.length === 0) {
            throw new TypeError(`capabilities[${index}] must be a non-empty string.`);
        }
    });
    if (payload.state === 'ACTIVE' && payload.capabilities.length === 0) {
        throw new TypeError('An active lease must grant at least one explicit capability.');
    }
}
export function createSporeLease(options, privateKey) {
    assertSporeLeasePayload(options.payload);
    if (Date.parse(options.payload.notBefore) >= Date.parse(options.expiresAt)) {
        throw new TypeError('Lease notBefore must be earlier than expiresAt.');
    }
    const unsigned = {
        specVersion: 'spore-envelope.v1',
        kind: 'LEASE',
        issuer: options.issuer,
        subject: options.payload.sporeId,
        issuedAt: options.issuedAt,
        expiresAt: options.expiresAt,
        nonce: options.nonce,
        audience: options.audience,
        schema: 'https://schemas.dreamnet.ink/spore/lease.v1.json',
        payload: options.payload,
        policyRef: options.payload.policyRef,
        privacyClass: 'INTERNAL',
    };
    if (options.parents)
        unsigned.parents = options.parents;
    return createSignedEnvelope(unsigned, privateKey);
}
export function evaluateSporeLease(lease, request, issuerPublicKey) {
    if (!lease)
        return { allowed: false, reason: 'LEASE_MISSING' };
    const verification = verifyEnvelope(lease, issuerPublicKey, {
        now: request.now,
        expectedAudience: request.audience,
        clockSkewMs: 0,
    });
    if (!verification.valid || lease.kind !== 'LEASE')
        return { allowed: false, reason: 'LEASE_INVALID' };
    try {
        assertSporeLeasePayload(lease.payload);
    }
    catch {
        return { allowed: false, reason: 'LEASE_INVALID' };
    }
    if (lease.payload.state !== 'ACTIVE')
        return { allowed: false, reason: 'LEASE_INACTIVE' };
    if (Date.parse(lease.payload.notBefore) > (request.now ?? new Date()).getTime()) {
        return { allowed: false, reason: 'LEASE_NOT_YET_ACTIVE' };
    }
    if (lease.payload.tenantId !== request.tenantId)
        return { allowed: false, reason: 'TENANT_MISMATCH' };
    if (lease.payload.sporeId !== request.sporeId)
        return { allowed: false, reason: 'SPORE_MISMATCH' };
    if (!lease.payload.capabilities.includes(request.capability)) {
        return { allowed: false, reason: 'CAPABILITY_DENIED' };
    }
    return { allowed: true, reason: 'LEASE_ACTIVE' };
}
