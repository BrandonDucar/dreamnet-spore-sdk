import { StandardObservation } from '../contracts/index.js';
import { ObservationTransport } from '../transport/transportInterfaces.js';
import { SignalClassifier } from './classifiers.js';
export declare class BloodstreamPipeline {
    private transport;
    private classifiers;
    private processedHashes;
    constructor(transport: ObservationTransport);
    registerClassifier(classifier: SignalClassifier): void;
    /**
     * Pipeline Flow: Ingestion -> Schema Validation -> Hash Recomputation -> Deduplication -> Isolated Classification -> Transport -> Commit State
     */
    process(rawObs: StandardObservation): Promise<{
        success: boolean;
        isDuplicate: boolean;
        tags: string[];
        error?: string;
    }>;
}
