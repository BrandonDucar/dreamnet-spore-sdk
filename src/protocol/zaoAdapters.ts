import { StandardObservation, computeCanonicalHash } from '../contracts/index.js';

export interface ProofDrop {
  proofId: string;
  workerId: string;
  payload: Record<string, any>;
  signature?: string;
}

export interface SparkCapsule {
  capsuleId: string;
  workerType: string;
  capabilities: string[];
}

export class ReceiptAdapter {
  /**
   * Wraps a ZAO/ZOE ProofDrop into a portable StandardObservation
   */
  static wrapProofDrop(proof: ProofDrop): StandardObservation {
    const hash = computeCanonicalHash(proof.payload);
    return {
      schemaVersion: 'observation.v1',
      timestamp: new Date().toISOString(),
      provenance: `ZAO:ZOEWorker:${proof.workerId}`,
      confidence: {
        score: 1.0,
        method: 'PROVENANCE_ASSURED',
        assessor: `ZAO:ZOEWorker:${proof.workerId}`
      },
      source: {
        domain: 'zao.engine',
        sourceType: 'stream'
      },
      evidence: proof.payload,
      hashes: {
        canonicalPayloadHash: hash,
        hashAlgorithm: 'sha256:dreamnet-sorted-json:v0'
      },
      metadata: { originalSignature: proof.signature || 'unsigned' },
      health: 'HEALTHY'
    };
  }

  /**
   * Converts a StandardObservation back into a portable ProofDrop for ZAO workers
   */
  static toProofDrop(obs: StandardObservation, workerId = 'zoe_worker_01'): ProofDrop {
    return {
      proofId: obs.hashes.canonicalPayloadHash,
      workerId,
      payload: obs.evidence,
      signature: obs.metadata.originalSignature !== 'unsigned' ? obs.metadata.originalSignature : undefined
    };
  }
}
