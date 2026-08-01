import type { KeyLike } from 'node:crypto';
import {
  verifyEnvelope,
  type EnvelopeVerification,
  type SporeEnvelope,
  type SporeEnvelopeKind,
} from './envelope.js';
import { assertProofDropPayload } from './proofDrop.js';
import { assertSporeLeasePayload } from './lease.js';
import { assertFederationCanaryPayload, FEDERATION_CANARY_SCHEMA } from './federationCanary.js';

export interface IssuerKeyRecord {
  issuerId: string;
  keyId: string;
  publicKey: KeyLike;
  validFrom?: string;
  validUntil?: string;
  revokedAt?: string;
}

export interface IssuerKeyResolver {
  resolve(issuerId: string, keyId: string): Promise<IssuerKeyRecord | undefined>;
}

export type ReplayClaim = 'CLAIMED' | 'DUPLICATE' | 'CONFLICT';

export interface ReplayStore {
  claim(
    scope: string,
    nonce: string,
    envelopeId: string,
    expiresAt: string,
  ): Promise<ReplayClaim>;
}

export interface RevocationResolver {
  isRevoked(envelopeId: string, at: Date): Promise<boolean>;
}

export type PayloadValidator = (payload: unknown) => void;

export class SchemaRegistry {
  private readonly validators = new Map<string, PayloadValidator>();

  register(schema: string, validator: PayloadValidator): this {
    if (!schema || this.validators.has(schema)) {
      throw new TypeError(`Schema must be non-empty and registered once: ${schema}.`);
    }
    this.validators.set(schema, validator);
    return this;
  }

  validate(schema: string, payload: unknown): { valid: boolean; errors: string[] } {
    const validator = this.validators.get(schema);
    if (!validator) return { valid: false, errors: [`Unknown payload schema: ${schema}.`] };
    try {
      validator(payload);
      return { valid: true, errors: [] };
    } catch (error) {
      return {
        valid: false,
        errors: [error instanceof Error ? error.message : `Payload failed schema ${schema}.`],
      };
    }
  }
}

export function createCoreSchemaRegistry(): SchemaRegistry {
  return new SchemaRegistry()
    .register('https://schemas.dreamnet.ink/spore/proof-drop.v1.json', (payload) => {
      assertProofDropPayload(payload as Parameters<typeof assertProofDropPayload>[0]);
    })
    .register('https://schemas.dreamnet.ink/spore/lease.v1.json', (payload) => {
      assertSporeLeasePayload(payload as Parameters<typeof assertSporeLeasePayload>[0]);
    })
    .register(FEDERATION_CANARY_SCHEMA, (payload) => {
      assertFederationCanaryPayload(payload as Parameters<typeof assertFederationCanaryPayload>[0]);
    });
}

export interface TrustPolicy {
  expectedAudience: string;
  requireExpiry: boolean;
  requireReplayProtection: boolean;
  requireRevocationCheck: boolean;
  allowedIssuers?: string[];
  allowedKinds?: SporeEnvelopeKind[];
  maxEnvelopeAgeMs?: number;
  clockSkewMs?: number;
  replayTtlMs?: number;
  replayScope?: string;
}

export interface TrustDependencies {
  keyResolver: IssuerKeyResolver;
  schemaRegistry: SchemaRegistry;
  replayStore?: ReplayStore;
  revocationResolver?: RevocationResolver;
}

export interface TrustVerification {
  valid: boolean;
  disposition: 'ACCEPT' | 'DUPLICATE' | 'REJECT';
  checks: {
    issuerPolicy: boolean;
    keyResolution: boolean;
    keyValidity: boolean;
    envelope: boolean;
    schema: boolean;
    revocation: boolean;
    replay: boolean;
  };
  replayClaim?: ReplayClaim;
  envelopeVerification?: EnvelopeVerification;
  errors: string[];
}

function parseOptionalTimestamp(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : Number.NaN;
}

