import type { StandardObservation } from '../contracts/index.js';
export interface ClassifierResult {
    isMatch: boolean;
    score: number;
    tags: string[];
    reason: string;
}
export interface SignalClassifier {
    classifierId: string;
    classify(obs: StandardObservation): Promise<ClassifierResult>;
}
export declare class VitalSignalDetector implements SignalClassifier {
    classifierId: string;
    classify(obs: StandardObservation): Promise<ClassifierResult>;
}
export declare class OpportunityScreener implements SignalClassifier {
    classifierId: string;
    classify(obs: StandardObservation): Promise<ClassifierResult>;
}
