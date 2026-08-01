import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateKeyPairSync } from 'node:crypto';
import test from 'node:test';
import { canonicalizeJson, sha256CanonicalJson } from '../src/protocol/canonicalize.js';
import {
  createSignedEnvelope,
  verifyEnvelope,
  type SporeEnvelope,
  type UnsignedSporeEnvelope,
} from '../src/protocol/envelope.js';
import { createProofDrop, type ContentReference } from '../src/protocol/proofDrop.js';
import { createSporeLease, evaluateSporeLease } from '../src/protocol/lease.js';

interface CanonicalizationFixture {
  name: string;
  input: unknown;
  canonical: string;
  sha256?: string;
}

const fixtures = JSON.parse(
  readFileSync(new URL('./fixtures/canonicalization-v1.json', import.meta.url), 'utf8'),
) as CanonicalizationFixture[];

const keys = generateKeyPairSync('ed25519');
const otherKeys = generateKeyPairSync('ed25519');
const issuedAt = '2026-08-01T12:00:00.000Z';

function reference(character: string, mediaType = 'application/json'): ContentReference {
  return {
    digest: `sha256:${character.repeat(64)}`,
    mediaType,
  };
}

test('RFC 8785 fixtures produce stable bytes and hashes', () => {
  for (const fixture of fixtures) {
    assert.equal(canonicalizeJson(fixture.input), fixture.canonical, fixture.name);
    if (fixture.sha256) assert.equal(sha256CanonicalJson(fixture.input), fixture.sha256, fixture.name);
  }
});

test('canonicalization rejects values that are not I-JSON', () => {
  assert.throws(() => canonicalizeJson({ missing: undefined }), /rejected undefined/);
  assert.throws(() => canonicalizeJson(-0), /non-I-JSON number/);
  assert.throws(() => canonicalizeJson(String.fromCharCode(0xd800)), /lone high surrogate/);
  assert.throws(() => canonicalizeJson(new Date()), /non-data object/);
  assert.throws(() => canonicalizeJson({ [Symbol('hidden')]: true }), /symbol property/);
  const accessor = Object.defineProperty({}, 'value', { enumerable: true, get: () => 1 });
  assert.throws(() => canonicalizeJson(accessor), /accessor property/);

  const cyclic: Record<string, unknown> = {};
  cyclic.self = cyclic;
  assert.throws(() => canonicalizeJson(cyclic), /cyclic value/);
});

test('a signed envelope verifies and any signed-field mutation is detected', () => {
  const unsigned: UnsignedSporeEnvelope<{ result: string; score: number }> = {
    specVersion: 'spore-envelope.v1',
    kind: 'RESULT',
    issuer: { id: 'did:web:dreamnet.ink:organisms:alpha', keyId: 'did:web:dreamnet.ink#alpha-1' },
    subject: 'assignment:42',
    issuedAt,
    expiresAt: '2026-08-01T13:00:00.000Z',
    nonce: '0123456789abcdef',
    audience: ['organism:zao'],
    schema: 'https://schemas.dreamnet.ink/spore/result.v1.json',
    payload: { result: 'accepted', score: 0.91 },
    privacyClass: 'INTERNAL',
  };
  const envelope = createSignedEnvelope(unsigned, keys.privateKey);

  assert.equal(
    verifyEnvelope(envelope, keys.publicKey, {
      now: new Date('2026-08-01T12:30:00.000Z'),
      expectedAudience: 'organism:zao',
      clockSkewMs: 0,
    }).valid,
    true,
  );
  assert.equal(verifyEnvelope(envelope, otherKeys.publicKey).valid, false);

  const tampered = structuredClone(envelope);
  tampered.payload.score = 0.99;
  const result = verifyEnvelope(tampered, keys.publicKey, {
    now: new Date('2026-08-01T12:30:00.000Z'),
    expectedAudience: 'organism:zao',
    clockSkewMs: 0,
  });
  assert.equal(result.valid, false);
  assert.equal(result.checks.contentId, false);
  assert.equal(result.checks.signature, false);
});

test('envelope freshness and audience checks fail closed', () => {
  const envelope = createSignedEnvelope(
    {
      specVersion: 'spore-envelope.v1',
      kind: 'OBSERVATION',
      issuer: { id: 'organism:dreamnet', keyId: 'key:dreamnet:1' },
      issuedAt,
      expiresAt: '2026-08-01T13:00:00.000Z',
      nonce: 'abcdef0123456789',
      audience: ['organism:zao'],
      schema: 'https://schemas.dreamnet.ink/spore/observation.v1.json',
      payload: { signal: 'green' },
    },
    keys.privateKey,
  );

  assert.equal(
    verifyEnvelope(envelope, keys.publicKey, {
      now: new Date('2026-08-01T14:00:00.000Z'),
      clockSkewMs: 0,
    }).checks.freshness,
    false,
  );
  assert.equal(
    verifyEnvelope(envelope, keys.publicKey, {
      now: new Date('2026-08-01T12:30:00.000Z'),
      expectedAudience: 'organism:unknown',
      clockSkewMs: 0,
    }).checks.audience,
    false,
  );
});

