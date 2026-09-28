import { writeFileSync, mkdirSync } from 'node:fs';
import { canonicalizeRfc8785, generateSporeKeypair, signEnvelopeBody, computeSha256 } from '../dist/federation/crypto.js';

// Public interoperability fixture only. The random private key is discarded, never exported.
const keys = generateSporeKeypair();
const body = { v: 'spore-envelope-v1', type: 'mission', issuer: 'did:example:spore-test',
  recipient: 'did:example:receiver', nonce: 'public-offline-vector-0001',
  created_at: '2026-09-27T19:59:00.000Z', expires_at: '2026-09-27T20:04:00.000Z',
  payload: { classification: 'TEST_ONLY_NO_AUTHORITY', operation: 'inert_echo', value: 'hello' } };
const canonical = canonicalizeRfc8785(body);
const digest = computeSha256(canonical);
const signed = signEnvelopeBody(keys.privateKey, body);
const vector = { classification: 'PUBLIC_TEST_VECTOR_NOT_A_TRUSTED_ISSUER',
  protocol: 'spore-envelope-v1', canonical_json: canonical, digest_hex: digest,
  signing_preimage_hex: digest, signing_rule: 'Ed25519 over 32 binary SHA-256 digest bytes',
  public_key_pem: keys.publicKeyPem, envelope: { ...body, ...signed },
  verification_time: '2026-09-27T20:00:00.000Z', expected: { valid: true, authorization: 'NOT_EVALUATED' } };
mkdirSync(new URL('../fixtures/', import.meta.url), { recursive: true });
writeFileSync(new URL('../fixtures/spore-envelope-v1.json', import.meta.url), JSON.stringify(vector, null, 2) + '\n');