export async function verifyEnvelopeWithTrust<TPayload>(
  envelope: SporeEnvelope<TPayload>,
  policy: TrustPolicy,
  dependencies: TrustDependencies,
  now = new Date(),
): Promise<TrustVerification> {
  const errors: string[] = [];
  const checks = {
    issuerPolicy: false,
    keyResolution: false,
    keyValidity: false,
    envelope: false,
    schema: false,
    revocation: false,
    replay: false,
  };

  if (
    !envelope ||
    typeof envelope.issuer?.id !== 'string' ||
    typeof envelope.issuer?.keyId !== 'string' ||
    typeof envelope.kind !== 'string' ||
    typeof envelope.issuedAt !== 'string'
  ) {
    errors.push('Envelope is missing the issuer, key, kind, or issue time required for trust resolution.');
    return { valid: false, disposition: 'REJECT', checks, errors };
  }

  checks.issuerPolicy =
    (!policy.allowedIssuers || policy.allowedIssuers.includes(envelope.issuer?.id)) &&
    (!policy.allowedKinds || policy.allowedKinds.includes(envelope.kind));
  if (!checks.issuerPolicy) errors.push('Envelope issuer or kind is not allowed by policy.');

  let keyRecord: IssuerKeyRecord | undefined;
  try {
    keyRecord = await dependencies.keyResolver.resolve(envelope.issuer.id, envelope.issuer.keyId);
  } catch (error) {
    errors.push(`Issuer key resolution failed: ${error instanceof Error ? error.message : 'unknown error'}.`);
    return { valid: false, disposition: 'REJECT', checks, errors };
  }
  checks.keyResolution =
    keyRecord !== undefined &&
    keyRecord.issuerId === envelope.issuer?.id &&
    keyRecord.keyId === envelope.issuer?.keyId;
  if (!checks.keyResolution || !keyRecord) {
    errors.push('No trusted issuer key was resolved for the envelope.');
    return { valid: false, disposition: 'REJECT', checks, errors };
  }

  const issuedAt = Date.parse(envelope.issuedAt);
  const validFrom = parseOptionalTimestamp(keyRecord.validFrom);
  const validUntil = parseOptionalTimestamp(keyRecord.validUntil);
  const revokedAt = parseOptionalTimestamp(keyRecord.revokedAt);
  checks.keyValidity =
    Number.isFinite(issuedAt) &&
    (validFrom === undefined || (Number.isFinite(validFrom) && issuedAt >= validFrom)) &&
    (validUntil === undefined || (Number.isFinite(validUntil) && issuedAt < validUntil)) &&
    (revokedAt === undefined || (Number.isFinite(revokedAt) && now.getTime() < revokedAt));
  if (!checks.keyValidity) errors.push('Issuer key is outside its validity window or revoked.');

  const envelopeVerification = verifyEnvelope(envelope, keyRecord.publicKey, {
    now,
    expectedAudience: policy.expectedAudience,
    clockSkewMs: policy.clockSkewMs ?? 30_000,
  });
  checks.envelope = envelopeVerification.valid;
  errors.push(...envelopeVerification.errors);

  if (policy.requireExpiry && !envelope.expiresAt) {
    checks.envelope = false;
    errors.push('Trust policy requires an envelope expiry.');
  }
  if (
    policy.maxEnvelopeAgeMs !== undefined &&
    Number.isFinite(issuedAt) &&
    now.getTime() - issuedAt > policy.maxEnvelopeAgeMs
  ) {
    checks.envelope = false;
    errors.push('Envelope exceeds the maximum age allowed by policy.');
  }

  const schemaResult = dependencies.schemaRegistry.validate(envelope.schema, envelope.payload);
  checks.schema = schemaResult.valid;
  errors.push(...schemaResult.errors);

  if (policy.requireRevocationCheck) {
    if (!dependencies.revocationResolver) {
      errors.push('Trust policy requires a revocation resolver.');
    } else {
      try {
        checks.revocation = !(await dependencies.revocationResolver.isRevoked(envelope.id, now));
        if (!checks.revocation) errors.push('Envelope has been revoked.');
      } catch (error) {
        errors.push(`Revocation check failed: ${error instanceof Error ? error.message : 'unknown error'}.`);
      }
    }
  } else {
    checks.revocation = true;
  }

  const preReplayValid = Object.entries(checks)
    .filter(([name]) => name !== 'replay')
    .every(([, valid]) => valid);
  if (!preReplayValid) return { valid: false, disposition: 'REJECT', checks, envelopeVerification, errors };

  let replayClaim: ReplayClaim | undefined;
  if (policy.requireReplayProtection) {
    if (!dependencies.replayStore) {
      errors.push('Trust policy requires a replay store.');
      return { valid: false, disposition: 'REJECT', checks, envelopeVerification, errors };
    }
    const replayTtlMs = policy.replayTtlMs ?? 24 * 60 * 60 * 1000;
    if (!Number.isFinite(replayTtlMs) || replayTtlMs <= 0) {
      errors.push('Trust policy replayTtlMs must be positive.');
      return { valid: false, disposition: 'REJECT', checks, envelopeVerification, errors };
    }
    const replayExpiresAt = envelope.expiresAt ?? new Date(now.getTime() + replayTtlMs).toISOString();
    try {
      replayClaim = await dependencies.replayStore.claim(
        policy.replayScope ?? `${policy.expectedAudience}:${envelope.issuer.id}`,
        envelope.nonce,
        envelope.id,
        replayExpiresAt,
      );
    } catch (error) {
      errors.push(`Replay check failed: ${error instanceof Error ? error.message : 'unknown error'}.`);
      return { valid: false, disposition: 'REJECT', checks, envelopeVerification, errors };
    }
    checks.replay = replayClaim !== 'CONFLICT';
    if (!checks.replay) errors.push('Envelope nonce conflicts with another content ID.');
  } else {
    checks.replay = true;
  }

  const valid = Object.values(checks).every(Boolean);
  return {
    valid,
    disposition: valid ? (replayClaim === 'DUPLICATE' ? 'DUPLICATE' : 'ACCEPT') : 'REJECT',
    checks,
    replayClaim,
    envelopeVerification,
    errors,
  };
}

