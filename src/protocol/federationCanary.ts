import type { KeyLike } from 'node:crypto';
import { canonicalizeJson } from './canonicalize.js';
import {
  createSignedEnvelope,
  type SporeEnvelope,
  type SporeIssuer,
  type UnsignedSporeEnvelope,
} from './envelope.js';
import type { ContentReference } from './proofDrop.js';

export const FEDERATION_CANARY_SCHEMA =
  'https://schemas.dreamnet.ink/spore/federation-canary.v1.json' as const;

export const FEDERATION_CANARY_STAGES = [
  'TRAPPER_ACCEPTED',
  'ASSIGNMENT_COMPLETED',
  'PROOF_DROP_VERIFIED',
  'CLAIM_PROMOTED',
  'PAPER_THESIS_ADMITTED',
  'UNIVERSITY_EVIDENCE_RECORDED',
] as const;

export type FederationCanaryStage = (typeof FEDERATION_CANARY_STAGES)[number];
export type CanaryReceiptColor = 'GREEN' | 'YELLOW' | 'RED';

export interface FederationCanaryAuthority {
  walletAccess: false;
  realTrading: false;
  publicPosting: false;
  productionDeploy: false;
  rawBusAccess: false;
  secretAccess: false;
}

export interface FederationCanaryArtifacts {
  trapper: ContentReference;
  assignment?: ContentReference;
  terminalReceipt?: ContentReference;
  proofDrop?: ContentReference;
  claim?: ContentReference;
  independentVerification?: ContentReference;
  paperThesis?: ContentReference;
  universityEvidence?: ContentReference;
}

export interface FederationCanaryPayload {
  schemaVersion: 'federation-canary.v1';
  canaryId: string;
  agent: {
    organismId: string;
    agentId: string;
  };
  stage: FederationCanaryStage;
  mode: 'PAPER_ONLY';
  artifacts: FederationCanaryArtifacts;
  control: {
    receiptColor: CanaryReceiptColor;
    humanApprovalRequired: boolean;
    halted: boolean;
    reason?: string;
  };
  authority: FederationCanaryAuthority;
  priorEnvelopeId?: string;
}

export interface CreateFederationCanaryOptions {
  issuer: SporeIssuer;
  audience: string[];
  issuedAt: string;
  expiresAt: string;
  nonce: string;
  payload: FederationCanaryPayload;
  policyRef?: string;
}

export interface CanaryTransitionDecision {
  disposition: 'ADVANCE' | 'IDEMPOTENT' | 'HALT' | 'REJECT';
  errors: string[];
}

const REQUIRED_ARTIFACTS: Record<FederationCanaryStage, readonly (keyof FederationCanaryArtifacts)[]> = {
  TRAPPER_ACCEPTED: ['trapper'],
  ASSIGNMENT_COMPLETED: ['trapper', 'assignment', 'terminalReceipt'],
  PROOF_DROP_VERIFIED: ['trapper', 'assignment', 'terminalReceipt', 'proofDrop'],
  CLAIM_PROMOTED: [
    'trapper',
    'assignment',
    'terminalReceipt',
    'proofDrop',
    'claim',
    'independentVerification',
  ],
  PAPER_THESIS_ADMITTED: [
    'trapper',
    'assignment',
    'terminalReceipt',
    'proofDrop',
    'claim',
    'independentVerification',
    'paperThesis',
  ],
  UNIVERSITY_EVIDENCE_RECORDED: [
    'trapper',
    'assignment',
    'terminalReceipt',
    'proofDrop',
    'claim',
    'independentVerification',
    'paperThesis',
    'universityEvidence',
  ],
};

const ARTIFACT_KEYS: readonly (keyof FederationCanaryArtifacts)[] = [
  'trapper',
  'assignment',
  'terminalReceipt',
  'proofDrop',
  'claim',
  'independentVerification',
  'paperThesis',
  'universityEvidence',
];

const AUTHORITY_KEYS: readonly (keyof FederationCanaryAuthority)[] = [
  'walletAccess',
  'realTrading',
  'publicPosting',
  'productionDeploy',
  'rawBusAccess',
  'secretAccess',
];

function assertNonEmptyString(value: unknown, name: string): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`${name} must be a non-empty string.`);
  }
}

function assertContentReference(reference: ContentReference, name: string): void {
  if (!reference || !/^sha256:[a-f0-9]{64}$/.test(reference.digest)) {
    throw new TypeError(`${name}.digest must be a complete lowercase SHA-256 digest.`);
  }
  assertNonEmptyString(reference.mediaType, `${name}.mediaType`);
  if (reference.sizeBytes !== undefined && (!Number.isSafeInteger(reference.sizeBytes) || reference.sizeBytes < 0)) {
    throw new TypeError(`${name}.sizeBytes must be a non-negative safe integer.`);
  }
  if (reference.uri !== undefined) assertNonEmptyString(reference.uri, `${name}.uri`);
}

