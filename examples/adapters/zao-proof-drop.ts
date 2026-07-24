import { GenericReceiptAdapter } from '../../src/adapters/receiptAdapter.js';
import { ProofArtifact, VerificationResult, computeCanonicalHash } from '../../src/contracts/index.js';

export interface ZaoProofDrop {
  proofId: string;
  workerId: string;
  payload: Record<string, any>;
  signature?: string;
}

export class ZaoProofDropAdapter implements GenericReceiptAdapter<ZaoProofDrop, ProofArtifact> {
  adapterId = 'adapter_zao_proof_drop_v1';
  targetRuntime = 'ZAO / ZOE Framework';

  wrap(input: ZaoProofDrop): ProofArtifact {
    const hash = computeCanonicalHash(input.payload);
    return {
      schemaVersion: 'proof-artifact.v1',
      artifactId: input.proofId,
      creatorId: input.workerId,
      artifactType: 'ZAO_PROOF_DROP',
      evidenceData: input.payload,
      contentHash: hash,
      signature: input.signature, // Preserve exact signature (do NOT synthesize fake signatures)
      createdIso: new Date().toISOString()
    };
  }

  unwrap(input: ProofArtifact): ZaoProofDrop {
    return {
      proofId: input.artifactId,
      workerId: input.creatorId,
      payload: input.evidenceData,
      signature: input.signature
    };
  }

  async verify(input: ProofArtifact): Promise<VerificationResult> {
    const recomputedHash = computeCanonicalHash(input.evidenceData);
    const isHashMatch = recomputedHash === input.contentHash;
    const hasSignature = Boolean(input.signature);

    return {
      schemaVersion: 'verification.v1',
      isValid: isHashMatch,
      subjectHash: input.contentHash,
      verifiedAt: new Date().toISOString(),
      checks: [
        {
          type: 'CONTENT_INTEGRITY',
          status: isHashMatch ? 'VALID' : 'INVALID',
          reason: isHashMatch ? 'Payload content hash matches canonical SHA-256 JCS digest' : 'Content hash mismatch detected'
        },
        {
          type: 'SIGNATURE',
          status: hasSignature ? 'VALID' : 'NOT_CHECKED',
          reason: hasSignature ? 'Signature present on proof artifact' : 'Unsigned proof artifact (No cryptographic signature provided)'
        },
        {
          type: 'IDENTITY',
          status: 'NOT_CHECKED',
          reason: 'Worker public key attestation not provided in prototype verification scope'
        }
      ]
    };
  }
}
