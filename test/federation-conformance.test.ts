import assert from 'node:assert/strict';
import { createPublicKey } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { canonicalizeJson } from '../src/protocol/canonicalize.js';
import {
  fromSporeCloudEvent,
  type SporeCloudEvent,
} from '../src/protocol/cloudEvents.js';
import {
  unsignedEnvelopeOf,
  verifyEnvelope,
  type SporeEnvelope,
} from '../src/protocol/envelope.js';
import type { FederationCanaryPayload } from '../src/protocol/federationCanary.js';
import {
  createCoreSchemaRegistry,
  InMemoryReplayStore,
  InMemoryRevocationResolver,
  StaticIssuerKeyResolver,
  verifyEnvelopeWithTrust,
} from '../src/protocol/trust.js';

interface Fixture {
  fixtureVersion: string;
  publicKey: { algorithm: string; format: string; value: string };
  canonicalUnsigned: string;
  envelope: SporeEnvelope<FederationCanaryPayload>;
  cloudEvent: Omit<SporeCloudEvent<FederationCanaryPayload>, 'data'>;
  negativeVectors: { name: string; mutation: string; expectedDisposition: string }[];
}

const fixturePath = fileURLToPath(new URL('./fixtures/federation-canary-v1.json', import.meta.url));
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as Fixture;
const publicKey = createPublicKey({
  key: Buffer.from(fixture.publicKey.value, 'base64'),
  format: 'der',
  type: 'spki',
});
const now = new Date('2026-08-01T12:30:00.000Z');

test('published federation fixture has stable canonical bytes, ID and Ed25519 signature', () => {
  assert.equal(fixture.fixtureVersion, 'federation-canary-conformance.v1');
  assert.equal(canonicalizeJson(unsignedEnvelopeOf(fixture.envelope)), fixture.canonicalUnsigned);
  assert.equal(
    fixture.envelope.id,
    'spore:result:sha256:c8245a69047a4cba79de74a40f5e236ff7d0052df4989f09578f35371c749a7f',
  );
  assert.equal(
    fixture.envelope.signature.value,
    'ZwHkbnFWby5zZCd4hyK4LY5M8A4DPZelx-jnY90UVHzmui1R3DqNauqQn-CAU1e3MWNMQFqnstXqdcan8PI1Dw',
  );
  assert.equal(
    verifyEnvelope(fixture.envelope, publicKey, { now, expectedAudience: 'gateway:dreamnet', clockSkewMs: 0 }).valid,
    true,
  );
});

test('fixture passes the full trust boundary once and becomes an idempotent duplicate', async () => {
  const dependencies = {
    keyResolver: new StaticIssuerKeyResolver([
      {
        issuerId: fixture.envelope.issuer.id,
        keyId: fixture.envelope.issuer.keyId,
        publicKey,
      },
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

  const accepted = await verifyEnvelopeWithTrust(
    fixture.envelope,
    { ...policy, allowedKinds: [...policy.allowedKinds] },
    dependencies,
    now,
  );
  const duplicate = await verifyEnvelopeWithTrust(
    fixture.envelope,
    { ...policy, allowedKinds: [...policy.allowedKinds] },
    dependencies,
    now,
  );
  assert.equal(accepted.disposition, 'ACCEPT');
  assert.equal(duplicate.disposition, 'DUPLICATE');
});

test('CloudEvent metadata carries the fixture without becoming a second trust boundary', () => {
  const event = { ...fixture.cloudEvent, data: fixture.envelope } as SporeCloudEvent<FederationCanaryPayload>;
  assert.equal(fromSporeCloudEvent(event), fixture.envelope);

  const tampered = structuredClone(event);
  tampered.source = 'organism:attacker';
  assert.throws(() => fromSporeCloudEvent(tampered), /does not match/);
});

test('published negative vectors reject signed-content tampering and wrong audience', () => {
  assert.equal(fixture.negativeVectors.length, 3);
  const tampered = structuredClone(fixture.envelope);
  tampered.payload.control.halted = true;
  const contentResult = verifyEnvelope(tampered, publicKey, {
    now,
    expectedAudience: 'gateway:dreamnet',
    clockSkewMs: 0,
  });
  assert.equal(contentResult.valid, false);
  assert.equal(contentResult.checks.contentId, false);
  assert.equal(contentResult.checks.signature, false);

  const audienceResult = verifyEnvelope(fixture.envelope, publicKey, {
    now,
    expectedAudience: 'gateway:attacker',
    clockSkewMs: 0,
  });
  assert.equal(audienceResult.valid, false);
  assert.equal(audienceResult.checks.audience, false);
});
