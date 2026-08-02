import { type KeyLike } from 'node:crypto';
import { type SporeEnvelope, type SporeIssuer } from './envelope.js';
import type { ContentReference } from './proofDrop.js';
export declare const BUILDER_PROFILE_SCHEMA: "https://schemas.dreamnet.ink/spore/builder-profile.v1.json";
export interface BuilderDecisionPrinciple {
    id: string;
    statement: string;
    appliesWhen: string[];
    exceptions: string[];
    confidence: number;
    evidence: ContentReference[];
}
export interface BuilderProfileReview {
    reviewerId: string;
    receiptId: string;
    verdict: 'APPROVE';
}
export interface BuilderProfilePayload {
    schemaVersion: 'builder-profile.v1';
    profileId: string;
    builderId: string;
    builderHandle?: string;
    revision: number;
    supersedes?: string;
    status: 'CANDIDATE' | 'REVIEWED';
    visibility: 'PRIVATE' | 'FEDERATED';
    preferences: {
        riskPosture: 'CONSERVATIVE' | 'VERIFIED_PRAGMATIC' | 'HIGH_VELOCITY';
        velocityBias: number;
        criticismStyle: 'STRICT_AUDIT' | 'BALANCED' | 'DIRECT_EXPLICIT';
        definitionOfDone: string[];
        nonNegotiables: string[];
    };
    principles: BuilderDecisionPrinciple[];
    quorum: {
        requiredReviewers: number;
        reviews: BuilderProfileReview[];
        reviewedAt?: string;
    };
    authority: {
        advisoryOnly: true;
        grantsCapabilities: false;
        overridesPolicy: false;
        authorizesExecution: false;
    };
}
export interface CreateBuilderProfileOptions {
    issuer: SporeIssuer;
    subject: string;
    audience: string[];
    issuedAt: string;
    expiresAt: string;
    nonce: string;
    payload: BuilderProfilePayload;
    parents?: string[];
    policyRef: string;
}
export declare function assertBuilderProfilePayload(payload: BuilderProfilePayload): void;
export declare function createBuilderProfileEnvelope(options: CreateBuilderProfileOptions, privateKey: KeyLike): SporeEnvelope<BuilderProfilePayload>;
