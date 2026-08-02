import { type KeyLike } from 'node:crypto';
import { type SporeEnvelope, type SporeIssuer } from './envelope.js';
import type { ContentReference } from './proofDrop.js';
export declare const BUILDER_PROFILE_REVIEW_SCHEMA: "https://schemas.dreamnet.ink/spore/builder-profile-review.v1.json";
export interface BuilderProfileReviewPayload {
    schemaVersion: 'builder-profile-review.v1';
    candidateEnvelopeId: string;
    profileId: string;
    profileRevision: number;
    profileContentDigest: `sha256:${string}`;
    reviewerId: string;
    verdict: 'APPROVE' | 'REJECT';
    evidence: ContentReference[];
    reviewedAt: string;
}
export interface CreateBuilderProfileReviewOptions {
    issuer: SporeIssuer;
    audience: string[];
    issuedAt: string;
    expiresAt: string;
    nonce: string;
    payload: BuilderProfileReviewPayload;
    policyRef: string;
}
export declare function assertBuilderProfileReviewPayload(payload: BuilderProfileReviewPayload): void;
export declare function createBuilderProfileReviewReceipt(options: CreateBuilderProfileReviewOptions, privateKey: KeyLike): SporeEnvelope<BuilderProfileReviewPayload>;
