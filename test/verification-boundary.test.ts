import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import test from 'node:test';
import { createSporeLease } from '../src/protocol/lease.js';
import {
  createCoreSchemaRegistry,
  InMemoryReplayStore,
  InMemoryRevocationResolver,
  StaticIssuerKeyResolver,
  verifyEnvelopeWithTrust,
  type IssuerKeyResolver,
} from '../src/protocol/trust.js';
import { fromSporeCloudEvent, toSporeCloudEvent } from '../src/protocol/cloudEvents.js';

const keys = generateKeyPairSync('ed25519');
const otherKeys = generateKeyPairSync('ed25519');
const issuedAt = '2026-08-01T12:00:00.000Z';
const expiresAt = '2026-08-01T13:00:00.000Z';
const now = new Date('2026-08-01T12:30:00.000Z');

function createLease(nonce = 'verification-lease-0001', capabilities = ['spore.reason']) {
  return createSporeLease(
    {
      issuer: { id: 'operator:dreamnet', keyId: 'key:operator:1' },
      audience: ['spore:worker-1'],
      issuedAt,
      expiresAt,
      nonce,
      payload: {
        schemaVersion: 'spore-lease.v1',
        tenantId: 'tenant:zao',
        sporeId: 'spore:worker-1',
        state: 'ACTIVE',
        capabilities,
        notBefore: issuedAt,
        policyRef: 'policy:lease:operator-v1',
      },
    },
    keys.privateKey,
  );
}

function dependencies(): {
  keyResolver: IssuerKeyResolver;
  schemaRegistry: ReturnType<typeof createCoreSchemaRegistry>;
  replayStore: InMemoryReplayStore;
  revocationResolver: InMemoryRevocationResolver;
} {
  return {
    keyResolver: new StaticIssuerKeyResolver([
      {
        issuerId: 'operator:dreamnet',
        keyId: 'key:operator:1',
        publicKey: keys.publicKey,
        validFrom: '2026-01-01T00:00:00.000Z',
        validUntil: '2027-01-01T00:00:00.000Z',
      },
    ]),
    schemaRegistry: createCoreSchemaRegistry(),
    replayStore: new InMemoryReplayStore(() => now.getTime()),
    revocationResolver: new InMemoryRevocationResolver(),
  };
}

const policy = {
  expectedAudience: 'spore:worker-1',
  requireExpiry: true,
  requireReplayProtection: true,
  requireRevocationCheck: true,
  allowedIssuers: ['operator:dreamnet'],
  allowedKinds: ['LEASE'] as const,
  maxEnvelopeAgeMs: 60 * 60 * 1000,
  clockSkewMs: 0,
};

test('trusted verification accepts once and classifies idempotent redelivery as duplicate', async () => {
  const deps = dependencies();
  const lease = createLease();
  const first = await verifyEnvelopeWithTrust(lease, { ...policy, allowedKinds: [...policy.allowedKinds] }, deps, now);
  const second = await verifyEnvelopeWithTrust(lease, { ...policy, allowedKinds: [...policy.allowedKinds] }, deps, now);

  assert.equal(first.valid, true);
  assert.equal(first.disposition, 'ACCEPT');
  assert.equal(first.replayClaim, 'CLAIMED');
  assert.equal(second.valid, true);
  assert.equal(second.disposition, 'DUPLICATE');
  assert.equal(second.replayClaim, 'DUPLICATE');
});

test('nonce reuse with different signed content is rejected as a replay conflict', async () => {
  const deps = dependencies();
  const first = createLease('shared-nonce-00000001', ['spore.reason']);
  const conflict = createLease('shared-nonce-00000001', ['spore.reason', 'spore.observe']);

  await verifyEnvelopeWithTrust(first, { ...policy, allowedKinds: [...policy.allowedKinds] }, deps, now);
  const result = await verifyEnvelopeWithTrust(conflict, { ...policy, allowedKinds: [...policy.allowedKinds] }, deps, now);

  assert.equal(result.valid, false);
  assert.equal(result.disposition, 'REJECT');
  assert.equal(result.replayClaim, 'CONFLICT');
  assert.match(result.errors.join(' '), /nonce conflicts/);
});

test('unknown keys and revoked envelopes fail before replay state is claimed', async () => {
  const lease = createLease('revocation-test-00001');
  const missingKey = dependencies();
  missingKey.keyResolver = new StaticIssuerKeyResolver();
  const unresolved = await verifyEnvelopeWithTrust(
    lease,
    { ...policy, allowedKinds: [...policy.allowedKinds] },
    missingKey,
    now,
  );
  assert.equal(unresolved.valid, false);
  assert.equal(unresolved.checks.keyResolution, false);

  const revokedDeps = dependencies();
  revokedDeps.revocationResolver.revoke(lease.id);
  const revoked = await verifyEnvelopeWithTrust(
    lease,
    { ...policy, allowedKinds: [...policy.allowedKinds] },
    revokedDeps,
    now,
  );
  assert.equal(revoked.valid, false);
  assert.equal(revoked.checks.revocation, false);
  assert.equal(revoked.replayClaim, undefined);
});

test('wrong trusted public key and unknown schemas fail closed', async () => {
  const lease = createLease('wrong-key-test-00001');
  const wrongKeyDeps = dependencies();
  wrongKeyDeps.keyResolver = new StaticIssuerKeyResolver([
    {
      issuerId: 'operator:dreamnet',
      keyId: 'key:operator:1',
      publicKey: otherKeys.publicKey,
    },
  ]);
  const wrongKey = await verifyEnvelopeWithTrust(
    lease,
    { ...policy, allowedKinds: [...policy.allowedKinds] },
    wrongKeyDeps,
    now,
  );
  assert.equal(wrongKey.valid, false);
  assert.equal(wrongKey.checks.envelope, false);

  const unknownSchema = structuredClone(lease);
  unknownSchema.schema = 'https://schemas.example/unknown.json';
  const unknown = await verifyEnvelopeWithTrust(
    unknownSchema,
    { ...policy, allowedKinds: [...policy.allowedKinds] },
    dependencies(),
    now,
  );
  assert.equal(unknown.valid, false);
  assert.equal(unknown.checks.schema, false);
});

test('trust dependency failures reject instead of crashing the worker', async () => {
  const lease = createLease('resolver-outage-000001');
  const deps = dependencies();
  deps.keyResolver = {
    async resolve() {
      throw new Error('key service unavailable');
    },
  };

  const result = await verifyEnvelopeWithTrust(
    lease,
    { ...policy, allowedKinds: [...policy.allowedKinds] },
    deps,
    now,
  );
  assert.equal(result.valid, false);
  assert.equal(result.disposition, 'REJECT');
  assert.match(result.errors.join(' '), /key service unavailable/);
});

test('CloudEvents carry the signed envelope without redefining it', () => {
  const lease = createLease('cloud-event-test-0001');
  const event = toSporeCloudEvent(lease);

  assert.equal(event.data, lease);
  assert.equal(event.id, lease.id);
  assert.equal(event.type, 'ink.dreamnet.spore.lease.v1');
  assert.equal(fromSporeCloudEvent(event), lease);

  const tampered = structuredClone(event);
  tampered.source = 'organism:attacker';
  assert.throws(() => fromSporeCloudEvent(tampered), /does not match/);
  assert.throws(
    () => fromSporeCloudEvent({ ...event, data: undefined } as unknown as typeof event),
    /structurally readable/,
  );
});
