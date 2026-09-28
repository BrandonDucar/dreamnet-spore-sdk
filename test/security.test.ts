import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash, verify } from 'node:crypto';
import { canonicalJsonStringify } from '../src/contracts/index.js';
import { canonicalizeRfc8785, generateSporeKeypair, signEnvelopeBody } from '../src/federation/crypto.js';
import { validateSporeEnvelope } from '../src/federation/verifier.js';

const keys = generateSporeKeypair();
const nowMs = Date.parse('2026-09-27T20:00:00.000Z');
const body = { v: 'spore-envelope-v1', type: 'mission', issuer: 'did:example:fixture',
  recipient: 'did:example:receiver', nonce: 'fixture-offline-0001',
  created_at: '2026-09-27T19:59:00.000Z', expires_at: '2026-09-27T20:04:00.000Z',
  payload: { classification: 'TEST_ONLY', action: 'inert' } };
function signed(patch: Record<string, unknown> = {}) {
  const value = { ...structuredClone(body), ...patch };
  return { ...value, ...signEnvelopeBody(keys.privateKey, value) };
}
const check = (env: unknown, options = {}) => validateSporeEnvelope(keys.publicKey, env, { nowMs, maxClockSkewMs: 0, ...options });

test('valid signatures are over binary digest bytes, never authority', () => {
  const env = signed(); const bytes = Buffer.from(canonicalizeRfc8785(body)); const sig = Buffer.from(env.signature, 'hex');
  assert.equal(verify(null, createHash('sha256').update(bytes).digest(), keys.publicKey, sig), true);
  assert.equal(verify(null, bytes, keys.publicKey, sig), false);
  assert.equal(check(env).valid, true); assert.equal(check(env).authorization, 'NOT_EVALUATED');
});
for (const patch of [
  { created_at: 'not-a-date' }, { expires_at: 'not-a-date' },
  { expires_at: body.created_at }, { expires_at: '2026-10-01T20:00:00.000Z' },
  { created_at: '2026-09-27T19:59:00Z' }, { type: 'unknown' },
  { issuer: 7 }, { recipient: {} }, { nonce: [] }, { nonce: '' }, { payload: [] }, { key_id: 123 },
]) test(`rejects signed malformed fields ${JSON.stringify(patch)}`, () => assert.equal(check(signed(patch)).valid, false));

test('expiry is exclusive and policy clocks fail closed', () => {
  assert.equal(check(signed(), { nowMs: Date.parse(body.expires_at) }).code, 'ENVELOPE_EXPIRED');
  for (const options of [{ nowMs: NaN }, { maxClockSkewMs: Infinity }, { maxClockSkewMs: -1 }, { maxLifetimeMs: -1 }]) {
    assert.equal(check(signed(), options).valid, false);
  }
});
test('all trust-context bindings reject mismatches', () => {
  for (const option of ['expectedIssuer', 'expectedRecipient', 'expectedKeyId']) assert.equal(check(signed(), { [option]: 'wrong' }).valid, false);
  assert.equal(check(signed(), { expectedIssuer: body.issuer, expectedRecipient: body.recipient }).valid, true);
});
test('signature encodings reject suffixes, truncation and uppercase', () => {
  const env = signed();
  for (const signature of [env.signature + 'zz', env.signature.slice(2), env.signature.toUpperCase()]) assert.equal(check({ ...env, signature }).valid, false);
});
test('process-local successful nonce consumption distinguishes retry and conflict', () => {
  const store = new Map<string, string>(); const env = signed();
  assert.equal(check(env, { consumedNoncesStore: store }).code, 'VALID');
  assert.equal(store.get(body.nonce), env.id);
  assert.equal(check(env, { consumedNoncesStore: store }).code, 'IDEMPOTENT_RETRY');
  assert.equal(check(signed({ payload: { action: 'different' } }), { consumedNoncesStore: store }).code, '409_REPLAY_ATTACK_DETECTED');
});
test('invalid envelope does not consume a nonce and full store fails closed', () => {
  const store = new Map<string, string>(); const env = signed();
  assert.equal(check({ ...env, signature: 'a'.repeat(128) }, { consumedNoncesStore: store }).valid, false);
  assert.equal(store.size, 0);
  for (let i = 0; i < 10_000; i++) store.set(String(i), 'test');
  assert.equal(check(env, { consumedNoncesStore: store }).code, 'REPLAY_STORE_FULL');
});
test('JSON paths share bytes for ordinary data and preserve negative zero semantics', () => {
  for (const input of [null, true, { '10': 10, '2': 2 }, { n: -0 }, { z: '\ud83d\ude00', a: 'e\u0301' }]) assert.equal(canonicalJsonStringify(input), canonicalizeRfc8785(input));
  assert.equal(canonicalizeRfc8785({ n: -0 }), '{"n":0}');
});
test('both paths reject unsupported input without calling accessors', () => {
  let calls = 0; const accessor = { get value() { calls++; return 1; } };
  const cycle: any = {}; cycle.self = cycle;
  const values = [{ a: undefined }, new Array(2), new Date(), { text: '\ud800' }, NaN, Infinity, cycle, accessor, { toJSON: () => ({}) }];
  for (const input of values) for (const serialize of [canonicalJsonStringify, canonicalizeRfc8785]) assert.throws(() => serialize(input));
  assert.equal(calls, 0);
});
test('deep and oversized inputs reject within explicit budgets', () => {
  let deep: unknown = 0; for (let i = 0; i < 66; i++) deep = { next: deep };
  assert.throws(() => canonicalizeRfc8785(deep));
  assert.throws(() => canonicalizeRfc8785({ text: 'x'.repeat(1_048_577) }));
  assert.throws(() => canonicalizeRfc8785(new Array(100_001).fill(null)));
});
test('hostile canonicalization failures return structured rejection', () => {
  const env: any = signed(); env.payload.self = env.payload;
  assert.equal(check(env).code, 'MALFORMED_ENVELOPE');
});
test('public reference vector reproduces bytes, digest and signature without its private key', () => {
  const fixture = JSON.parse(readFileSync(new URL('../fixtures/spore-envelope-v1.json', import.meta.url), 'utf8'));
  const { id, signature, ...unsigned } = fixture.envelope;
  assert.equal(canonicalizeRfc8785(unsigned), fixture.canonical_json);
  assert.equal(createHash('sha256').update(fixture.canonical_json).digest('hex'), fixture.digest_hex);
  assert.equal(id, `sha256:${fixture.digest_hex}`);
  assert.equal(verify(null, Buffer.from(fixture.signing_preimage_hex, 'hex'), fixture.public_key_pem, Buffer.from(signature, 'hex')), true);
  assert.equal(validateSporeEnvelope(fixture.public_key_pem, fixture.envelope, { nowMs: Date.parse(fixture.verification_time) }).valid, true);
});
