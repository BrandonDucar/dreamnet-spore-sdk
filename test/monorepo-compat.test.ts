import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import test from 'node:test';
import { createSignedEnvelope, verifyEnvelope } from '../src/protocol/envelope.js';
import {
  assessLegacyMonorepoEnvelope,
  createLegacyReissueDraft,
  type LegacyMonorepoEnvelope,
} from '../src/protocol/legacyMonorepo.js';

const legacy: LegacyMonorepoEnvelope<{ claim_id: string; statement: string }> = {
  v: 'spore-envelope-v1',
  type: 'claim',
  id: 'payload-only-hash',
  issuer: 'claimed-public-key',
  signature: 'algorithm-not-declared',
  created_at: '2026-08-01T12:00:00.000Z',
  expires_at: '2026-08-01T13:00:00.000Z',
  payload: { claim_id: 'claim-1', statement: 'Observed result.' },
};

test('legacy monorepo envelopes are recognized but never accepted as trusted', () => {
  const assessment = assessLegacyMonorepoEnvelope(legacy);

  assert.equal(assessment.disposition, 'QUARANTINE');
  assert.equal(assessment.trusted, false);
  assert.deepEqual(assessment.envelope, legacy);
  assert.ok(assessment.issues.includes('PAYLOAD_ONLY_SIGNATURE_SCOPE'));
  assert.ok(assessment.issues.includes('SIGNATURE_ALGORITHM_UNDECLARED'));
  assert.ok(assessment.issues.includes('NONCE_MISSING'));
});

test('legacy metadata is not promoted when creating a reissue draft', () => {
  const draft = createLegacyReissueDraft(legacy, {
    issuer: { id: 'operator:dreamnet', keyId: 'key:operator:1' },
    audience: ['organism:zao'],
    schema: 'https://schemas.dreamnet.ink/spore/claim.v1.json',
    nonce: 'legacy-reissue-00000001',
    subject: 'claim:claim-1',
    issuedAt: '2026-08-01T12:30:00.000Z',
    expiresAt: '2026-08-01T13:30:00.000Z',
    policyRef: 'policy:migration:legacy-monorepo-v1',
  });

  assert.equal(draft.specVersion, 'spore-envelope.v1');
  assert.equal(draft.kind, 'CLAIM');
  assert.deepEqual(draft.issuer, { id: 'operator:dreamnet', keyId: 'key:operator:1' });
  assert.equal(draft.issuedAt, '2026-08-01T12:30:00.000Z');
  assert.equal(draft.payload, legacy.payload);
  assert.equal('signature' in draft, false);
  assert.equal('id' in draft, false);
});

test('reissued envelopes bind all authorization metadata with Ed25519', () => {
  const keys = generateKeyPairSync('ed25519');
  const draft = createLegacyReissueDraft(legacy, {
    issuer: { id: 'operator:dreamnet', keyId: 'key:operator:1' },
    audience: ['organism:zao'],
    schema: 'https://schemas.dreamnet.ink/spore/claim.v1.json',
    nonce: 'legacy-reissue-00000002',
    subject: 'claim:claim-1',
    issuedAt: '2026-08-01T12:30:00.000Z',
    expiresAt: '2026-08-01T13:30:00.000Z',
  });
  const envelope = createSignedEnvelope(draft, keys.privateKey);
  const options = {
    now: new Date('2026-08-01T13:00:00.000Z'),
    expectedAudience: 'organism:zao',
    clockSkewMs: 0,
  };

  assert.equal(verifyEnvelope(envelope, keys.publicKey, options).valid, true);

  const tampered = structuredClone(envelope);
  tampered.kind = 'REVOCATION';
  tampered.issuer.id = 'operator:attacker';
  tampered.issuedAt = '2026-08-01T12:31:00.000Z';
  delete tampered.expiresAt;
  const result = verifyEnvelope(tampered, keys.publicKey, options);
  assert.equal(result.valid, false);
  assert.equal(result.checks.contentId, false);
  assert.equal(result.checks.signature, false);
});

test('malformed legacy input fails closed', () => {
  const malformed = { ...legacy, created_at: 'not-a-time' };
  const assessment = assessLegacyMonorepoEnvelope(malformed);
  assert.equal(assessment.trusted, false);
  assert.deepEqual(assessment.issues, ['MALFORMED_LEGACY_ENVELOPE']);
  assert.equal(assessment.envelope, undefined);
});
