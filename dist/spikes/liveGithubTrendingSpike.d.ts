import { VacuumSpike, VacuumSpikeManifest } from '../observation/vacuumSpike.js';
import { StandardObservation } from '../observation/observationContract.js';
export declare class LiveGithubTrendingSpike extends VacuumSpike {
    manifest: VacuumSpikeManifest;
    observe(query?: string): Promise<StandardObservation>;
}
