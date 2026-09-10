/**
 * 1. StandardObservation (Sensory Perception Envelope)
 */
export interface StandardObservation {
    schemaVersion: 'observation.v1';
    timestamp: string;
    provenance: string;
    confidence: {
        score: number;
        method: 'HEURISTIC' | 'MODEL_INFERENCE' | 'PROVENANCE_ASSURED';
        assessor: string;
    };
    source: {
        domain: string;
        endpoint?: string;
        sourceType: 'poll' | 'stream' | 'webhook';
    };
    evidence: Record<string, any>;
    hashes: {
        canonicalPayloadHash: string;
        hashAlgorithm: 'sha256:dreamnet-sorted-json:v0';
    };
    metadata: Record<string, any>;
    health: 'HEALTHY' | 'DEGRADED';
}
/**
 * 2. PortableAssignment (Task Dispatch)
 */
export interface PortableAssignment {
    schemaVersion: 'assignment.v1';
    assignmentId: string;
    assignee: string;
    assigner: string;
    taskType: string;
    payload: Record<string, any>;
    deadlineIso?: string;
    createdIso: string;
    contentHash: string;
}
/**
 * 3. CapabilityManifest (Agent / Spike Capabilities)
 */
export interface CapabilityManifest {
    schemaVersion: 'capability-manifest.v1';
    id: string;
    version: string;
    capabilities: string[];
    supportedInputSchemas: string[];
    supportedOutputSchemas: string[];
    maxConcurrency: number;
}
/**
 * 4. WorkResult (Execution Output)
 */
export interface WorkResult {
    schemaVersion: 'work-result.v1';
    assignmentId: string;
    workerId: string;
    status: 'COMPLETED' | 'FAILED' | 'REJECTED';
    output: Record<string, any>;
    executionTimeMs: number;
    completedIso: string;
}
/**
 * 5. ProofArtifact (Evidence / Verified Outcome Target for Proof Drops)
 */
export interface ProofArtifact {
    schemaVersion: 'proof-artifact.v1';
    artifactId: string;
    creatorId: string;
    artifactType: string;
    evidenceData: Record<string, any>;
    contentHash: string;
    signature?: string;
    createdIso: string;
}
/**
 * 6. PortableReceipt (Immutable Receipt Envelope)
 */
export interface PortableReceipt {
    schemaVersion: 'receipt.v1';
    receiptId: string;
    issuerId: string;
    subjectHash: string;
    proofArtifactId?: string;
    timestamp: string;
    digest: string;
}
/**
 * Detailed Verification Check Descriptor
 */
export interface VerificationCheck {
    type: 'CONTENT_INTEGRITY' | 'SIGNATURE' | 'IDENTITY' | 'AUTHORIZATION' | 'FRESHNESS';
    status: 'VALID' | 'INVALID' | 'NOT_CHECKED';
    reason: string;
}
/**
 * 7. VerificationResult (Verification Output)
 */
export interface VerificationResult {
    schemaVersion: 'verification.v1';
    isValid: boolean;
    subjectHash: string;
    verifiedAt: string;
    checks: VerificationCheck[];
}
/**
 * 8. PortableClaim (Attestation Claim)
 */
export interface PortableClaim {
    schemaVersion: 'claim.v1';
    claimId: string;
    claimant: string;
    statement: string;
    supportingReceiptIds: string[];
    createdIso: string;
}
/**
 * 9. ExecutionCapsule (Portable Execution Boundary of a Graph Node)
 */
export interface OutputContract {
    outputName: string;
    schemaVersion: string;
}
export interface QuorumPolicy {
    minimumConfirmations: number;
    requireFreshContext: boolean;
    requireIndependentReproduction: boolean;
    maximumSharedEvidenceLineage: number;
    requireDifferentModelFamiliesForCriticalClaims: boolean;
}
export interface ExecutionCapsule {
    schemaVersion: 'execution-capsule.v1';
    capsuleId: string;
    graphId: string;
    nodeId: string;
    goal: Record<string, any>;
    assignment: PortableAssignment;
    requiredInputs: Array<{
        artifactId: string;
        contentHash: string;
    }>;
    permittedTools: string[];
    immutableRules: string[];
    workspaceLease?: {
        leaseId: string;
        path: string;
        expiresIso: string;
    };
    contextBudget: {
        maxTokens: number;
        contextWindowLimit: number;
    };
    costBudget: {
        maxSpendUsd: number;
    };
    quorumPolicy: QuorumPolicy;
    parentCapsules: string[];
    priorReceipts: string[];
    expectedOutputs: OutputContract[];
}
/**
 * 10. VerificationReceipt (Heterogeneous Verification Receipt with Context Lineage)
 */
export interface VerificationReceipt {
    schemaVersion: 'verification-receipt.v1';
    receiptId: string;
    verifierId: string;
    claimId: string;
    contextHash: string;
    evidenceHashes: string[];
    promptTemplateHash: string;
    modelFamily: string;
    toolchainHash: string;
    inheritedFromExecutor: boolean;
    reproductionPerformed: boolean;
    verdict: 'CONFIRMED' | 'REJECTED' | 'INDETERMINATE';
    confidence: number;
    timestamp: string;
    digest: string;
}
/**
 * Deterministic JSON Serialization (DreamNet Sorted JSON v0)
 */
export declare function canonicalJsonStringify(obj: any): string;
/**
 * Canonical SHA-256 Hashing Utility (DreamNet Sorted JSON v0)
 */
export declare function computeCanonicalHash(data: Record<string, any>): string;
