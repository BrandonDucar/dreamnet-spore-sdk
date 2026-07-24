import { VacuumSpike, VacuumSpikeManifest } from '../observation/vacuumSpike.js';
import { StandardObservation } from '../observation/observationContract.js';
export declare class LiveCoinGeckoMarketSpike extends VacuumSpike {
    manifest: VacuumSpikeManifest;
    observe(assetIds?: string): Promise<StandardObservation>;
}
