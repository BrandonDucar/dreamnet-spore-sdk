import { type KeyLike } from 'node:crypto';
import { type SporeEnvelope, type SporeIssuer } from './envelope.js';
export interface ContentReference {
    digest: `sha256:${string}`;
    mediaType: string;
    sizeBytes?: number;
    uri?: string;
}
export interface ProofDropPayload {
    schemaVersion: 'proof-drop.v1';
    executionTrace: ContentReference;
    evidence: ContentReference[];
    outputs: ContentReference[];
    provenance: {
        originNode: string;
        runtime: string;
        environment: string;
        gitCommitSha?: string;
        model?: string;
    };
    verificationPolicy?: string;
}
export interface CreateProofDropOptions {
    issuer: SporeIssuer;
    subject: string;
    audience: string[];
    issuedAt: string;
    nonce: string;
    payload: ProofDropPayload;
    parents?: string[];
    policyRef?: string;
}
export declare function assertProofDropPayload(payload: ProofDropPayload): void;
export declare function createProofDrop(options: CreateProofDropOptions, privateKey: KeyLike): SporeEnvelope<ProofDropPayload>;
