import { VacuumSpike, VacuumSpikeManifest } from '../src/observation/vacuumSpike.js';
import { StandardObservation } from '../src/observation/observationContract.js';

export class MockWeatherSpike extends VacuumSpike {
  manifest: VacuumSpikeManifest = {
    id: 'mock-weather-spike',
    version: '1.0.0',
    sourceType: 'poll',
    domains: ['openweather.mock.api'],
    dataLicense: 'CC0-1.0 Public Domain (Synthetic Mock Data)',
    attributionRequired: false,
    retentionPolicy: '30-day cache',
    rateLimit: { requestsPerMinute: 60, burstAllowance: 10 },
    requiredSecrets: [],
    outputSchemas: ['observation.v1']
  };

  async observe(location: string = 'Palm Beach, FL'): Promise<StandardObservation> {
    return this.createObservation({
      location,
      temperatureFahrenheit: 78,
      condition: 'Sunny (Mock Data)',
      isSynthetic: true
    }, 0.98, { mode: 'mock' });
  }
}
