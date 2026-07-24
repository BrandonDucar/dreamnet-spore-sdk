import { VacuumSpike } from '../observation/vacuumSpike.js';
export class LiveGithubTrendingSpike extends VacuumSpike {
    manifest = {
        id: 'live-github-trending-spike',
        version: '1.0.0',
        sourceType: 'poll',
        domains: ['api.github.com'],
        securityPolicy: {
            allowedDomains: ['api.github.com'],
            maxResponseSizeBytes: 5242880,
            timeoutMs: 8000,
            allowPrivateIps: false
        },
        dataLicense: 'GitHub Public REST API',
        attributionRequired: true,
        retentionPolicy: 'Real-time developer telemetry',
        rateLimit: { requestsPerMinute: 60, burstAllowance: 10 },
        requiredSecrets: [],
        outputSchemas: ['observation.v1'],
        healthEndpoint: 'https://api.github.com/search/repositories?q=stars:>10000&sort=stars&order=desc'
    };
    async observe(query = 'topic:ai') {
        const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=5`;
        const validation = this.validateTargetUrl(url);
        if (!validation.valid) {
            return this.createObservation({ query, error: validation.reason, isBlocked: true }, 0.0, { health: 'DEGRADED' });
        }
        try {
            const response = await fetch(url, {
                headers: { 'User-Agent': 'DreamNet-Spore-SDK/1.0' }
            });
            if (!response.ok) {
                throw new Error(`GitHub API HTTP ${response.status}: ${response.statusText}`);
            }
            const data = await response.json();
            const topRepos = (data.items || []).slice(0, 5).map((item) => ({
                fullName: item.full_name,
                stars: item.stargazers_count,
                description: item.description,
                url: item.html_url
            }));
            return this.createObservation({
                query,
                totalCount: data.total_count,
                topRepositories: topRepos,
                isLivePayload: true
            }, 0.99, { metadata: { endpoint: url } });
        }
        catch (err) {
            return this.createObservation({ query, error: err.message, isFallback: true }, 0.50, { health: 'DEGRADED' });
        }
    }
}
