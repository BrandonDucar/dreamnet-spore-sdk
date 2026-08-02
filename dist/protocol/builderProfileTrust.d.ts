import { type BuilderProfilePayload } from './builderProfile.js';
import type { SporeEnvelope } from './envelope.js';
import { type TrustDependencies, type TrustPolicy, type TrustVerification } from './trust.js';
export interface SporeEnvelopeResolver {
    resolve(envelopeId: string): Promise<SporeEnvelope<unknown> | undefined>;
}
export interface VerifyBuilderProfileQuorumOptions {
    profilePolicy: TrustPolicy;
    reviewPolicy: TrustPolicy;
    dependencies: TrustDependencies;
    envelopeResolver: SporeEnvelopeResolver;
    now?: Date;
}
export interface BuilderProfileQuorumVerification {
    valid: boolean;
    disposition: 'ACCEPT' | 'DUPLICATE' | 'REJECT';
    checks: {
        profile: boolean;
        candidate: boolean;
        contentBinding: boolean;
        dependencyGraph: boolean;
        reviews: boolean;
        reviewerIndependence: boolean;
        threshold: boolean;
    };
    profileVerification: TrustVerification;
    candidateVerification?: TrustVerification;
    reviewVerifications: Array<{
        reviewerId: string;
        receiptId: string;
        verification?: TrustVerification;
        valid: boolean;
        errors: string[];
    }>;
    errors: string[];
}
export declare class InMemorySporeEnvelopeResolver implements SporeEnvelopeResolver {
    private readonly envelopes;
    constructor(envelopes?: SporeEnvelope<unknown>[]);
    put(envelope: SporeEnvelope<unknown>): void;
    resolve(envelopeId: string): Promise<SporeEnvelope<unknown> | undefined>;
}
export declare function verifyReviewedBuilderProfile(envelope: SporeEnvelope<BuilderProfilePayload>, options: VerifyBuilderProfileQuorumOptions): Promise<BuilderProfileQuorumVerification>;
