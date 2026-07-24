import { StandardObservation } from '../observation/observationContract.js';
import { ObservationTransport } from '../transport/transportInterfaces.js';
import { SignalClassifier } from './classifiers.js';

export class BloodstreamPipeline {
  private transport: ObservationTransport;
  private classifiers: SignalClassifier[] = [];
  private processedHashes: Set<string> = new Set();

  constructor(transport: ObservationTransport) {
    this.transport = transport;
  }

  public registerClassifier(classifier: SignalClassifier): void {
    this.classifiers.push(classifier);
  }

  /**
   * Pipeline Flow: Ingestion -> Validation -> Normalization -> Deduplication -> Enrichment -> Transport
   */
  async process(rawObs: StandardObservation): Promise<{ success: boolean; isDuplicate: boolean; tags: string[] }> {
    // 1. Validation
    if (!rawObs.schemaVersion || !rawObs.provenance || !rawObs.evidence) {
      console.warn('❌ [Bloodstream Validation Failed] Invalid observation schema.');
      return { success: false, isDuplicate: false, tags: [] };
    }

    // 2. Deduplication (RFC 8785 Canonical Payload Hash)
    const hash = rawObs.hashes.canonicalPayloadHash;
    if (this.processedHashes.has(hash)) {
      console.log(`ℹ️ [Bloodstream Deduplication] Skipping duplicate observation hash: ${hash.substring(0, 12)}...`);
      return { success: true, isDuplicate: true, tags: ['DUPLICATE'] };
    }

    this.processedHashes.add(hash);

    // 3. Downstream Classification & Enrichment
    const tags: string[] = [];
    for (const classifier of this.classifiers) {
      const res = await classifier.classify(rawObs);
      if (res.isMatch) {
        tags.push(...res.tags);
      }
    }

    // 4. Transport Distribution
    const enrichedObs: StandardObservation = {
      ...rawObs,
      metadata: {
        ...rawObs.metadata,
        classificationTags: tags,
        processedIso: new Date().toISOString()
      }
    };

    await this.transport.publish(enrichedObs);
    return { success: true, isDuplicate: false, tags };
  }
}
