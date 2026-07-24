import { createObservationPayload } from './observationContract.js';
export class VacuumSpike {
    /**
     * SSRF Protection: Validates target URL against manifest domain allowlists & private IP blocks
     */
    validateTargetUrl(urlStr) {
        try {
            const parsed = new URL(urlStr);
            const isAllowed = this.manifest.domains.some(d => parsed.hostname === d || parsed.hostname.endsWith(`.${d}`));
            if (!isAllowed) {
                return { valid: false, reason: `Host "${parsed.hostname}" is not in manifest domain allowlist` };
            }
            const host = parsed.hostname;
            const isPrivateIp = host === 'localhost' ||
                host === '127.0.0.1' ||
                host === '::1' ||
                host.startsWith('10.') ||
                host.startsWith('192.168.') ||
                host.startsWith('169.254.') ||
                /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host);
            const allowPrivate = this.manifest.securityPolicy?.allowPrivateIps ?? false;
            if (isPrivateIp && !allowPrivate) {
                return { valid: false, reason: `SSRF Violation: Target host "${host}" is a private IP address.` };
            }
            return { valid: true };
        }
        catch (err) {
            return { valid: false, reason: `Invalid URL format: ${err.message}` };
        }
    }
    createObservation(evidence, confidenceScore = 0.95, options = {}) {
        return createObservationPayload({
            provenance: `VacuumSpike:${this.manifest.id}`,
            sourceDomain: this.manifest.domains[0] || 'Unknown Domain',
            sourceType: this.manifest.sourceType,
            evidence,
            confidenceScore,
            metadata: options.metadata || {},
            health: options.health || 'HEALTHY'
        });
    }
}
