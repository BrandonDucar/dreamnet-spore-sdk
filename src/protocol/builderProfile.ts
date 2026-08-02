import { type KeyLike } from 'node:crypto';
import {
  createSignedEnvelope,
  type SporeEnvelope,
  type SporeIssuer,
  type UnsignedSporeEnvelope,
} from './envelope.js';
import { sha256DomainSeparatedJson } from './canonicalize.js';
import type { ContentReference } from './proofDrop.js';

export const BUILDER_PROFILE_SCHEMA =
  'https://schemas.dreamnet.ink/spore/builder-profile.v1.json' as const;
export const BUILDER_PROFILE_CONTENT_HASH_DOMAIN =
  'SPORE-BUILDER-PROFILE-CONTENT-V1' as const;

export interface BuilderDecisionPrinciple {
  id: string;
  statement: string;
  appliesWhen: string[];
  exceptions: string[];
  confidence: number;
  evidence: ContentReference[];
}

export interface BuilderProfileReview {
  reviewerId: string;
  receiptId: string;
  verdict: 'APPROVE';
}

export interface BuilderProfilePayload {
  schemaVersion: 'builder-profile.v1';
  profileId: string;
  builderId: string;
  builderHandle?: string;
  revision: number;
  supersedes?: string;
  status: 'CANDIDATE' | 'REVIEWED';
  visibility: 'PRIVATE' | 'FEDERATED';
  preferences: {
    riskPosture: 'CONSERVATIVE' | 'VERIFIED_PRAGMATIC' | 'HIGH_VELOCITY';
    velocityBias: number;
    criticismStyle: 'STRICT_AUDIT' | 'BALANCED' | 'DIRECT_EXPLICIT';
    definitionOfDone: string[];
    nonNegotiables: string[];
  };
  principles: BuilderDecisionPrinciple[];
  quorum: {
    requiredReviewers: number;
    candidateEnvelopeId?: string;
    reviews: BuilderProfileReview[];
    reviewedAt?: string;
  };
  authority: {
    advisoryOnly: true;
    grantsCapabilities: false;
    overridesPolicy: false;
    authorizesExecution: false;
  };
}

export interface CreateBuilderProfileOptions {
  issuer: SporeIssuer;
  subject: string;
  audience: string[];
  issuedAt: string;
  expiresAt: string;
  nonce: string;
  payload: BuilderProfilePayload;
  parents?: string[];
  policyRef: string;
}

const PAYLOAD_KEYS = new Set([
  'schemaVersion', 'profileId', 'builderId', 'builderHandle', 'revision',
  'supersedes', 'status', 'visibility', 'preferences', 'principles', 'quorum',
  'authority',
]);
const PREFERENCE_KEYS = new Set([
  'riskPosture', 'velocityBias', 'criticismStyle', 'definitionOfDone',
  'nonNegotiables',
]);
const PRINCIPLE_KEYS = new Set([
  'id', 'statement', 'appliesWhen', 'exceptions', 'confidence', 'evidence',
]);
const REFERENCE_KEYS = new Set(['digest', 'mediaType', 'sizeBytes', 'uri']);
const QUORUM_KEYS = new Set([
  'requiredReviewers', 'candidateEnvelopeId', 'reviews', 'reviewedAt',
]);
const REVIEW_KEYS = new Set(['reviewerId', 'receiptId', 'verdict']);
const AUTHORITY_KEYS = new Set([
  'advisoryOnly', 'grantsCapabilities', 'overridesPolicy', 'authorizesExecution',
]);

