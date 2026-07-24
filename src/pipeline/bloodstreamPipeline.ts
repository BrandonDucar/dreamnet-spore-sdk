import { StandardObservation, computeCanonicalHash } from '../contracts/index.js';
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
   * Pipeline Flow: Ingestion -> Schema Validation -> Hash Recomputation -> Deduplication -> Isolated Classification -> Transport -> Commit State
   */
  async process(rawObs: StandardObservation): Promise<{ success: boolean; isDuplicate: boolean; tags: string[]; error?: string }> {
    // 1. Validation
    if (!rawObs.schemaVersion || !rawObs.provenance || !rawObs.evidence) {
      console.warn('❌ [Bloodstream Validation Failed] Invalid observation schema.');
      return { success: false, isDuplicate: false, tags: [], error: 'Invalid schema' };
    }

    // 2. Hash Recomputation & Tamper Detection
    const recomputedHash = computeCanonicalHash(rawObs.evidence);
    if (recomputedHash !== rawObs.hashes.canonicalPayloadHash) {
      console.warn(`❌ [Bloodstream Tamper Rejection] Hash mismatch: Claimed "${rawObs.hashes.canonicalPayloadHash.substring(0, 12)}", Actual "${recomputedHash.substring(0, 12)}"`);
      return { success: false, isDuplicate: false, tags: [], error: 'Canonical hash mismatch' };
    }

    // 3. Deduplication Check
    if (this.processedHashes.has(recomputedHash)) {
      console.log(`ℹ️ [Bloodstream Deduplication] Skipping duplicate observation hash: ${recomputedHash.substring(0, 12)}...`);
      return { success: true, isDuplicate: true, tags: ['DUPLICATE'] };
    }

    // 4. Isolated Downstream Classification & Enrichment
    const tags: string[] = [];
    for (const classifier of this.classifiers) {
      try {
        const res = await classifier.classify(rawObs);
        if (res.isMatch) {
          tags.push(...res.tags);
        }
      } catch (err: any) {
        console.error(`⚠️ [Classifier Fault Isolation] Classifier "${classifier.classifierId}" failed:`, err.message);
      }
    }

    // 5. Transport Distribution
    const enrichedObs: StandardObservation = {
      ...rawObs,
      metadata: {
        ...rawObs.metadata,
        classificationTags: tags,
        processedIso: new Date().toISOString()
      }
    };

    try {
      await this.transport.publish(enrichedObs);
      // 6. Commit processed state ONLY after successful publication
      this.processedHashes.add(recomputedHash);
      return { success: true, isDuplicate: false, tags };
    } catch (err: any) {
      console.error('❌ [Bloodstream Transport Error]:', err.message);
      return { success: false, isDuplicate: false, tags, error: err.message };
    }
  }
}