test('Proof Drops contain complete content references and cannot claim verification by mutation', () => {
  const proofDrop = createProofDrop(
    {
      issuer: { id: 'organism:dreamnet', keyId: 'key:dreamnet:1' },
      subject: 'execution:9001',
      audience: ['organism:zao'],
      issuedAt,
      nonce: 'proof-drop-9001-abcdef',
      payload: {
        schemaVersion: 'proof-drop.v1',
        executionTrace: reference('a'),
        evidence: [reference('b'), reference('c')],
        outputs: [reference('d', 'text/markdown')],
        provenance: {
          originNode: 'nuc-edge-01',
          runtime: 'temporal:dreamnet',
          environment: 'staging',
          gitCommitSha: '0'.repeat(40),
        },
        verificationPolicy: 'policy:proof-drop:strict-v1',
      },
      policyRef: 'policy:proof-drop:strict-v1',
    },
    keys.privateKey,
  );

  assert.match(proofDrop.id, /^spore:proof-drop:sha256:[a-f0-9]{64}$/);
  assert.equal(
    verifyEnvelope(proofDrop, keys.publicKey, {
      now: new Date(issuedAt),
      expectedAudience: 'organism:zao',
      clockSkewMs: 0,
    }).valid,
    true,
  );
  assert.equal('status' in proofDrop.payload, false);
  assert.throws(
    () => createProofDrop({
      issuer: { id: 'organism:dreamnet', keyId: 'key:dreamnet:1' },
      subject: 'execution:bad',
      audience: ['organism:zao'],
      issuedAt,
      nonce: 'proof-drop-invalid-01',
      payload: {
        schemaVersion: 'proof-drop.v1',
        executionTrace: { digest: 'sha256:placeholder', mediaType: 'application/json' },
        evidence: [],
        outputs: [],
        provenance: { originNode: 'nuc', runtime: 'test', environment: 'test' },
      },
    }, keys.privateKey),
    /complete lowercase SHA-256/,
  );
});

test('leases are missing-by-default and grant only signed explicit capabilities', () => {
  const request = {
    tenantId: 'tenant:zao',
    sporeId: 'spore:worker-1',
    capability: 'spore.reason',
    audience: 'spore:worker-1',
    now: new Date('2026-08-01T12:30:00.000Z'),
  };
  assert.deepEqual(evaluateSporeLease(undefined, request, keys.publicKey), {
    allowed: false,
    reason: 'LEASE_MISSING',
  });

  const lease = createSporeLease(
    {
      issuer: { id: 'operator:dreamnet', keyId: 'key:operator:1' },
      audience: ['spore:worker-1'],
      issuedAt,
      expiresAt: '2026-08-01T13:00:00.000Z',
      nonce: 'lease-worker-1-abcdef',
      payload: {
        schemaVersion: 'spore-lease.v1',
        tenantId: 'tenant:zao',
        sporeId: 'spore:worker-1',
        state: 'ACTIVE',
        capabilities: ['spore.reason'],
        notBefore: issuedAt,
        policyRef: 'policy:lease:operator-v1',
      },
    },
    keys.privateKey,
  );

  assert.deepEqual(evaluateSporeLease(lease, request, keys.publicKey), {
    allowed: true,
    reason: 'LEASE_ACTIVE',
  });
  assert.equal(
    evaluateSporeLease(lease, { ...request, capability: 'wallet.sign' }, keys.publicKey).reason,
    'CAPABILITY_DENIED',
  );
  assert.equal(
    evaluateSporeLease(lease, { ...request, tenantId: 'tenant:other' }, keys.publicKey).reason,
    'TENANT_MISMATCH',
  );

  const tampered = structuredClone(lease);
  tampered.payload.capabilities.push('wallet.sign');
  assert.equal(evaluateSporeLease(tampered, { ...request, capability: 'wallet.sign' }, keys.publicKey).reason, 'LEASE_INVALID');
  assert.equal(
    evaluateSporeLease(lease, { ...request, now: new Date('2026-08-01T14:00:00.000Z') }, keys.publicKey).reason,
    'LEASE_INVALID',
  );
});
