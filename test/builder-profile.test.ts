import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import test from 'node:test';
import {
  assertBuilderProfilePayload,
  BUILDER_PROFILE_SCHEMA,
  createBuilderProfileEnvelope,
  type BuilderProfilePayload,
} from '../src/protocol/builderProfile.js';
import { verifyEnvelope } from '../src/protocol/envelope.js';
import { createCoreSchemaRegistry } from '../src/protocol/trust.js';

const keys = generateKeyPairSync('ed25519');
const issuedAt = '2026-08-02T12:00:00.000Z';

function reviewedPayload(): BuilderProfilePayload {
  return {
    schemaVersion: 'builder-profile.v1',
    profileId: 'builder-profile:brandon:1',
    builderId: 'human:brandon-ducar',
    builderHandle: 'BrandonDucar',
    revision: 1,
    status: 'REVIEWED',
    visibility: 'FEDERATED',
    preferences: {
      riskPosture: 'VERIFIED_PRAGMATIC',
      velocityBias: 0.7,
      criticismStyle: 'DIRECT_EXPLICIT',
      definitionOfDone: [
        'Implementation, verification, and evidence are complete.',
        'The responsible worktree is clean.',
      ],
      nonNegotiables: [
        'Never expose live credentials.',
        'Never present architecture claims as runtime evidence.',
      ],
    },
    principles: [
      {
        id: 'evidence-before-authority',
        statement: 'External side effects require evidence and explicit operator authority.',
        appliesWhen: ['Deploying production infrastructure', 'Publishing public artifacts'],
        exceptions: [],
        confidence: 0.98,
        evidence: [
          {
            digest: `sha256:${'a'.repeat(64)}`,
            mediaType: 'application/vnd.dreamnet.proof-drop+json',
            uri: `spore:proof-drop:sha256:${'b'.repeat(64)}`,
          },
        ],
      },
    ],
    quorum: {
      requiredReviewers: 3,
      reviews: ['codex', 'hermes', 'antigravity'].map((reviewerId, index) => ({
        reviewerId: `agent:${reviewerId}`,
        receiptId: `spore:receipt:sha256:${String.fromCharCode(99 + index).repeat(64)}`,
        verdict: 'APPROVE' as const,
      })),
      reviewedAt: '2026-08-02T11:55:00.000Z',
    },
    authority: {
      advisoryOnly: true,
      grantsCapabilities: false,
      overridesPolicy: false,
      authorizesExecution: false,
    },
  };
}

test('creates a signed, evidence-backed, quorum-reviewed profile envelope', () => {
  const payload = reviewedPayload();
  const envelope = createBuilderProfileEnvelope(
    {
      issuer: { id: 'operator:dreamnet', keyId: 'key:operator:1' },
      subject: payload.builderId,
      audience: ['organism:dreamnet', 'organism:zao'],
      issuedAt,
      expiresAt: '2026-08-09T12:00:00.000Z',
      nonce: 'builder-profile-brandon-0001',
      payload,
      policyRef: 'policy:builder-profile:quorum-v1',
    },
    keys.privateKey,
  );

  assert.match(envelope.id, /^spore:profile:sha256:[a-f0-9]{64}$/);
  assert.equal(envelope.kind, 'PROFILE');
  assert.equal(envelope.schema, BUILDER_PROFILE_SCHEMA);
  assert.equal(envelope.privacyClass, 'CONFIDENTIAL');
  assert.deepEqual(
    envelope.dependencies,
    payload.quorum.reviews.map((review) => review.receiptId),
  );
  assert.equal(
    verifyEnvelope(envelope, keys.publicKey, {
      now: new Date('2026-08-02T12:30:00.000Z'),
      expectedAudience: 'organism:zao',
      clockSkewMs: 0,
    }).valid,
    true,
  );
  assert.equal(createCoreSchemaRegistry().validate(BUILDER_PROFILE_SCHEMA, payload).valid, true);
});

test('profile decisions remain advisory and signed-field mutation is rejected', () => {
  const payload = reviewedPayload();
  const envelope = createBuilderProfileEnvelope(
    {
      issuer: { id: 'operator:dreamnet', keyId: 'key:operator:1' },
      subject: payload.builderId,
      audience: ['organism:dreamnet'],
      issuedAt,
      expiresAt: '2026-08-09T12:00:00.000Z',
      nonce: 'builder-profile-brandon-0002',
      payload,
      policyRef: 'policy:builder-profile:quorum-v1',
    },
    keys.privateKey,
  );

  assert.deepEqual(envelope.payload.authority, {
    advisoryOnly: true,
    grantsCapabilities: false,
    overridesPolicy: false,
    authorizesExecution: false,
  });
  const tampered = structuredClone(envelope);
  tampered.payload.principles[0].confidence = 1;
  assert.equal(verifyEnvelope(tampered, keys.publicKey).valid, false);
});

