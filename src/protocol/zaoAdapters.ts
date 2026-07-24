import { StandardObservation } from '../observation/observationContract.js';

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
    return {
      timestamp: new Date().toISOString(),
      provenance: `ZAO:ZOEWorker:${proof.workerId}`,
      confidence: 1.0,
      source: 'ZAO Engine',
      evidence: proof.payload,
      hashes: { payloadHash: proof.proofId },
      metadata: { originalSignature: proof.signature || 'unsigned' },
      health: 'HEALTHY'
    };
  }

  /**
   * Converts a StandardObservation back into a portable ProofDrop for ZAO workers
   */
  static toProofDrop(obs: StandardObservation, workerId = 'zoe_worker_01'): ProofDrop {
    return {
      proofId: obs.hashes.payloadHash,
      workerId,
      payload: obs.evidence,
      signature: `sig_${obs.provenance}`
    };
  }
}
