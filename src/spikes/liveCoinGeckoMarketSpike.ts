import { VacuumSpike, VacuumSpikeManifest } from '../observation/vacuumSpike.js';
import type { StandardObservation } from '../contracts/index.js';

export class LiveCoinGeckoMarketSpike extends VacuumSpike {
  manifest: VacuumSpikeManifest = {
    id: 'live-coingecko-market-spike',
    version: '1.0.0',
    sourceType: 'poll',
    domains: ['api.coingecko.com'],
    securityPolicy: {
      allowedDomains: ['api.coingecko.com'],
      maxResponseSizeBytes: 5242880,
      timeoutMs: 6000,
      allowPrivateIps: false
    },
    dataLicense: 'CoinGecko Public API',
    attributionRequired: true,
    retentionPolicy: 'Real-time market feed',
    rateLimit: { requestsPerMinute: 30, burstAllowance: 5 },
    requiredSecrets: [],
    outputSchemas: ['observation.v1'],
    healthEndpoint: 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd'
  };

  async observe(assetIds: string = 'bitcoin,ethereum,solana'): Promise<StandardObservation> {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${assetIds}&vs_currencies=usd&include_24hr_change=true`;

    const validation = this.validateTargetUrl(url);
    if (!validation.valid) {
      return this.createObservation({ assetIds, error: validation.reason, isBlocked: true }, 0.0, { health: 'DEGRADED' });
    }

    try {
      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' }
      });
      if (!response.ok) {
        throw new Error(`CoinGecko API HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json() as any;

      return this.createObservation({
        assetIds,
        pricesUsd: data,
        isLivePayload: true
      }, 0.99, { metadata: { endpoint: url } });
    } catch (err: any) {
      return this.createObservation({ assetIds, error: err.message, isFallback: true }, 0.50, { health: 'DEGRADED' });
    }
  }
}
