/**
 * Spore Federation Protocol V1 Conformance Verification Suite
 *
 * Verifies that a Spore implementation satisfies every byte-level contract
 * required for sovereign inter-civilization interoperability.
 */
export declare function runSporeConformanceSuite(): Promise<{
    passed: boolean;
    stagesCompleted: number;
    goldenVectorHash: string;
}>;
