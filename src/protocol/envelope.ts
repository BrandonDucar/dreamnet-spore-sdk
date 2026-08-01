import {
  sign as cryptoSign,
  verify as cryptoVerify,
  type KeyLike,
} from 'node:crypto';
import { canonicalizeJson, sha256DomainSeparatedJson } from './canonicalize.js';

export const SPORE_ENVELOPE_VERSION = 'spore-envelope.v1' as const;
export const SPORE_HASH_ALGORITHM = 'sha256:rfc8785' as const;

export type SporeEnvelopeKind =
  | 'OBSERVATION'
  | 'ASSIGNMENT'
  | 'RESULT'
  | 'PROOF_DROP'
  | 'RECEIPT'
  | 'CLAIM'
  | 'COUNTERCLAIM'
  | 'VERIFICATION'
  | 'CAPABILITY'
  | 'MUTATION'
  | 'LEASE'
  | 'REVOCATION'
  | 'POLICY'
  | 'SETTLEMENT';

export interface SporeIssuer {
  id: string;
  keyId: string;
}

export interface UnsignedSporeEnvelope<TPayload = unknown> {
  specVersion: typeof SPORE_ENVELOPE_VERSION;
  kind: SporeEnvelopeKind;
  issuer: SporeIssuer;
  subject?: string;
  issuedAt: string;
  expiresAt?: string;
  nonce: string;
  audience: string[];
  schema: string;
  payload: TPayload;
  parents?: string[];
  dependencies?: string[];
  policyRef?: string;
  privacyClass?: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';
}

export interface SporeEnvelopeSignature {
  algorithm: 'Ed25519';
  keyId: string;
  value: string;
}

export interface SporeEnvelope<TPayload = unknown>
  extends UnsignedSporeEnvelope<TPayload> {
  id: string;
  hash: {
    algorithm: typeof SPORE_HASH_ALGORITHM;
    digest: string;
  };
  signature: SporeEnvelopeSignature;
}

export interface VerifyEnvelopeOptions {
  now?: Date;
  expectedAudience?: string;
  clockSkewMs?: number;
}

export interface EnvelopeVerification {
  valid: boolean;
  checks: {
    structure: boolean;
    contentId: boolean;
    signature: boolean;
    freshness: boolean;
    audience: boolean;
  };
  errors: string[];
}

const SPORE_KINDS = new Set<SporeEnvelopeKind>([
  'OBSERVATION', 'ASSIGNMENT', 'RESULT', 'PROOF_DROP', 'RECEIPT', 'CLAIM',
  'COUNTERCLAIM', 'VERIFICATION', 'CAPABILITY', 'MUTATION', 'LEASE',
  'REVOCATION', 'POLICY', 'SETTLEMENT',
]);

function assertUniqueStringArray(value: unknown, name: string, requireValue = false): asserts value is string[] {
  if (!Array.isArray(value) || (requireValue && value.length === 0)) {
    throw new TypeError(`${name} must be ${requireValue ? 'a non-empty' : 'an'} array.`);
  }
  value.forEach((item, index) => assertNonEmptyString(item, `${name}[${index}]`));
  if (new Set(value).size !== value.length) throw new TypeError(`${name} cannot contain duplicates.`);
}

function assertNonEmptyString(value: unknown, name: string): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`${name} must be a non-empty string.`);
  }
}

function parseTimestamp(value: string, name: string): number {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== value) {
    throw new TypeError(`${name} must be an ISO 8601 UTC timestamp.`);
  }
  return timestamp;
}

export function assertUnsignedEnvelope(value: UnsignedSporeEnvelope<unknown>): void {
  if (value.specVersion !== SPORE_ENVELOPE_VERSION) {
    throw new TypeError(`Unsupported Spore envelope version: ${String(value.specVersion)}.`);
  }
  if (!SPORE_KINDS.has(value.kind)) throw new TypeError(`Unsupported Spore envelope kind: ${String(value.kind)}.`);
  assertNonEmptyString(value.issuer?.id, 'issuer.id');
  assertNonEmptyString(value.issuer?.keyId, 'issuer.keyId');
  assertNonEmptyString(value.nonce, 'nonce');
  if (value.nonce.length < 16) {
    throw new TypeError('nonce must contain at least 16 characters.');
  }
  assertNonEmptyString(value.schema, 'schema');
  const issuedAt = parseTimestamp(value.issuedAt, 'issuedAt');
  if (value.expiresAt && parseTimestamp(value.expiresAt, 'expiresAt') <= issuedAt) {
    throw new TypeError('expiresAt must be later than issuedAt.');
  }
  assertUniqueStringArray(value.audience, 'audience', true);
  if (value.subject !== undefined) assertNonEmptyString(value.subject, 'subject');
  if (value.policyRef !== undefined) assertNonEmptyString(value.policyRef, 'policyRef');
  if (value.parents !== undefined) assertUniqueStringArray(value.parents, 'parents');
  if (value.dependencies !== undefined) assertUniqueStringArray(value.dependencies, 'dependencies');
  if (
    value.privacyClass !== undefined &&
    !['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'].includes(value.privacyClass)
  ) {
    throw new TypeError('privacyClass is invalid.');
  }
  canonicalizeJson(value);
}

