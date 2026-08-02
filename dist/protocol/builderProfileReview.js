import { createSignedEnvelope, } from './envelope.js';
export const BUILDER_PROFILE_REVIEW_SCHEMA = 'https://schemas.dreamnet.ink/spore/builder-profile-review.v1.json';
const PAYLOAD_KEYS = new Set([
    'schemaVersion', 'candidateEnvelopeId', 'profileId', 'profileRevision',
    'profileContentDigest', 'reviewerId', 'verdict', 'evidence', 'reviewedAt',
]);
const REFERENCE_KEYS = new Set(['digest', 'mediaType', 'sizeBytes', 'uri']);
function assertExactKeys(value, allowed, name) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new TypeError(`${name} must be an object.`);
    }
    const extras = Object.keys(value).filter((key) => !allowed.has(key));
    if (extras.length > 0)
        throw new TypeError(`${name} contains unknown fields: ${extras.join(', ')}.`);
}
function assertString(value, name, maxLength = 512) {
    if (typeof value !== 'string' || value.trim().length === 0 || value.length > maxLength) {
        throw new TypeError(`${name} must contain 1 to ${maxLength} characters.`);
    }
}
function assertTimestamp(value, name) {
    assertString(value, name, 40);
    const timestamp = Date.parse(value);
    if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== value) {
        throw new TypeError(`${name} must be an ISO 8601 UTC timestamp.`);
    }
}
function assertReference(reference, name) {
    assertExactKeys(reference, REFERENCE_KEYS, name);
    if (!/^sha256:[a-f0-9]{64}$/.test(String(reference.digest ?? ''))) {
        throw new TypeError(`${name}.digest must be a complete lowercase SHA-256 digest.`);
    }
    assertString(reference.mediaType, `${name}.mediaType`, 128);
    if (reference.sizeBytes !== undefined &&
        (!Number.isSafeInteger(reference.sizeBytes) || Number(reference.sizeBytes) < 0)) {
        throw new TypeError(`${name}.sizeBytes must be a non-negative safe integer.`);
    }
    if (reference.uri !== undefined)
        assertString(reference.uri, `${name}.uri`, 2048);
}
export function assertBuilderProfileReviewPayload(payload) {
    assertExactKeys(payload, PAYLOAD_KEYS, 'Builder Profile review');
    if (payload.schemaVersion !== 'builder-profile-review.v1') {
        throw new TypeError('Unsupported Builder Profile review version.');
    }
    if (!/^spore:profile:sha256:[a-f0-9]{64}$/.test(payload.candidateEnvelopeId)) {
        throw new TypeError('candidateEnvelopeId must be a complete profile envelope ID.');
    }
    assertString(payload.profileId, 'profileId', 128);
    if (!Number.isSafeInteger(payload.profileRevision) || payload.profileRevision < 1) {
        throw new TypeError('profileRevision must be a positive safe integer.');
    }
    if (!/^sha256:[a-f0-9]{64}$/.test(payload.profileContentDigest)) {
        throw new TypeError('profileContentDigest must be a complete lowercase SHA-256 digest.');
    }
    assertString(payload.reviewerId, 'reviewerId', 256);
    if (!['APPROVE', 'REJECT'].includes(payload.verdict)) {
        throw new TypeError('Builder Profile review verdict is invalid.');
    }
    if (!Array.isArray(payload.evidence) || payload.evidence.length < 1 || payload.evidence.length > 20) {
        throw new TypeError('Builder Profile reviews require 1 to 20 evidence references.');
    }
    payload.evidence.forEach((reference, index) => assertReference(reference, `evidence[${index}]`));
    const digests = payload.evidence.map((reference) => reference.digest);
    if (new Set(digests).size !== digests.length) {
        throw new TypeError('Builder Profile review evidence cannot contain duplicate digests.');
    }
    assertTimestamp(payload.reviewedAt, 'reviewedAt');
}
export function createBuilderProfileReviewReceipt(options, privateKey) {
    assertBuilderProfileReviewPayload(options.payload);
    if (options.issuer.id !== options.payload.reviewerId) {
        throw new TypeError('Builder Profile review issuer must equal payload.reviewerId.');
    }
    if (Date.parse(options.payload.reviewedAt) > Date.parse(options.issuedAt)) {
        throw new TypeError('Builder Profile review reviewedAt cannot be later than envelope issuedAt.');
    }
    const unsigned = {
        specVersion: 'spore-envelope.v1',
        kind: 'RECEIPT',
        issuer: options.issuer,
        subject: options.payload.candidateEnvelopeId,
        issuedAt: options.issuedAt,
        expiresAt: options.expiresAt,
        nonce: options.nonce,
        audience: options.audience,
        schema: BUILDER_PROFILE_REVIEW_SCHEMA,
        payload: options.payload,
        parents: [options.payload.candidateEnvelopeId],
        policyRef: options.policyRef,
        privacyClass: 'CONFIDENTIAL',
    };
    return createSignedEnvelope(unsigned, privateKey);
}
