import { VacuumSpike, VacuumSpikeManifest } from '../observation/vacuumSpike.js';
import type { StandardObservation } from '../contracts/index.js';
export declare class LiveGithubTrendingSpike extends VacuumSpike {
    manifest: VacuumSpikeManifest;
    observe(query?: string): Promise<StandardObservation>;
}