export function assertFederationCanaryPayload(payload: FederationCanaryPayload): void {
  if (payload.schemaVersion !== 'federation-canary.v1') {
    throw new TypeError('Unsupported federation canary version.');
  }
  assertNonEmptyString(payload.canaryId, 'canaryId');
  assertNonEmptyString(payload.agent?.organismId, 'agent.organismId');
  assertNonEmptyString(payload.agent?.agentId, 'agent.agentId');
  if (!FEDERATION_CANARY_STAGES.includes(payload.stage)) throw new TypeError('Federation canary stage is invalid.');
  if (payload.mode !== 'PAPER_ONLY') throw new TypeError('Federation canaries must remain PAPER_ONLY.');

  const artifactNames = Object.keys(payload.artifacts ?? {});
  if (artifactNames.some((name) => !ARTIFACT_KEYS.includes(name as keyof FederationCanaryArtifacts))) {
    throw new TypeError('Federation canary artifacts contain an unknown field.');
  }
  const artifactEntries = Object.entries(payload.artifacts ?? {}) as [keyof FederationCanaryArtifacts, ContentReference][];
  for (const [name, reference] of artifactEntries) assertContentReference(reference, `artifacts.${name}`);
  const digests = artifactEntries.map(([, reference]) => reference.digest);
  if (new Set(digests).size !== digests.length) {
    throw new TypeError('Federation canary artifacts cannot reuse content digests.');
  }
  for (const name of REQUIRED_ARTIFACTS[payload.stage]) {
    if (!payload.artifacts[name]) throw new TypeError(`Stage ${payload.stage} requires artifacts.${name}.`);
  }

  if (!['GREEN', 'YELLOW', 'RED'].includes(payload.control?.receiptColor)) {
    throw new TypeError('control.receiptColor is invalid.');
  }
  if (typeof payload.control.humanApprovalRequired !== 'boolean' || typeof payload.control.halted !== 'boolean') {
    throw new TypeError('Canary control flags must be boolean.');
  }
  if (payload.control.receiptColor === 'GREEN' && payload.control.halted) {
    throw new TypeError('A GREEN canary cannot be halted.');
  }
  if (payload.control.receiptColor === 'YELLOW' && (!payload.control.halted || !payload.control.humanApprovalRequired)) {
    throw new TypeError('A YELLOW canary must halt for human approval.');
  }
  if (payload.control.receiptColor === 'RED' && !payload.control.halted) {
    throw new TypeError('A RED canary must halt.');
  }
  if (payload.control.reason !== undefined) assertNonEmptyString(payload.control.reason, 'control.reason');

  const authority = payload.authority as unknown as Record<string, unknown>;
  if (
    Object.keys(authority ?? {}).length !== AUTHORITY_KEYS.length ||
    AUTHORITY_KEYS.some((key) => authority?.[key] !== false)
  ) {
    throw new TypeError('Federation canary authority must deny every privileged capability.');
  }

  if (payload.stage === 'TRAPPER_ACCEPTED' && payload.priorEnvelopeId !== undefined) {
    throw new TypeError('The initial canary stage cannot have a prior envelope.');
  }
  if (payload.stage !== 'TRAPPER_ACCEPTED') {
    assertNonEmptyString(payload.priorEnvelopeId, 'priorEnvelopeId');
    if (!/^spore:[a-z-]+:sha256:[a-f0-9]{64}$/.test(payload.priorEnvelopeId)) {
      throw new TypeError('priorEnvelopeId must be a complete Spore content ID.');
    }
  }
  canonicalizeJson(payload);
}

export function evaluateFederationCanaryTransition(
  previous: FederationCanaryPayload,
  next: FederationCanaryPayload,
  previousEnvelopeId: string,
): CanaryTransitionDecision {
  try {
    assertFederationCanaryPayload(previous);
  } catch (error) {
    return {
      disposition: 'REJECT',
      errors: [error instanceof Error ? error.message : 'Canary payload is invalid.'],
    };
  }
  if (previous.control.halted) return { disposition: 'HALT', errors: ['The prior canary state is halted.'] };
  try {
    assertFederationCanaryPayload(next);
  } catch (error) {
    return {
      disposition: 'REJECT',
      errors: [error instanceof Error ? error.message : 'Canary payload is invalid.'],
    };
  }

  if (canonicalizeJson(previous) === canonicalizeJson(next)) return { disposition: 'IDEMPOTENT', errors: [] };

  const errors: string[] = [];
  if (previous.canaryId !== next.canaryId) errors.push('Canary ID cannot change during a transition.');
  if (previous.agent.organismId !== next.agent.organismId || previous.agent.agentId !== next.agent.agentId) {
    errors.push('Canary agent identity cannot change during a transition.');
  }
  if (next.priorEnvelopeId !== previousEnvelopeId) errors.push('Next state does not reference the prior signed envelope.');
  const expectedStage = FEDERATION_CANARY_STAGES[FEDERATION_CANARY_STAGES.indexOf(previous.stage) + 1];
  if (next.stage !== expectedStage) errors.push(`Canary must advance exactly one stage from ${previous.stage}.`);

  if (errors.length > 0) return { disposition: 'REJECT', errors };
  if (next.control.halted) return { disposition: 'HALT', errors: [next.control.reason ?? 'Canary requires review.'] };
  return { disposition: 'ADVANCE', errors: [] };
}

export function createFederationCanaryEnvelope(
  options: CreateFederationCanaryOptions,
  privateKey: KeyLike,
): SporeEnvelope<FederationCanaryPayload> {
  assertFederationCanaryPayload(options.payload);
  const unsigned: UnsignedSporeEnvelope<FederationCanaryPayload> = {
    specVersion: 'spore-envelope.v1',
    kind: 'RESULT',
    issuer: options.issuer,
    subject: options.payload.canaryId,
    issuedAt: options.issuedAt,
    expiresAt: options.expiresAt,
    nonce: options.nonce,
    audience: options.audience,
    schema: FEDERATION_CANARY_SCHEMA,
    payload: options.payload,
    privacyClass: 'INTERNAL',
  };
  if (options.policyRef) unsigned.policyRef = options.policyRef;
  if (options.payload.priorEnvelopeId) unsigned.parents = [options.payload.priorEnvelopeId];
  return createSignedEnvelope(unsigned, privateKey);
}