export class StaticIssuerKeyResolver implements IssuerKeyResolver {
  private readonly records = new Map<string, IssuerKeyRecord>();

  constructor(records: IssuerKeyRecord[] = []) {
    records.forEach((record) => this.register(record));
  }

  register(record: IssuerKeyRecord): this {
    if (!record.issuerId || !record.keyId) throw new TypeError('Issuer key record requires issuerId and keyId.');
    const id = `${record.issuerId}\0${record.keyId}`;
    if (this.records.has(id)) throw new TypeError(`Issuer key is already registered: ${record.keyId}.`);
    this.records.set(id, record);
    return this;
  }

  async resolve(issuerId: string, keyId: string): Promise<IssuerKeyRecord | undefined> {
    return this.records.get(`${issuerId}\0${keyId}`);
  }
}

/** Process-local test implementation. Production runtimes need a durable atomic store. */
export class InMemoryReplayStore implements ReplayStore {
  private readonly claims = new Map<string, { envelopeId: string; expiresAt: number }>();

  constructor(private readonly now: () => number = Date.now) {}

  async claim(scope: string, nonce: string, envelopeId: string, expiresAt: string): Promise<ReplayClaim> {
    const now = this.now();
    for (const [key, value] of this.claims) {
      if (value.expiresAt <= now) this.claims.delete(key);
    }
    const key = `${scope}\0${nonce}`;
    const existing = this.claims.get(key);
    if (existing) return existing.envelopeId === envelopeId ? 'DUPLICATE' : 'CONFLICT';

    const expiry = Date.parse(expiresAt);
    if (!Number.isFinite(expiry) || expiry <= now) throw new TypeError('Replay claim expiry must be in the future.');
    this.claims.set(key, { envelopeId, expiresAt: expiry });
    return 'CLAIMED';
  }
}

/** Process-local test implementation. Production runtimes need durable revocation state. */
export class InMemoryRevocationResolver implements RevocationResolver {
  private readonly revoked = new Set<string>();

  revoke(envelopeId: string): void {
    this.revoked.add(envelopeId);
  }

  async isRevoked(envelopeId: string): Promise<boolean> {
    return this.revoked.has(envelopeId);
  }
}
