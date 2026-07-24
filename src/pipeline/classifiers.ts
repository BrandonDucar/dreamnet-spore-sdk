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

export class VitalSignalDetector implements SignalClassifier {
  classifierId = 'classifier_vital_signal_v1';

  async classify(obs: StandardObservation): Promise<ClassifierResult> {
    const isDegraded = obs.health === 'DEGRADED';
    const score = obs.confidence.score;
    return {
      isMatch: isDegraded || score < 0.70,
      score: isDegraded ? 0.95 : 0.20,
      tags: isDegraded ? ['DEGRADED_HEALTH', 'ATTENTION_REQUIRED'] : ['NORMAL'],
      reason: isDegraded ? 'Observation emitted degraded health state' : 'Normal vital telemetry'
    };
  }
}

export class OpportunityScreener implements SignalClassifier {
  classifierId = 'classifier_opportunity_screener_v1';

  async classify(obs: StandardObservation): Promise<ClassifierResult> {
    const hasValue = Boolean(obs.evidence.estimatedEquity || obs.evidence.highValueTarget);
    return {
      isMatch: hasValue,
      score: hasValue ? 0.90 : 0.10,
      tags: hasValue ? ['OPPORTUNITY_FLAGGED'] : ['ROUTINE'],
      reason: hasValue ? 'High-value data payload detected in evidence' : 'Routine sensory telemetry'
    };
  }
}
