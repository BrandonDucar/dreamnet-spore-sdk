import { computeCanonicalHash } from '../contracts/index.js';
export class ReceiptAdapter {
    /**
     * Wraps a ZAO/ZOE ProofDrop into a portable StandardObservation
     */
    static wrapProofDrop(proof) {
        const hash = computeCanonicalHash(proof.payload);
        return {
            schemaVersion: 'observation.v1',
            timestamp: new Date().toISOString(),
            provenance: `ZAO:ZOEWorker:${proof.workerId}`,
            confidence: {
                score: 0.5,
                method: 'HEURISTIC',
                assessor: `ZAO:ZOEWorker:${proof.workerId}`
            },
            source: {
                domain: 'zao.engine',
                sourceType: 'stream'
            },
            evidence: proof.payload,
            hashes: {
                canonicalPayloadHash: hash,
                hashAlgorithm: 'sha256:rfc8785'
            },
            metadata: { originalSignature: proof.signature || 'unsigned' },
            health: 'HEALTHY'
        };
    }
    /**
     * Converts a StandardObservation back into a portable ProofDrop for ZAO workers
     */
    static toProofDrop(obs, workerId = 'zoe_worker_01') {
        return {
            proofId: obs.hashes.canonicalPayloadHash,
            workerId,
            payload: obs.evidence,
            signature: obs.metadata.originalSignature !== 'unsigned' ? obs.metadata.originalSignature : undefined
        };
    }
}
