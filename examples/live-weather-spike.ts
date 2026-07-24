import { VacuumSpike, VacuumSpikeManifest } from '../src/observation/vacuumSpike.js';
import { StandardObservation } from '../src/observation/observationContract.js';

export class LiveWeatherSpike extends VacuumSpike {
  manifest: VacuumSpikeManifest = {
    id: 'live-weather-spike',
    version: '1.0.0',
    sourceType: 'poll',
    domains: ['api.open-meteo.com'],
    securityPolicy: {
      allowedDomains: ['api.open-meteo.com'],
      maxResponseSizeBytes: 5242880,
      timeoutMs: 5000,
      allowPrivateIps: false
    },
    dataLicense: 'CC-BY 4.0 Open-Meteo Data',
    attributionRequired: true,
    retentionPolicy: 'Real-time telemetry',
    rateLimit: { requestsPerMinute: 30, burstAllowance: 5 },
    requiredSecrets: [],
    outputSchemas: ['observation.v1'],
    healthEndpoint: 'https://api.open-meteo.com/v1/forecast?latitude=26.7153&longitude=-80.0533&current_weather=true'
  };

  async observe(city: string = 'Palm Beach'): Promise<StandardObservation> {
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=26.7153&longitude=-80.0533&current_weather=true';

    // 1. SSRF & Host Allowlist Guard Check
    const validation = this.validateTargetUrl(url);
    if (!validation.valid) {
      return this.createObservation({
        city,
        error: validation.reason,
        isBlocked: true
      }, 0.0, { health: 'DEGRADED' });
    }

    try {
      const response = await fetch(url);
      const data = await response.json() as any;
      const current = data.current_weather;

      return this.createObservation({
        city,
        latitude: data.latitude,
        longitude: data.longitude,
        temperatureCelsius: current.temperature,
        windSpeedKmh: current.windspeed,
        weatherCode: current.weathercode,
        isLivePayload: true
      }, 0.99, { sourceEndpoint: url });
    } catch (err: any) {
      return this.createObservation({
        city,
        error: err.message,
        isFallback: true
      }, 0.50, { health: 'DEGRADED' });
    }
  }
}