function assertExactKeys(value: unknown, allowed: Set<string>, name: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object.`);
  }
  const extras = Object.keys(value).filter((key) => !allowed.has(key));
  if (extras.length > 0) throw new TypeError(`${name} contains unknown fields: ${extras.join(', ')}.`);
}

function assertString(value: unknown, name: string, maxLength = 512): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > maxLength) {
    throw new TypeError(`${name} must contain 1 to ${maxLength} characters.`);
  }
}

function assertStringArray(
  value: unknown,
  name: string,
  { min = 0, max = 20, itemMax = 256 }: { min?: number; max?: number; itemMax?: number } = {},
): asserts value is string[] {
  if (!Array.isArray(value) || value.length < min || value.length > max) {
    throw new TypeError(`${name} must contain ${min} to ${max} entries.`);
  }
  value.forEach((item, index) => assertString(item, `${name}[${index}]`, itemMax));
  if (new Set(value).size !== value.length) throw new TypeError(`${name} cannot contain duplicates.`);
}

function assertTimestamp(value: unknown, name: string): asserts value is string {
  assertString(value, name, 40);
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== value) {
    throw new TypeError(`${name} must be an ISO 8601 UTC timestamp.`);
  }
}

function assertReference(reference: unknown, name: string): asserts reference is ContentReference {
  assertExactKeys(reference, REFERENCE_KEYS, name);
  if (!/^sha256:[a-f0-9]{64}$/.test(String(reference.digest ?? ''))) {
    throw new TypeError(`${name}.digest must be a complete lowercase SHA-256 digest.`);
  }
  assertString(reference.mediaType, `${name}.mediaType`, 128);
  if (
    reference.sizeBytes !== undefined &&
    (!Number.isSafeInteger(reference.sizeBytes) || Number(reference.sizeBytes) < 0)
  ) {
    throw new TypeError(`${name}.sizeBytes must be a non-negative safe integer.`);
  }
  if (reference.uri !== undefined) assertString(reference.uri, `${name}.uri`, 2048);
}

function assertPrinciple(value: unknown, index: number): asserts value is BuilderDecisionPrinciple {
  const name = `principles[${index}]`;
  assertExactKeys(value, PRINCIPLE_KEYS, name);
  assertString(value.id, `${name}.id`, 128);
  if (!/^[a-z0-9][a-z0-9._:-]*$/.test(value.id)) throw new TypeError(`${name}.id is invalid.`);
  assertString(value.statement, `${name}.statement`, 1000);
  assertStringArray(value.appliesWhen, `${name}.appliesWhen`, { min: 1, max: 20 });
  assertStringArray(value.exceptions, `${name}.exceptions`, { min: 0, max: 20 });
  if (typeof value.confidence !== 'number' || !Number.isFinite(value.confidence) ||
      value.confidence < 0 || value.confidence > 1) {
    throw new TypeError(`${name}.confidence must be a finite number from 0 to 1.`);
  }
  if (!Array.isArray(value.evidence) || value.evidence.length < 1 || value.evidence.length > 20) {
    throw new TypeError(`${name}.evidence must contain 1 to 20 references.`);
  }
  value.evidence.forEach((reference, evidenceIndex) => {
    assertReference(reference, `${name}.evidence[${evidenceIndex}]`);
  });
  const digests = value.evidence.map((reference) => reference.digest);
  if (new Set(digests).size !== digests.length) throw new TypeError(`${name}.evidence cannot contain duplicate digests.`);
}

export function assertBuilderProfilePayload(payload: BuilderProfilePayload): void {
  assertExactKeys(payload, PAYLOAD_KEYS, 'Builder Profile');
  if (payload.schemaVersion !== 'builder-profile.v1') {
    throw new TypeError('Unsupported Builder Profile version.');
  }
  assertString(payload.profileId, 'profileId', 128);
  if (!/^[a-z0-9][a-z0-9._:-]*$/.test(payload.profileId)) throw new TypeError('profileId is invalid.');
  assertString(payload.builderId, 'builderId', 256);
  if (payload.builderHandle !== undefined) assertString(payload.builderHandle, 'builderHandle', 128);
  if (!Number.isSafeInteger(payload.revision) || payload.revision < 1) {
    throw new TypeError('revision must be a positive safe integer.');
  }
  if (payload.supersedes !== undefined && !/^spore:profile:sha256:[a-f0-9]{64}$/.test(payload.supersedes)) {
    throw new TypeError('supersedes must reference a complete prior profile envelope ID.');
  }
  if (payload.revision > 1 && payload.supersedes === undefined) {
    throw new TypeError('Profile revisions after 1 must reference the superseded envelope.');
  }
  if (!['CANDIDATE', 'REVIEWED'].includes(payload.status)) throw new TypeError('Builder Profile status is invalid.');
  if (!['PRIVATE', 'FEDERATED'].includes(payload.visibility)) throw new TypeError('Builder Profile visibility is invalid.');

  assertExactKeys(payload.preferences, PREFERENCE_KEYS, 'preferences');
  if (!['CONSERVATIVE', 'VERIFIED_PRAGMATIC', 'HIGH_VELOCITY'].includes(payload.preferences.riskPosture)) {
    throw new TypeError('preferences.riskPosture is invalid.');
  }
  if (typeof payload.preferences.velocityBias !== 'number' ||
      !Number.isFinite(payload.preferences.velocityBias) ||
      payload.preferences.velocityBias < 0 || payload.preferences.velocityBias > 1) {
    throw new TypeError('preferences.velocityBias must be a finite number from 0 to 1.');
  }
  if (!['STRICT_AUDIT', 'BALANCED', 'DIRECT_EXPLICIT'].includes(payload.preferences.criticismStyle)) {
    throw new TypeError('preferences.criticismStyle is invalid.');
  }
  assertStringArray(payload.preferences.definitionOfDone, 'preferences.definitionOfDone', { min: 1, max: 20 });
  assertStringArray(payload.preferences.nonNegotiables, 'preferences.nonNegotiables', { min: 1, max: 20 });

  if (!Array.isArray(payload.principles) || payload.principles.length < 1 || payload.principles.length > 100) {
    throw new TypeError('principles must contain 1 to 100 evidence-backed rules.');
  }
  payload.principles.forEach(assertPrinciple);
  const principleIds = payload.principles.map((principle) => principle.id);
  if (new Set(principleIds).size !== principleIds.length) throw new TypeError('principle IDs must be unique.');

  assertExactKeys(payload.quorum, QUORUM_KEYS, 'quorum');
  if (!Number.isSafeInteger(payload.quorum.requiredReviewers) ||
      payload.quorum.requiredReviewers < 3 || payload.quorum.requiredReviewers > 10) {
    throw new TypeError('quorum.requiredReviewers must be an integer from 3 to 10.');
  }
  if (
    payload.quorum.candidateEnvelopeId !== undefined &&
    !/^spore:profile:sha256:[a-f0-9]{64}$/.test(payload.quorum.candidateEnvelopeId)
  ) {
    throw new TypeError('quorum.candidateEnvelopeId must be a complete profile envelope ID.');
  }
  if (!Array.isArray(payload.quorum.reviews) || payload.quorum.reviews.length > 10) {
    throw new TypeError('quorum.reviews must contain 0 to 10 entries.');
  }
  for (const [index, review] of payload.quorum.reviews.entries()) {
    assertExactKeys(review, REVIEW_KEYS, `quorum.reviews[${index}]`);
    assertString(review.reviewerId, `quorum.reviews[${index}].reviewerId`, 256);
    if (!/^spore:receipt:sha256:[a-f0-9]{64}$/.test(review.receiptId)) {
      throw new TypeError('Every quorum review receiptId must be a complete receipt envelope ID.');
    }
    if (review.verdict !== 'APPROVE') {
      throw new TypeError('Only affirmative reviews belong in a reviewed Builder Profile quorum.');
    }
  }
  const reviewerIds = payload.quorum.reviews.map((review) => review.reviewerId);
  const receiptIds = payload.quorum.reviews.map((review) => review.receiptId);
  if (new Set(reviewerIds).size !== reviewerIds.length) {
    throw new TypeError('quorum.reviews must identify unique reviewers.');
  }
  if (new Set(receiptIds).size !== receiptIds.length) {
    throw new TypeError('quorum.reviews must reference unique receipts.');
  }
  if (payload.status === 'REVIEWED') {
    if (payload.quorum.candidateEnvelopeId === undefined) {
      throw new TypeError('Reviewed profiles must reference the candidate envelope reviewed by quorum.');
    }
    if (payload.quorum.reviews.length < payload.quorum.requiredReviewers) {
      throw new TypeError('Reviewed profiles require the configured reviewer quorum.');
    }
    assertTimestamp(payload.quorum.reviewedAt, 'quorum.reviewedAt');
  } else if (
    payload.quorum.candidateEnvelopeId !== undefined ||
    payload.quorum.reviews.length > 0 ||
    payload.quorum.reviewedAt !== undefined
  ) {
    throw new TypeError('Candidate profiles cannot claim a reviewed candidate, reviews, or a review time.');
  }

  assertExactKeys(payload.authority, AUTHORITY_KEYS, 'authority');
  if (
    payload.authority.advisoryOnly !== true ||
    payload.authority.grantsCapabilities !== false ||
    payload.authority.overridesPolicy !== false ||
    payload.authority.authorizesExecution !== false
  ) {
    throw new TypeError('Builder Profiles are advisory and cannot grant capabilities, override policy, or authorize execution.');
  }
}

export function computeBuilderProfileContentDigest(payload: BuilderProfilePayload): `sha256:${string}` {
  assertBuilderProfilePayload(payload);
  const reviewableContent = {
    schemaVersion: payload.schemaVersion,
    profileId: payload.profileId,
    builderId: payload.builderId,
    ...(payload.builderHandle !== undefined ? { builderHandle: payload.builderHandle } : {}),
    revision: payload.revision,
    ...(payload.supersedes !== undefined ? { supersedes: payload.supersedes } : {}),
    visibility: payload.visibility,
    preferences: payload.preferences,
    principles: payload.principles,
    authority: payload.authority,
  };
  return `sha256:${sha256DomainSeparatedJson(BUILDER_PROFILE_CONTENT_HASH_DOMAIN, reviewableContent)}`;
}

export function createBuilderProfileEnvelope(
  options: CreateBuilderProfileOptions,
  privateKey: KeyLike,
): SporeEnvelope<BuilderProfilePayload> {
  assertBuilderProfilePayload(options.payload);
  if (options.subject !== options.payload.builderId) {
    throw new TypeError('Builder Profile envelope subject must equal payload.builderId.');
  }
  if (
    options.payload.quorum.reviewedAt !== undefined &&
    Date.parse(options.payload.quorum.reviewedAt) > Date.parse(options.issuedAt)
  ) {
    throw new TypeError('Builder Profile reviewedAt cannot be later than envelope issuedAt.');
  }
  if (
    options.payload.supersedes !== undefined &&
    !options.parents?.includes(options.payload.supersedes)
  ) {
    throw new TypeError('A revised Builder Profile must include its superseded profile in envelope parents.');
  }
  if (
    options.payload.quorum.candidateEnvelopeId !== undefined &&
    !options.parents?.includes(options.payload.quorum.candidateEnvelopeId)
  ) {
    throw new TypeError('A reviewed Builder Profile must include its candidate envelope in parents.');
  }
  const unsigned: UnsignedSporeEnvelope<BuilderProfilePayload> = {
    specVersion: 'spore-envelope.v1',
    kind: 'PROFILE',
    issuer: options.issuer,
    subject: options.subject,
    issuedAt: options.issuedAt,
    expiresAt: options.expiresAt,
    nonce: options.nonce,
    audience: options.audience,
    schema: BUILDER_PROFILE_SCHEMA,
    payload: options.payload,
    policyRef: options.policyRef,
    privacyClass: options.payload.visibility === 'PRIVATE' ? 'RESTRICTED' : 'CONFIDENTIAL',
  };
  if (options.parents) unsigned.parents = options.parents;
  if (options.payload.quorum.reviews.length > 0) {
    unsigned.dependencies = options.payload.quorum.reviews.map((review) => review.receiptId);
  }
  return createSignedEnvelope(unsigned, privateKey);
}
