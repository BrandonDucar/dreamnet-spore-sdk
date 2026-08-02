import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import test from 'node:test';
import {
  computeBuilderProfileContentDigest,
  createBuilderProfileEnvelope,
  type BuilderProfilePayload,
} from '../src/protocol/builderProfile.js';
import {
  assertBuilderProfileReviewPayload,
  createBuilderProfileReviewReceipt,
} from '../src/protocol/builderProfileReview.js';
import {
  InMemorySporeEnvelopeResolver,
  verifyReviewedBuilderProfile,
} from '../src/protocol/builderProfileTrust.js';
import {
  createCoreSchemaRegistry,
  InMemoryReplayStore,
  InMemoryRevocationResolver,
  StaticIssuerKeyResolver,
} from '../src/protocol/trust.js';

const operatorKeys = generateKeyPairSync('ed25519');
const reviewers = ['codex', 'hermes', 'antigravity'].map((name) => ({
  id: `agent:${name}`,
  keyId: `key:${name}:1`,
  keys: generateKeyPairSync('ed25519'),
}));
const audience = 'gateway:dreamnet';
const now = new Date('2026-08-02T12:30:00.000Z');

function candidatePayload(): BuilderProfilePayload {
  return {
    schemaVersion: 'builder-profile.v1',
    profileId: 'builder-profile:brandon:1',
    builderId: 'human:brandon-ducar',
    builderHandle: 'BrandonDucar',
    revision: 1,
    status: 'CANDIDATE',
    visibility: 'FEDERATED',
    preferences: {
      riskPosture: 'VERIFIED_PRAGMATIC',
      velocityBias: 0.7,
      criticismStyle: 'DIRECT_EXPLICIT',
      definitionOfDone: ['Implementation and verification evidence are complete.'],
      nonNegotiables: ['Never present an architecture claim as runtime evidence.'],
    },
    principles: [{
      id: 'evidence-before-authority',
      statement: 'External side effects require evidence and explicit operator authority.',
      appliesWhen: ['Deploying production infrastructure'],
      exceptions: [],
      confidence: 0.98,
      evidence: [{
        digest: `sha256:${'a'.repeat(64)}`,
        mediaType: 'application/vnd.dreamnet.proof-drop+json',
      }],
    }],
    quorum: {
      requiredReviewers: 3,
      reviews: [],
    },
    authority: {
      advisoryOnly: true,
      grantsCapabilities: false,
      overridesPolicy: false,
      authorizesExecution: false,
    },
  };
}

interface FixtureOptions {
  missingReceiptIndex?: number;
  mismatchedDigestIndex?: number;
  rejectedReviewIndex?: number;
  declaredReviewerMismatchIndex?: number;
  lateReceiptIndex?: number;
}

