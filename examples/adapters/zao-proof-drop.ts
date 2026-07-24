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
      signature: input.signature || `sig_${input.workerId}`,
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
    const isValid = recomputedHash === input.contentHash;

    return {
      schemaVersion: 'verification.v1',
      isValid,
      subjectHash: input.contentHash,
      verifiedAt: new Date().toISOString(),
      reasons: isValid ? ['Content hash matches evidence payload'] : ['Hash mismatch detected']
    };
  }
}