test('rejects unsupported authority, weak quorum, missing evidence, and hidden fields', () => {
  const authority = reviewedPayload();
  authority.authority.authorizesExecution = true as false;
  assert.throws(() => assertBuilderProfilePayload(authority), /advisory/);

  const quorum = reviewedPayload();
  quorum.quorum.reviews = quorum.quorum.reviews.slice(0, 2);
  assert.throws(() => assertBuilderProfilePayload(quorum), /reviewer quorum/);

  const evidence = reviewedPayload();
  evidence.principles[0].evidence = [];
  assert.throws(() => assertBuilderProfilePayload(evidence), /1 to 20 references/);

  const extended = reviewedPayload() as BuilderProfilePayload & { toolPermissions: string[] };
  extended.toolPermissions = ['deploy.production'];
  assert.throws(() => assertBuilderProfilePayload(extended), /unknown fields/);
});

test('candidate profiles cannot claim reviews and revisions require lineage', () => {
  const candidate = reviewedPayload();
  candidate.status = 'CANDIDATE';
  assert.throws(() => assertBuilderProfilePayload(candidate), /Candidate profiles/);

  const revision = reviewedPayload();
  revision.revision = 2;
  assert.throws(() => assertBuilderProfilePayload(revision), /superseded envelope/);

  revision.supersedes = `spore:profile:sha256:${'f'.repeat(64)}`;
  assert.throws(
    () => createBuilderProfileEnvelope(
      {
        issuer: { id: 'operator:dreamnet', keyId: 'key:operator:1' },
        subject: revision.builderId,
        audience: ['organism:dreamnet'],
        issuedAt,
        expiresAt: '2026-08-09T12:00:00.000Z',
        nonce: 'builder-profile-brandon-revision-0001',
        payload: revision,
        policyRef: 'policy:builder-profile:quorum-v1',
      },
      keys.privateKey,
    ),
    /envelope parents/,
  );

  const revisionEnvelope = createBuilderProfileEnvelope(
    {
      issuer: { id: 'operator:dreamnet', keyId: 'key:operator:1' },
      subject: revision.builderId,
      audience: ['organism:dreamnet'],
      issuedAt,
      expiresAt: '2026-08-09T12:00:00.000Z',
      nonce: 'builder-profile-brandon-revision-0002',
      payload: revision,
      parents: [revision.supersedes],
      policyRef: 'policy:builder-profile:quorum-v1',
    },
    keys.privateKey,
  );
  assert.deepEqual(revisionEnvelope.parents, [revision.supersedes]);

  candidate.quorum.reviews = [];
  delete candidate.quorum.reviewedAt;
  assert.doesNotThrow(() => assertBuilderProfilePayload(candidate));
});

test('requires the envelope subject to identify the profiled builder', () => {
  const payload = reviewedPayload();
  assert.throws(
    () => createBuilderProfileEnvelope(
      {
        issuer: { id: 'operator:dreamnet', keyId: 'key:operator:1' },
        subject: 'human:someone-else',
        audience: ['organism:dreamnet'],
        issuedAt,
        expiresAt: '2026-08-09T12:00:00.000Z',
        nonce: 'builder-profile-subject-mismatch-0001',
        payload,
        policyRef: 'policy:builder-profile:quorum-v1',
      },
      keys.privateKey,
    ),
    /subject must equal/,
  );
});

test('rejects invalid confidence, bias, duplicate principles, and public visibility', () => {
  const confidence = reviewedPayload();
  confidence.principles[0].confidence = Number.NaN;
  assert.throws(() => assertBuilderProfilePayload(confidence), /confidence/);

  const bias = reviewedPayload();
  bias.preferences.velocityBias = 1.5;
  assert.throws(() => assertBuilderProfilePayload(bias), /velocityBias/);

  const duplicates = reviewedPayload();
  duplicates.principles.push(structuredClone(duplicates.principles[0]));
  assert.throws(() => assertBuilderProfilePayload(duplicates), /unique/);

  const visibility = reviewedPayload();
  visibility.visibility = 'PUBLIC' as 'PRIVATE';
  assert.throws(() => assertBuilderProfilePayload(visibility), /visibility/);
});

test('rejects duplicate reviewer identities, duplicate receipts, and future review claims', () => {
  const reviewer = reviewedPayload();
  reviewer.quorum.reviews[1].reviewerId = reviewer.quorum.reviews[0].reviewerId;
  assert.throws(() => assertBuilderProfilePayload(reviewer), /unique reviewers/);

  const receipt = reviewedPayload();
  receipt.quorum.reviews[1].receiptId = receipt.quorum.reviews[0].receiptId;
  assert.throws(() => assertBuilderProfilePayload(receipt), /unique receipts/);

  const future = reviewedPayload();
  future.quorum.reviewedAt = '2026-08-02T12:01:00.000Z';
  assert.throws(
    () => createBuilderProfileEnvelope(
      {
        issuer: { id: 'operator:dreamnet', keyId: 'key:operator:1' },
        subject: future.builderId,
        audience: ['organism:dreamnet'],
        issuedAt,
        expiresAt: '2026-08-09T12:00:00.000Z',
        nonce: 'builder-profile-future-review-0001',
        payload: future,
        policyRef: 'policy:builder-profile:quorum-v1',
      },
      keys.privateKey,
    ),
    /cannot be later/,
  );
});