function fixture(options: FixtureOptions = {}) {
  const candidate = createBuilderProfileEnvelope(
    {
      issuer: { id: 'operator:dreamnet', keyId: 'key:operator:1' },
      subject: 'human:brandon-ducar',
      audience: [audience],
      issuedAt: '2026-08-02T11:00:00.000Z',
      expiresAt: '2026-08-02T13:00:00.000Z',
      nonce: 'builder-profile-candidate-0001',
      payload: candidatePayload(),
      policyRef: 'policy:builder-profile:quorum-v1',
    },
    operatorKeys.privateKey,
  );
  const contentDigest = computeBuilderProfileContentDigest(candidate.payload);
  const receipts = reviewers.map((reviewer, index) => createBuilderProfileReviewReceipt(
    {
      issuer: { id: reviewer.id, keyId: reviewer.keyId },
      audience: [audience],
      issuedAt: index === options.lateReceiptIndex
        ? '2026-08-02T12:05:00.000Z'
        : '2026-08-02T11:30:00.000Z',
      expiresAt: '2026-08-02T13:00:00.000Z',
      nonce: `builder-profile-review-000${index + 1}`,
      payload: {
        schemaVersion: 'builder-profile-review.v1',
        candidateEnvelopeId: candidate.id,
        profileId: candidate.payload.profileId,
        profileRevision: candidate.payload.revision,
        profileContentDigest: index === options.mismatchedDigestIndex
          ? `sha256:${'f'.repeat(64)}`
          : contentDigest,
        reviewerId: reviewer.id,
        verdict: index === options.rejectedReviewIndex ? 'REJECT' : 'APPROVE',
        evidence: [{
          digest: `sha256:${String.fromCharCode(98 + index).repeat(64)}`,
          mediaType: 'application/vnd.dreamnet.quorum-review+json',
        }],
        reviewedAt: `2026-08-02T11:2${5 + index}:00.000Z`,
      },
      policyRef: 'policy:builder-profile-review-v1',
    },
    reviewer.keys.privateKey,
  ));

  const reviewedPayload: BuilderProfilePayload = {
    ...structuredClone(candidate.payload),
    status: 'REVIEWED',
    quorum: {
      requiredReviewers: 3,
      candidateEnvelopeId: candidate.id,
      reviews: receipts.map((receipt, index) => ({
        reviewerId: index === options.declaredReviewerMismatchIndex
          ? 'agent:untrusted-impostor'
          : reviewers[index].id,
        receiptId: receipt.id,
        verdict: 'APPROVE',
      })),
      reviewedAt: '2026-08-02T11:35:00.000Z',
    },
  };
  const profile = createBuilderProfileEnvelope(
    {
      issuer: { id: 'operator:dreamnet', keyId: 'key:operator:1' },
      subject: reviewedPayload.builderId,
      audience: [audience],
      issuedAt: '2026-08-02T12:00:00.000Z',
      expiresAt: '2026-08-02T13:00:00.000Z',
      nonce: 'builder-profile-reviewed-0001',
      payload: reviewedPayload,
      parents: [candidate.id],
      policyRef: 'policy:builder-profile:quorum-v1',
    },
    operatorKeys.privateKey,
  );

  const revocationResolver = new InMemoryRevocationResolver();
  const dependencies = {
    keyResolver: new StaticIssuerKeyResolver([
      {
        issuerId: 'operator:dreamnet',
        keyId: 'key:operator:1',
        publicKey: operatorKeys.publicKey,
      },
      ...reviewers.map((reviewer) => ({
        issuerId: reviewer.id,
        keyId: reviewer.keyId,
        publicKey: reviewer.keys.publicKey,
      })),
    ]),
    schemaRegistry: createCoreSchemaRegistry(),
    replayStore: new InMemoryReplayStore(() => now.getTime()),
    revocationResolver,
  };
  const resolvedReceipts = receipts.filter((_, index) => index !== options.missingReceiptIndex);
  const envelopeResolver = new InMemorySporeEnvelopeResolver([
    candidate,
    ...resolvedReceipts,
  ]);
  const profilePolicy = {
    expectedAudience: audience,
    requireExpiry: true,
    requireReplayProtection: true,
    requireRevocationCheck: true,
    allowedIssuers: ['operator:dreamnet'],
    allowedKinds: ['PROFILE'] as const,
    clockSkewMs: 0,
  };
  const reviewPolicy = {
    expectedAudience: audience,
    requireExpiry: true,
    requireReplayProtection: true,
    requireRevocationCheck: true,
    allowedIssuers: reviewers.map((reviewer) => reviewer.id),
    allowedKinds: ['RECEIPT'] as const,
    clockSkewMs: 0,
  };
  return {
    profile,
    candidate,
    receipts,
    dependencies,
    revocationResolver,
    envelopeResolver,
    profilePolicy: { ...profilePolicy, allowedKinds: [...profilePolicy.allowedKinds] },
    reviewPolicy: { ...reviewPolicy, allowedKinds: [...reviewPolicy.allowedKinds] },
  };
}

test('accepts a reviewed profile only after candidate and three review receipts verify', async () => {
  const value = fixture();
  const options = {
    profilePolicy: value.profilePolicy,
    reviewPolicy: value.reviewPolicy,
    dependencies: value.dependencies,
    envelopeResolver: value.envelopeResolver,
    now,
  };
  const accepted = await verifyReviewedBuilderProfile(value.profile, options);
  const duplicate = await verifyReviewedBuilderProfile(value.profile, options);

  assert.equal(accepted.valid, true);
  assert.equal(accepted.disposition, 'ACCEPT');
  assert.equal(accepted.reviewVerifications.length, 3);
  assert.equal(duplicate.valid, true);
  assert.equal(duplicate.disposition, 'DUPLICATE');
});

