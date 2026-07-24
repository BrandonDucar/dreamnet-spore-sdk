import { VacuumSpike, VacuumSpikeManifest } from '../observation/vacuumSpike.js';
import type { StandardObservation } from '../contracts/index.js';
export declare class LiveCoinGeckoMarketSpike extends VacuumSpike {
    manifest: VacuumSpikeManifest;
    observe(assetIds?: string): Promise<StandardObservation>;
}
