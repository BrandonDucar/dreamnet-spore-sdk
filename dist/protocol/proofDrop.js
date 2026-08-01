import { createSignedEnvelope, } from './envelope.js';
function assertReference(reference, name) {
    if (!/^sha256:[a-f0-9]{64}$/.test(reference.digest)) {
        throw new TypeError(`${name}.digest must be a complete lowercase SHA-256 digest.`);
    }
    if (typeof reference.mediaType !== 'string' || reference.mediaType.length === 0) {
        throw new TypeError(`${name}.mediaType is required.`);
    }
    if (reference.sizeBytes !== undefined && (!Number.isSafeInteger(reference.sizeBytes) || reference.sizeBytes < 0)) {
        throw new TypeError(`${name}.sizeBytes must be a non-negative safe integer.`);
    }
    if (reference.uri !== undefined && (typeof reference.uri !== 'string' || reference.uri.length === 0)) {
        throw new TypeError(`${name}.uri must be a non-empty string when present.`);
    }
}
export function assertProofDropPayload(payload) {
    if (payload.schemaVersion !== 'proof-drop.v1')
        throw new TypeError('Unsupported Proof Drop version.');
    assertReference(payload.executionTrace, 'executionTrace');
    if (!Array.isArray(payload.evidence) || !Array.isArray(payload.outputs)) {
        throw new TypeError('Proof Drop evidence and outputs must be arrays.');
    }
    payload.evidence.forEach((reference, index) => assertReference(reference, `evidence[${index}]`));
    payload.outputs.forEach((reference, index) => assertReference(reference, `outputs[${index}]`));
    const provenanceFields = [payload.provenance?.originNode, payload.provenance?.runtime, payload.provenance?.environment];
    if (provenanceFields.some((value) => typeof value !== 'string' || value.length === 0)) {
        throw new TypeError('Proof Drop provenance requires originNode, runtime and environment.');
    }
    if (payload.provenance.gitCommitSha && !/^[a-f0-9]{40}([a-f0-9]{24})?$/.test(payload.provenance.gitCommitSha)) {
        throw new TypeError('gitCommitSha must be a complete SHA-1 or SHA-256 Git object ID.');
    }
    const referenceDigests = [
        payload.executionTrace.digest,
        ...payload.evidence.map((reference) => reference.digest),
        ...payload.outputs.map((reference) => reference.digest),
    ];
    if (new Set(referenceDigests).size !== referenceDigests.length) {
        throw new TypeError('Proof Drop content references cannot contain duplicate digests.');
    }
}
export function createProofDrop(options, privateKey) {
    assertProofDropPayload(options.payload);
    const unsigned = {
        specVersion: 'spore-envelope.v1',
        kind: 'PROOF_DROP',
        issuer: options.issuer,
        subject: options.subject,
        issuedAt: options.issuedAt,
        nonce: options.nonce,
        audience: options.audience,
        schema: 'https://schemas.dreamnet.ink/spore/proof-drop.v1.json',
        payload: options.payload,
        privacyClass: 'INTERNAL',
    };
    if (options.parents)
        unsigned.parents = options.parents;
    if (options.policyRef)
        unsigned.policyRef = options.policyRef;
    return createSignedEnvelope(unsigned, privateKey);
}
