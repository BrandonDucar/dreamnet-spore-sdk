import crypto from 'crypto';

/**
 * 1. StandardObservation (Sensory Perception Envelope)
 */
export interface StandardObservation {
  schemaVersion: 'observation.v1';
  timestamp: string;
  provenance: string;
  confidence: {
    score: number; // 0.0 to 1.0
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
    hashAlgorithm: 'sha256:jcs-rfc8785:v1';
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
 * 7. VerificationResult (Verification Output)
 */
export interface VerificationResult {
  schemaVersion: 'verification.v1';
  isValid: boolean;
  subjectHash: string;
  verifiedAt: string;
  reasons: string[];
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
 * RFC 8785 Canonical JSON Serialization (JCS)
 * Recursively sorts keys and serializes deterministic JSON string.
 */
export function canonicalJsonStringify(obj: any): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalJsonStringify).join(',') + ']';
  }
  const sortedKeys = Object.keys(obj).sort();
  const keyValues = sortedKeys
    .filter(k => obj[k] !== undefined)
    .map(k => `${JSON.stringify(k)}:${canonicalJsonStringify(obj[k])}`);
  return '{' + keyValues.join(',') + '}';
}

/**
 * Canonical SHA-256 Hashing Utility (RFC 8785 / JCS Compliant)
 */
export function computeCanonicalHash(data: Record<string, any>): string {
  const canonicalJson = canonicalJsonStringify(data);
  return crypto.createHash('sha256').update(canonicalJson, 'utf8').digest('hex');
}
