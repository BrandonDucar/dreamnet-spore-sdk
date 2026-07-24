import { computeCanonicalHash } from '../contracts/index.js';
export class BloodstreamPipeline {
    transport;
    classifiers = [];
    processedHashes = new Set();
    constructor(transport) {
        this.transport = transport;
    }
    registerClassifier(classifier) {
        this.classifiers.push(classifier);
    }
    /**
     * Pipeline Flow: Ingestion -> Schema Validation -> Hash Recomputation -> Deduplication -> Isolated Classification -> Transport -> Commit State
     */
    async process(rawObs) {
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
        const tags = [];
        for (const classifier of this.classifiers) {
            try {
                const res = await classifier.classify(rawObs);
                if (res.isMatch) {
                    tags.push(...res.tags);
                }
            }
            catch (err) {
                console.error(`⚠️ [Classifier Fault Isolation] Classifier "${classifier.classifierId}" failed:`, err.message);
            }
        }
        // 5. Transport Distribution
        const enrichedObs = {
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
        }
        catch (err) {
            console.error('❌ [Bloodstream Transport Error]:', err.message);
            return { success: false, isDuplicate: false, tags, error: err.message };
        }
    }
}
