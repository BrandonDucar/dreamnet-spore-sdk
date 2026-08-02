import { computeBuilderProfileContentDigest, } from './builderProfile.js';
import { BUILDER_PROFILE_REVIEW_SCHEMA, } from './builderProfileReview.js';
import { verifyEnvelopeWithTrust, } from './trust.js';
export class InMemorySporeEnvelopeResolver {
    envelopes = new Map();
    constructor(envelopes = []) {
        for (const envelope of envelopes)
            this.put(envelope);
    }
    put(envelope) {
        if (!envelope?.id || this.envelopes.has(envelope.id)) {
            throw new TypeError(`Envelope IDs must be non-empty and registered once: ${envelope?.id}.`);
        }
        this.envelopes.set(envelope.id, envelope);
    }
    async resolve(envelopeId) {
        return this.envelopes.get(envelopeId);
    }
}
function reject(checks, profileVerification, errors, reviewVerifications = [], candidateVerification) {
    return {
        valid: false,
        disposition: 'REJECT',
        checks,
        profileVerification,
        candidateVerification,
        reviewVerifications,
        errors,
    };
}
export async function verifyReviewedBuilderProfile(envelope, options) {
    const now = options.now ?? new Date();
    const checks = {
        profile: false,
        candidate: false,
        contentBinding: false,
        dependencyGraph: false,
        reviews: false,
        reviewerIndependence: false,
        threshold: false,
    };
    const errors = [];
    const profileVerification = await verifyEnvelopeWithTrust(envelope, options.profilePolicy, options.dependencies, now);
    checks.profile = profileVerification.valid &&
        envelope.kind === 'PROFILE' &&
        envelope.payload.status === 'REVIEWED' &&
        envelope.subject === envelope.payload.builderId &&
        envelope.privacyClass === (envelope.payload.visibility === 'PRIVATE' ? 'RESTRICTED' : 'CONFIDENTIAL');
    if (!checks.profile) {
        errors.push(...profileVerification.errors, 'A trusted REVIEWED Builder Profile envelope is required.');
        return reject(checks, profileVerification, errors);
    }
    const candidateEnvelopeId = envelope.payload.quorum.candidateEnvelopeId;
    if (!candidateEnvelopeId) {
        errors.push('Reviewed profile does not identify its candidate envelope.');
        return reject(checks, profileVerification, errors);
    }
    let candidateUnknown;
    try {
        candidateUnknown = await options.envelopeResolver.resolve(candidateEnvelopeId);
    }
    catch (error) {
        errors.push(`Candidate resolution failed: ${error instanceof Error ? error.message : 'unknown error'}.`);
        return reject(checks, profileVerification, errors);
    }
    if (!candidateUnknown) {
        errors.push('Candidate envelope could not be resolved.');
        return reject(checks, profileVerification, errors);
    }
    const candidate = candidateUnknown;
    const candidateVerification = await verifyEnvelopeWithTrust(candidate, options.profilePolicy, options.dependencies, now);
    checks.candidate = candidateVerification.valid &&
        candidate.id === candidateEnvelopeId &&
        candidate.kind === 'PROFILE' &&
        candidate.payload.status === 'CANDIDATE' &&
        candidate.subject === envelope.subject &&
        candidate.subject === candidate.payload.builderId &&
        candidate.privacyClass === (candidate.payload.visibility === 'PRIVATE' ? 'RESTRICTED' : 'CONFIDENTIAL') &&
        candidate.payload.profileId === envelope.payload.profileId &&
        candidate.payload.revision === envelope.payload.revision &&
        Date.parse(candidate.issuedAt) <= Date.parse(envelope.issuedAt);
    if (!checks.candidate) {
        errors.push(...candidateVerification.errors, 'Candidate envelope does not match the reviewed profile identity.');
        return reject(checks, profileVerification, errors, [], candidateVerification);
    }
    const expectedDigest = computeBuilderProfileContentDigest(envelope.payload);
    checks.contentBinding = computeBuilderProfileContentDigest(candidate.payload) === expectedDigest;
    const declaredReceiptIds = envelope.payload.quorum.reviews.map((review) => review.receiptId);
    checks.dependencyGraph = envelope.parents?.includes(candidateEnvelopeId) === true &&
        declaredReceiptIds.length === (envelope.dependencies?.length ?? 0) &&
        declaredReceiptIds.every((receiptId) => envelope.dependencies?.includes(receiptId));
    if (!checks.contentBinding)
        errors.push('Candidate and reviewed profile content digests do not match.');
    if (!checks.dependencyGraph)
        errors.push('Profile parents or review dependencies do not match its quorum declarations.');
    const reviewVerifications = [];
    for (const declared of envelope.payload.quorum.reviews) {
        const reviewErrors = [];
        let receiptUnknown;
        try {
            receiptUnknown = await options.envelopeResolver.resolve(declared.receiptId);
        }
        catch (error) {
            reviewErrors.push(`Review resolution failed: ${error instanceof Error ? error.message : 'unknown error'}.`);
        }
        if (!receiptUnknown) {
            reviewErrors.push('Review receipt could not be resolved.');
            reviewVerifications.push({ ...declared, valid: false, errors: reviewErrors });
            continue;
        }
        const receipt = receiptUnknown;
        const verification = await verifyEnvelopeWithTrust(receipt, options.reviewPolicy, options.dependencies, now);
        const valid = verification.valid &&
            receipt.id === declared.receiptId &&
            receipt.kind === 'RECEIPT' &&
            receipt.schema === BUILDER_PROFILE_REVIEW_SCHEMA &&
            receipt.subject === candidateEnvelopeId &&
            receipt.parents?.includes(candidateEnvelopeId) === true &&
            receipt.issuer.id === declared.reviewerId &&
            receipt.payload.reviewerId === declared.reviewerId &&
            receipt.payload.candidateEnvelopeId === candidateEnvelopeId &&
            receipt.payload.profileId === envelope.payload.profileId &&
            receipt.payload.profileRevision === envelope.payload.revision &&
            receipt.payload.profileContentDigest === expectedDigest &&
            receipt.payload.verdict === 'APPROVE' &&
            receipt.privacyClass === 'CONFIDENTIAL' &&
            Date.parse(candidate.issuedAt) <= Date.parse(receipt.payload.reviewedAt) &&
            Date.parse(receipt.issuedAt) <= Date.parse(envelope.issuedAt) &&
            Date.parse(receipt.payload.reviewedAt) <= Date.parse(envelope.payload.quorum.reviewedAt);
        if (!valid)
            reviewErrors.push(...verification.errors, 'Review receipt is not bound to this profile quorum.');
        reviewVerifications.push({ ...declared, verification, valid, errors: reviewErrors });
    }
    checks.reviews = reviewVerifications.length === envelope.payload.quorum.reviews.length &&
        reviewVerifications.every((review) => review.valid);
    checks.reviewerIndependence = new Set(reviewVerifications.filter((review) => review.valid).map((review) => review.reviewerId)).size === reviewVerifications.filter((review) => review.valid).length;
    checks.threshold = reviewVerifications.filter((review) => review.valid).length >=
        envelope.payload.quorum.requiredReviewers;
    for (const review of reviewVerifications)
        errors.push(...review.errors);
    if (!checks.reviews)
        errors.push('One or more declared review receipts failed verification.');
    if (!checks.reviewerIndependence)
        errors.push('Verified review receipts do not represent independent reviewer identities.');
    if (!checks.threshold)
        errors.push('Verified review receipts do not satisfy the configured quorum threshold.');
    const valid = Object.values(checks).every(Boolean);
    const dispositions = [
        profileVerification.disposition,
        candidateVerification.disposition,
        ...reviewVerifications.map((review) => review.verification?.disposition),
    ];
    return {
        valid,
        disposition: valid
            ? (dispositions.every((disposition) => disposition === 'DUPLICATE') ? 'DUPLICATE' : 'ACCEPT')
            : 'REJECT',
        checks,
        profileVerification,
        candidateVerification,
        reviewVerifications,
        errors,
    };
}
