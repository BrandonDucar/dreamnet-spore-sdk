import { StandardObservation } from '../contracts/index.js';
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
export declare class ReceiptAdapter {
    /**
     * Wraps a ZAO/ZOE ProofDrop into a portable StandardObservation
     */
    static wrapProofDrop(proof: ProofDrop): StandardObservation;
    /**
     * Converts a StandardObservation back into a portable ProofDrop for ZAO workers
     */
    static toProofDrop(obs: StandardObservation, workerId?: string): ProofDrop;
}
