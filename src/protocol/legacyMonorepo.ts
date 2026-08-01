import type {
  SporeEnvelopeKind,
  SporeIssuer,
  UnsignedSporeEnvelope,
} from './envelope.js';

export const LEGACY_MONOREPO_ENVELOPE_VERSION = 'spore-envelope-v1' as const;

export type LegacyMonorepoPayloadType =
  | 'observation'
  | 'proof_drop'
  | 'receipt'
  | 'claim'
  | 'counterclaim'
  | 'verification'
  | 'capability'
  | 'mutation'
  | 'lease'
  | 'revocation';

/**
 * Compatibility shape emitted by the July 2026 monorepo prototype.
 *
 * This is an ingestion type, not a trusted protocol type. Its signature only
 * covered payload bytes, so routing and authorization metadata can be changed
 * without invalidating the legacy signature.
 */
export interface LegacyMonorepoEnvelope<TPayload = unknown> {
  v: typeof LEGACY_MONOREPO_ENVELOPE_VERSION;
  type: LegacyMonorepoPayloadType;
  id: string;
  issuer: string;
  signature: string;
  created_at: string;
  expires_at?: string;
  payload: TPayload;
}

export type LegacyEnvelopeIssue =
  | 'MALFORMED_LEGACY_ENVELOPE'
  | 'PAYLOAD_ONLY_SIGNATURE_SCOPE'
  | 'SIGNATURE_ALGORITHM_UNDECLARED'
  | 'ISSUER_KEY_ID_MISSING'
  | 'AUDIENCE_MISSING'
  | 'NONCE_MISSING'
  | 'SCHEMA_MISSING';

export interface LegacyEnvelopeAssessment<TPayload = unknown> {
  disposition: 'QUARANTINE';
  trusted: false;
  issues: LegacyEnvelopeIssue[];
  envelope?: LegacyMonorepoEnvelope<TPayload>;
}

const LEGACY_TYPES = new Set<LegacyMonorepoPayloadType>([
  'observation', 'proof_drop', 'receipt', 'claim', 'counterclaim',
  'verification', 'capability', 'mutation', 'lease', 'revocation',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isLegacyEnvelope<TPayload>(value: unknown): value is LegacyMonorepoEnvelope<TPayload> {
  if (!isRecord(value)) return false;
  if (value.v !== LEGACY_MONOREPO_ENVELOPE_VERSION) return false;
  if (!isNonEmptyString(value.type) || !LEGACY_TYPES.has(value.type as LegacyMonorepoPayloadType)) return false;
  if (!isNonEmptyString(value.id) || !isNonEmptyString(value.issuer) || !isNonEmptyString(value.signature)) return false;
  if (!isNonEmptyString(value.created_at) || !Number.isFinite(Date.parse(value.created_at))) return false;
  if (value.expires_at !== undefined && (!isNonEmptyString(value.expires_at) || !Number.isFinite(Date.parse(value.expires_at)))) {
    return false;
  }
  return Object.prototype.hasOwnProperty.call(value, 'payload');
}

/**
 * Classify a legacy monorepo envelope without treating its signature as a
 * portable trust assertion. Every legacy envelope is quarantined for explicit
 * reissuance under Spore Envelope v1.
 */
export function assessLegacyMonorepoEnvelope<TPayload = unknown>(
  value: unknown,
): LegacyEnvelopeAssessment<TPayload> {
  if (!isLegacyEnvelope<TPayload>(value)) {
    return {
      disposition: 'QUARANTINE',
      trusted: false,
      issues: ['MALFORMED_LEGACY_ENVELOPE'],
    };
  }

  return {
    disposition: 'QUARANTINE',
    trusted: false,
    envelope: value,
    issues: [
      'PAYLOAD_ONLY_SIGNATURE_SCOPE',
      'SIGNATURE_ALGORITHM_UNDECLARED',
      'ISSUER_KEY_ID_MISSING',
      'AUDIENCE_MISSING',
      'NONCE_MISSING',
      'SCHEMA_MISSING',
    ],
  };
}

const KIND_BY_LEGACY_TYPE: Record<LegacyMonorepoPayloadType, SporeEnvelopeKind> = {
  observation: 'OBSERVATION',
  proof_drop: 'PROOF_DROP',
  receipt: 'RECEIPT',
  claim: 'CLAIM',
  counterclaim: 'COUNTERCLAIM',
  verification: 'VERIFICATION',
  capability: 'CAPABILITY',
  mutation: 'MUTATION',
  lease: 'LEASE',
  revocation: 'REVOCATION',
};

export interface LegacyReissueOptions {
  issuer: SporeIssuer;
  audience: string[];
  schema: string;
  nonce: string;
  subject?: string;
  issuedAt?: string;
  expiresAt?: string;
  policyRef?: string;
  privacyClass?: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';
}

/**
 * Build an unsigned v1 draft from a quarantined legacy payload.
 *
 * The caller must validate the payload under `options.schema`, record the
 * migration lineage externally, and sign the returned draft with a trusted
 * Ed25519 key. Legacy IDs, issuers, and signatures are deliberately not
 * promoted into the new trust boundary.
 */
export function createLegacyReissueDraft<TPayload>(
  legacy: LegacyMonorepoEnvelope<TPayload>,
  options: LegacyReissueOptions,
): UnsignedSporeEnvelope<TPayload> {
  const assessment = assessLegacyMonorepoEnvelope<TPayload>(legacy);
  if (!assessment.envelope) throw new TypeError('Legacy monorepo envelope is malformed.');

  const draft: UnsignedSporeEnvelope<TPayload> = {
    specVersion: 'spore-envelope.v1',
    kind: KIND_BY_LEGACY_TYPE[legacy.type],
    issuer: options.issuer,
    issuedAt: options.issuedAt ?? legacy.created_at,
    nonce: options.nonce,
    audience: options.audience,
    schema: options.schema,
    payload: legacy.payload,
    privacyClass: options.privacyClass ?? 'INTERNAL',
  };
  if (options.subject !== undefined) draft.subject = options.subject;
  if (options.expiresAt !== undefined) draft.expiresAt = options.expiresAt;
  if (options.policyRef !== undefined) draft.policyRef = options.policyRef;
  return draft;
}
