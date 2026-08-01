import type { KeyLike } from 'node:crypto';
import { type SporeEnvelope, type SporeIssuer } from './envelope.js';
import type { ContentReference } from './proofDrop.js';
export declare const FEDERATION_CANARY_SCHEMA: "https://schemas.dreamnet.ink/spore/federation-canary.v1.json";
export declare const FEDERATION_CANARY_STAGES: readonly ["TRAPPER_ACCEPTED", "ASSIGNMENT_COMPLETED", "PROOF_DROP_VERIFIED", "CLAIM_PROMOTED", "PAPER_THESIS_ADMITTED", "UNIVERSITY_EVIDENCE_RECORDED"];
export type FederationCanaryStage = (typeof FEDERATION_CANARY_STAGES)[number];
export type CanaryReceiptColor = 'GREEN' | 'YELLOW' | 'RED';
export interface FederationCanaryAuthority {
    walletAccess: false;
    realTrading: false;
    publicPosting: false;
    productionDeploy: false;
    rawBusAccess: false;
    secretAccess: false;
}
export interface FederationCanaryArtifacts {
    trapper: ContentReference;
    assignment?: ContentReference;
    terminalReceipt?: ContentReference;
    proofDrop?: ContentReference;
    claim?: ContentReference;
    independentVerification?: ContentReference;
    paperThesis?: ContentReference;
    universityEvidence?: ContentReference;
}
export interface FederationCanaryPayload {
    schemaVersion: 'federation-canary.v1';
    canaryId: string;
    agent: {
        organismId: string;
        agentId: string;
    };
    stage: FederationCanaryStage;
    mode: 'PAPER_ONLY';
    artifacts: FederationCanaryArtifacts;
    control: {
        receiptColor: CanaryReceiptColor;
        humanApprovalRequired: boolean;
        halted: boolean;
        reason?: string;
    };
    authority: FederationCanaryAuthority;
    priorEnvelopeId?: string;
}
export interface CreateFederationCanaryOptions {
    issuer: SporeIssuer;
    audience: string[];
    issuedAt: string;
    expiresAt: string;
    nonce: string;
    payload: FederationCanaryPayload;
    policyRef?: string;
}
export interface CanaryTransitionDecision {
    disposition: 'ADVANCE' | 'IDEMPOTENT' | 'HALT' | 'REJECT';
    errors: string[];
}
export declare function assertFederationCanaryPayload(payload: FederationCanaryPayload): void;
export declare function evaluateFederationCanaryTransition(previous: FederationCanaryPayload, next: FederationCanaryPayload, previousEnvelopeId: string): CanaryTransitionDecision;
export declare function createFederationCanaryEnvelope(options: CreateFederationCanaryOptions, privateKey: KeyLike): SporeEnvelope<FederationCanaryPayload>;