export function envelopeSigningBytes(unsigned: UnsignedSporeEnvelope<unknown>): Buffer {
  assertUnsignedEnvelope(unsigned);
  const domain = `${SPORE_ENVELOPE_VERSION}:${unsigned.kind}`;
  return Buffer.from(`${domain}\0${canonicalizeJson(unsigned)}`, 'utf8');
}

export function computeEnvelopeDigest(unsigned: UnsignedSporeEnvelope<unknown>): string {
  assertUnsignedEnvelope(unsigned);
  return sha256DomainSeparatedJson(`${SPORE_ENVELOPE_VERSION}:${unsigned.kind}`, unsigned);
}

export function createSignedEnvelope<TPayload>(
  unsigned: UnsignedSporeEnvelope<TPayload>,
  privateKey: KeyLike,
): SporeEnvelope<TPayload> {
  const digest = computeEnvelopeDigest(unsigned);
  const signature = cryptoSign(null, envelopeSigningBytes(unsigned), privateKey).toString('base64url');
  const kind = unsigned.kind.toLowerCase().replaceAll('_', '-');

  return {
    ...unsigned,
    id: `spore:${kind}:sha256:${digest}`,
    hash: { algorithm: SPORE_HASH_ALGORITHM, digest },
    signature: {
      algorithm: 'Ed25519',
      keyId: unsigned.issuer.keyId,
      value: signature,
    },
  };
}

export function unsignedEnvelopeOf<TPayload>(
  envelope: SporeEnvelope<TPayload>,
): UnsignedSporeEnvelope<TPayload> {
  const { id: _id, hash: _hash, signature: _signature, ...unsigned } = envelope;
  return unsigned;
}

export function verifyEnvelope<TPayload>(
  envelope: SporeEnvelope<TPayload>,
  publicKey: KeyLike,
  options: VerifyEnvelopeOptions = {},
): EnvelopeVerification {
  const errors: string[] = [];
  const checks = {
    structure: false,
    contentId: false,
    signature: false,
    freshness: false,
    audience: false,
  };

  let unsigned: UnsignedSporeEnvelope<TPayload>;
  try {
    unsigned = unsignedEnvelopeOf(envelope);
    assertUnsignedEnvelope(unsigned);
    assertNonEmptyString(envelope.id, 'id');
    if (envelope.hash?.algorithm !== SPORE_HASH_ALGORITHM || !/^[a-f0-9]{64}$/.test(envelope.hash?.digest ?? '')) {
      throw new TypeError('Envelope hash metadata is invalid.');
    }
    if (
      envelope.signature?.algorithm !== 'Ed25519' ||
      envelope.signature?.keyId !== envelope.issuer.keyId ||
      !/^[A-Za-z0-9_-]+$/.test(envelope.signature?.value ?? '')
    ) {
      throw new TypeError('Envelope signature metadata is invalid.');
    }
    checks.structure = true;
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Envelope structure is invalid.');
    return { valid: false, checks, errors };
  }

  const digest = computeEnvelopeDigest(unsigned);
  const expectedId = `spore:${unsigned.kind.toLowerCase().replaceAll('_', '-')}:sha256:${digest}`;
  checks.contentId = envelope.hash.digest === digest && envelope.id === expectedId;
  if (!checks.contentId) errors.push('Envelope content ID does not match its signed content.');

  try {
    checks.signature = cryptoVerify(
      null,
      envelopeSigningBytes(unsigned),
      publicKey,
      Buffer.from(envelope.signature.value, 'base64url'),
    );
  } catch {
    checks.signature = false;
  }
  if (!checks.signature) errors.push('Envelope signature is invalid.');

  const now = (options.now ?? new Date()).getTime();
  const skew = options.clockSkewMs ?? 30_000;
  const issuedAt = Date.parse(unsigned.issuedAt);
  const expiresAt = unsigned.expiresAt ? Date.parse(unsigned.expiresAt) : undefined;
  checks.freshness = issuedAt <= now + skew && (expiresAt === undefined || expiresAt > now - skew);
  if (!checks.freshness) errors.push('Envelope is not currently fresh.');

  checks.audience = !options.expectedAudience || unsigned.audience.includes(options.expectedAudience);
  if (!checks.audience) errors.push('Envelope was not issued for the expected audience.');

  return {
    valid: Object.values(checks).every(Boolean),
    checks,
    errors,
  };
}