test('rejects an unresolved review receipt and fails the threshold closed', async () => {
  const value = fixture({ missingReceiptIndex: 2 });
  const result = await verifyReviewedBuilderProfile(value.profile, {
    profilePolicy: value.profilePolicy,
    reviewPolicy: value.reviewPolicy,
    dependencies: value.dependencies,
    envelopeResolver: value.envelopeResolver,
    now,
  });

  assert.equal(result.valid, false);
  assert.equal(result.checks.reviews, false);
  assert.equal(result.checks.threshold, false);
  assert.match(result.errors.join(' '), /could not be resolved/);
});

test('rejects a review of different content and a negative verdict', async () => {
  for (const value of [fixture({ mismatchedDigestIndex: 1 }), fixture({ rejectedReviewIndex: 1 })]) {
    const result = await verifyReviewedBuilderProfile(value.profile, {
      profilePolicy: value.profilePolicy,
      reviewPolicy: value.reviewPolicy,
      dependencies: value.dependencies,
      envelopeResolver: value.envelopeResolver,
      now,
    });
    assert.equal(result.valid, false);
    assert.match(result.errors.join(' '), /not bound to this profile quorum/);
  }
});

test('rejects a declared reviewer that does not match the signed receipt issuer', async () => {
  const value = fixture({ declaredReviewerMismatchIndex: 1 });
  const result = await verifyReviewedBuilderProfile(value.profile, {
    profilePolicy: value.profilePolicy,
    reviewPolicy: value.reviewPolicy,
    dependencies: value.dependencies,
    envelopeResolver: value.envelopeResolver,
    now,
  });

  assert.equal(result.valid, false);
  assert.equal(result.checks.reviews, false);
});

test('rejects a revoked review receipt', async () => {
  const value = fixture();
  value.revocationResolver.revoke(value.receipts[0].id);
  const result = await verifyReviewedBuilderProfile(value.profile, {
    profilePolicy: value.profilePolicy,
    reviewPolicy: value.reviewPolicy,
    dependencies: value.dependencies,
    envelopeResolver: value.envelopeResolver,
    now,
  });

  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /revoked/);
});

test('rejects a review receipt issued after the final reviewed profile', async () => {
  const value = fixture({ lateReceiptIndex: 1 });
  const result = await verifyReviewedBuilderProfile(value.profile, {
    profilePolicy: value.profilePolicy,
    reviewPolicy: value.reviewPolicy,
    dependencies: value.dependencies,
    envelopeResolver: value.envelopeResolver,
    now,
  });

  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /not bound to this profile quorum/);
});

test('review receipts reject hidden fields, missing evidence, issuer mismatch, and future claims', () => {
  const value = fixture();
  const payload = structuredClone(value.receipts[0].payload);

  const hidden = payload as typeof payload & { executionAuthority: boolean };
  hidden.executionAuthority = true;
  assert.throws(() => assertBuilderProfileReviewPayload(hidden), /unknown fields/);

  const noEvidence = structuredClone(value.receipts[0].payload);
  noEvidence.evidence = [];
  assert.throws(() => assertBuilderProfileReviewPayload(noEvidence), /require 1 to 20/);

  assert.throws(
    () => createBuilderProfileReviewReceipt(
      {
        issuer: { id: 'agent:impostor', keyId: 'key:impostor:1' },
        audience: [audience],
        issuedAt: '2026-08-02T11:30:00.000Z',
        expiresAt: '2026-08-02T13:00:00.000Z',
        nonce: 'builder-profile-review-impostor-0001',
        payload: value.receipts[0].payload,
        policyRef: 'policy:builder-profile-review-v1',
      },
      reviewers[0].keys.privateKey,
    ),
    /issuer must equal/,
  );

  const future = structuredClone(value.receipts[0].payload);
  future.reviewedAt = '2026-08-02T11:31:00.000Z';
  assert.throws(
    () => createBuilderProfileReviewReceipt(
      {
        issuer: { id: reviewers[0].id, keyId: reviewers[0].keyId },
        audience: [audience],
        issuedAt: '2026-08-02T11:30:00.000Z',
        expiresAt: '2026-08-02T13:00:00.000Z',
        nonce: 'builder-profile-review-future-0001',
        payload: future,
        policyRef: 'policy:builder-profile-review-v1',
      },
      reviewers[0].keys.privateKey,
    ),
    /cannot be later/,
  );
});
