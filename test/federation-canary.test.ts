import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import test from 'node:test';
import {
  createFederationCanaryEnvelope,
  evaluateFederationCanaryTransition,
  type FederationCanaryPayload,
} from '../src/protocol/federationCanary.js';
import {
  createCoreSchemaRegistry,
  InMemoryReplayStore,
  InMemoryRevocationResolver,
  StaticIssuerKeyResolver,
  verifyEnvelopeWithTrust,
} from '../src/protocol/trust.js';

const keys = generateKeyPairSync('ed25519');
const issuedAt = '2026-08-01T12:00:00.000Z';
const expiresAt = '2026-08-01T13:00:00.000Z';
const now = new Date('2026-08-01T12:30:00.000Z');

function ref(seed: string) {
  return {
    digest: `sha256:${seed.repeat(64).slice(0, 64)}` as const,
    mediaType: 'application/json',
  };
}

function initial(): FederationCanaryPayload {
  return {
    schemaVersion: 'federation-canary.v1',
    canaryId: 'canary:zao:001',
    agent: { organismId: 'organism:zao', agentId: 'agent:zao:research-001' },
    stage: 'TRAPPER_ACCEPTED',
    mode: 'PAPER_ONLY',
    artifacts: { trapper: ref('a') },
    control: { receiptColor: 'GREEN', humanApprovalRequired: false, halted: false },
    authority: {
      walletAccess: false,
      realTrading: false,
      publicPosting: false,
      productionDeploy: false,
      rawBusAccess: false,
      secretAccess: false,
    },
  };
}

test('canary advances one evidence-complete stage and binds the prior envelope', () => {
  const first = initial();
  const firstEnvelope = createFederationCanaryEnvelope(
    {
      issuer: { id: 'organism:zao', keyId: 'key:zao:1' },
      audience: ['gateway:dreamnet'],
      issuedAt,
      expiresAt,
      nonce: 'federation-canary-0001',
      payload: first,
    },
    keys.privateKey,
  );
  const next: FederationCanaryPayload = {
    ...structuredClone(first),
    stage: 'ASSIGNMENT_COMPLETED',
    artifacts: {
      trapper: ref('a'),
      assignment: ref('b'),
      terminalReceipt: ref('c'),
    },
    priorEnvelopeId: firstEnvelope.id,
  };

  assert.equal(evaluateFederationCanaryTransition(first, next, firstEnvelope.id).disposition, 'ADVANCE');
  assert.equal(evaluateFederationCanaryTransition(first, first, firstEnvelope.id).disposition, 'IDEMPOTENT');
  assert.equal(evaluateFederationCanaryTransition(first, { ...next, priorEnvelopeId: 'wrong' }, firstEnvelope.id).disposition, 'REJECT');
});

test('canary rejects stage skipping and incomplete evidence', () => {
  const first = initial();
  const priorEnvelopeId = `spore:result:sha256:${'f'.repeat(64)}`;
  const skipped: FederationCanaryPayload = {
    ...structuredClone(first),
    stage: 'PROOF_DROP_VERIFIED',
    artifacts: {
      trapper: ref('a'),
      assignment: ref('b'),
      terminalReceipt: ref('c'),
      proofDrop: ref('d'),
    },
    priorEnvelopeId,
  };
  const transition = evaluateFederationCanaryTransition(first, skipped, priorEnvelopeId);
  assert.equal(transition.disposition, 'REJECT');
  assert.match(transition.errors.join(' '), /advance exactly one stage/);

  const incomplete = { ...skipped, stage: 'ASSIGNMENT_COMPLETED', artifacts: { trapper: ref('a') } };
  assert.throws(
    () => createFederationCanaryEnvelope(
      {
        issuer: { id: 'organism:zao', keyId: 'key:zao:1' },
        audience: ['gateway:dreamnet'],
        issuedAt,
        expiresAt,
        nonce: 'federation-canary-0002',
        payload: incomplete as FederationCanaryPayload,
      },
      keys.privateKey,
    ),
    /requires artifacts.assignment/,
  );
});

test('yellow and red receipts halt; privileged authority fails closed', () => {
  const first = initial();
  const yellow: FederationCanaryPayload = {
    ...structuredClone(first),
    control: {
      receiptColor: 'YELLOW',
      humanApprovalRequired: true,
      halted: true,
      reason: 'Independent verification needs review.',
    },
  };
  const next = { ...structuredClone(yellow), stage: 'ASSIGNMENT_COMPLETED' } as FederationCanaryPayload;
  assert.equal(evaluateFederationCanaryTransition(yellow, next, 'prior').disposition, 'HALT');

  const privileged = structuredClone(first) as FederationCanaryPayload;
  (privileged.authority as unknown as { walletAccess: boolean }).walletAccess = true;
  assert.throws(
    () => createFederationCanaryEnvelope(
      {
        issuer: { id: 'organism:zao', keyId: 'key:zao:1' },
        audience: ['gateway:dreamnet'],
        issuedAt,
        expiresAt,
        nonce: 'federation-canary-0003',
        payload: privileged,
      },
      keys.privateKey,
    ),
    /deny every privileged capability/,
  );
});

test('trusted gateway accepts one signed canary and classifies redelivery as duplicate', async () => {
  const envelope = createFederationCanaryEnvelope(
    {
      issuer: { id: 'organism:zao', keyId: 'key:zao:1' },
      audience: ['gateway:dreamnet'],
      issuedAt,
      expiresAt,
      nonce: 'federation-canary-0004',
      payload: initial(),
    },
    keys.privateKey,
  );
  const dependencies = {
    keyResolver: new StaticIssuerKeyResolver([
      { issuerId: 'organism:zao', keyId: 'key:zao:1', publicKey: keys.publicKey },
    ]),
    schemaRegistry: createCoreSchemaRegistry(),
    replayStore: new InMemoryReplayStore(() => now.getTime()),
    revocationResolver: new InMemoryRevocationResolver(),
  };
  const policy = {
    expectedAudience: 'gateway:dreamnet',
    requireExpiry: true,
    requireReplayProtection: true,
    requireRevocationCheck: true,
    allowedIssuers: ['organism:zao'],
    allowedKinds: ['RESULT'] as const,
    clockSkewMs: 0,
  };

  const accepted = await verifyEnvelopeWithTrust(envelope, { ...policy, allowedKinds: [...policy.allowedKinds] }, dependencies, now);
  const duplicate = await verifyEnvelopeWithTrust(envelope, { ...policy, allowedKinds: [...policy.allowedKinds] }, dependencies, now);
  assert.equal(accepted.disposition, 'ACCEPT');
  assert.equal(duplicate.disposition, 'DUPLICATE');
});
