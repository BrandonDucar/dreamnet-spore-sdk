/**
 * Spore Federation Protocol V1 Conformance Verification Suite
 * 
 * Verifies that a Spore implementation satisfies every byte-level contract
 * required for sovereign inter-civilization interoperability.
 */

import assert from 'node:assert/strict';
import {
  canonicalizeRfc8785,
  computeSha256,
  generateSporeKeypair,
  signEnvelopeBody,
  verifyRawSignature
} from './crypto.js';
import { validateSporeEnvelope } from './verifier.js';
import { SporeClient } from './client.js';
import type { SporeManifestV1 } from './types.js';

export async function runSporeConformanceSuite(): Promise<{
  passed: boolean;
  stagesCompleted: number;
  goldenVectorHash: string;
}> {
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('   SPORE FEDERATION PROTOCOL V1 CONFORMANCE SUITE (RFC 8785 / JCS)     ');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  // ---------------------------------------------------------------------------
  // Stage 1: RFC 8785 Canonicalization & Golden Vector Hash
  // ---------------------------------------------------------------------------
  console.log('▶ Stage 1: RFC 8785 JCS Canonicalization & Bilateral Golden Vector...');
  const goldenBody = {
    v: 'spore-envelope-v1',
    type: 'mission',
    issuer: 'did:civilization:zabal',
    recipient: 'did:civilization:dreamnet',
    nonce: 'nonce-9f3a1c8b2047e1d5',
    created_at: '2026-09-10T01:58:00.000Z',
    expires_at: '2026-09-10T02:03:00.000Z',
    payload: {
      mission_id: 'msn-canary-001-d2z',
      operation: 'CANARY_ECHO_EFFECT',
      challenge_seed: 'seed-78921-zabal-boundary',
      requested_effect: 'echo_canary'
    }
  };

  const canonicalJson = canonicalizeRfc8785(goldenBody);
  const goldenHash = computeSha256(canonicalJson);
  const expectedGoldenHash = '310934631157283079e9eaaee35984bd49ece5ebd923cb93d5eb32691f4649c4';

  assert.equal(
    goldenHash,
    expectedGoldenHash,
    `Golden vector mismatch! Got '${goldenHash}', expected '${expectedGoldenHash}'`
  );
  console.log(`  ✅ Canonical JSON verified: ${canonicalJson}`);
  console.log(`  ✅ Golden SHA-256 Digest matches exact bilateral vector: ${goldenHash}\n`);

  // ---------------------------------------------------------------------------
  // Stage 2: Ed25519 Keypair Generation & Cryptographic Sign / Verify
  // ---------------------------------------------------------------------------
  console.log('▶ Stage 2: Sovereign Ed25519 Keypair Generation & Signing...');
  const zabalKeys = generateSporeKeypair();
  const dreamnetKeys = generateSporeKeypair();

  assert.ok(zabalKeys.publicKeyPem.includes('BEGIN PUBLIC KEY'), 'Invalid ZABAL public key PEM');
  assert.ok(dreamnetKeys.publicKeyPem.includes('BEGIN PUBLIC KEY'), 'Invalid DreamNet public key PEM');

  const { id, signature } = signEnvelopeBody(zabalKeys.privateKey, goldenBody);
  assert.equal(id, `sha256:${expectedGoldenHash}`);
  assert.equal(signature.length, 128, 'Ed25519 signature must be 128 hex characters');

  const rawSigValid = verifyRawSignature(zabalKeys.publicKey, expectedGoldenHash, signature);
  assert.equal(rawSigValid, true, 'Raw Ed25519 signature verification failed');
  console.log('  ✅ Ed25519 keypairs generated and cryptographic signature verified.\n');

  // ---------------------------------------------------------------------------
  // Stage 3: SporeClient Envelope Creation & Verification Roundtrip
  // ---------------------------------------------------------------------------
  console.log('▶ Stage 3: SporeClient Envelope Creation & Roundtrip Verification...');
  const envelope = SporeClient.createEnvelope({
    type: 'mission',
    issuer: 'did:civilization:zabal',
    recipient: 'did:civilization:dreamnet',
    payload: {
      mission_id: 'msn-test-001',
      task: 'ECHO_CANARY'
    },
    privateKey: zabalKeys.privateKey,
    keyId: 'zabal-primary-key'
  });

  const validResult = SporeClient.verifyEnvelope(zabalKeys.publicKey, envelope);
  assert.equal(validResult.valid, true, `Envelope failed verification: ${validResult.error}`);
  assert.equal(validResult.code, 'VALID');
  console.log('  ✅ SporeEnvelope v1 generated and validated cleanly.\n');

  // ---------------------------------------------------------------------------
  // Stage 4: Application Receipt Envelope Creation & Verification
  // ---------------------------------------------------------------------------
  console.log('▶ Stage 4: Application Receipt Envelope Creation & Verification...');
  const receiptEnvelope = SporeClient.createReceiptEnvelope({
    issuer: 'did:civilization:dreamnet',
    recipient: 'did:civilization:zabal',
    receipt: {
      receipt_id: 'rcpt-echo-1001',
      mission_id: 'msn-test-001',
      original_envelope_id: envelope.id,
      state: 'completed',
      original_payload_hash: envelope.id,
      observed_effect_hash: `sha256:${computeSha256('echo_success')}`,
      completed_at: new Date().toISOString()
    },
    privateKey: dreamnetKeys.privateKey,
    keyId: 'dreamnet-edge-primary'
  });

  const receiptValid = SporeClient.verifyEnvelope(dreamnetKeys.publicKey, receiptEnvelope);
  assert.equal(receiptValid.valid, true, `Receipt envelope failed: ${receiptValid.error}`);
  console.log('  ✅ ApplicationReceipt envelope verified cleanly.\n');

  // ---------------------------------------------------------------------------
  // Stage 5: Adversarial Vector 1 — Unknown Top-Level Field Rejection
  // ---------------------------------------------------------------------------
  console.log('▶ Stage 5: Adversarial Vector 1 — Unknown Top-Level Field Rejection...');
  const vector1Tampered = {
    ...envelope,
    extra_unauthorized_field: 'malicious_injection'
  };
  const v1Result = validateSporeEnvelope(zabalKeys.publicKey, vector1Tampered);
  assert.equal(v1Result.valid, false);
  assert.equal(v1Result.code, 'UNKNOWN_FIELD_REJECTED');
  console.log('  ✅ Vector 1 rejected fail-closed (UNKNOWN_FIELD_REJECTED).\n');

  // ---------------------------------------------------------------------------
  // Stage 6: Adversarial Vector 2 — Payload / Digest Tampering Rejection
  // ---------------------------------------------------------------------------
  console.log('▶ Stage 6: Adversarial Vector 2 — Payload / Digest Tampering Rejection...');
  const vector2Tampered = {
    ...envelope,
    payload: {
      mission_id: 'msn-test-001',
      task: 'ALTERED_TASK_TAMPER'
    }
  };
  const v2Result = validateSporeEnvelope(zabalKeys.publicKey, vector2Tampered);
  assert.equal(v2Result.valid, false);
  assert.equal(v2Result.code, 'DIGEST_MISMATCH');
  console.log('  ✅ Vector 2 rejected fail-closed (DIGEST_MISMATCH).\n');

  // ---------------------------------------------------------------------------
  // Stage 7: Adversarial Vector 3 — Signature Forgery Rejection
  // ---------------------------------------------------------------------------
  console.log('▶ Stage 7: Adversarial Vector 3 — Signature Forgery Rejection...');
  const vector3Tampered = {
    ...envelope,
    signature: 'a'.repeat(128)
  };
  const v3Result = validateSporeEnvelope(zabalKeys.publicKey, vector3Tampered);
  assert.equal(v3Result.valid, false);
  assert.equal(v3Result.code, 'INVALID_SIGNATURE');
  console.log('  ✅ Vector 3 rejected fail-closed (INVALID_SIGNATURE).\n');

  // ---------------------------------------------------------------------------
  // Stage 8: Adversarial Vector 4 — Expired Envelope Rejection
  // ---------------------------------------------------------------------------
  console.log('▶ Stage 8: Adversarial Vector 4 — Expired Envelope Rejection...');
  const pastEnvelope = SporeClient.createEnvelope({
    type: 'mission',
    issuer: 'did:civilization:zabal',
    recipient: 'did:civilization:dreamnet',
    payload: { task: 'EXPIRED' },
    privateKey: zabalKeys.privateKey,
    ttlMs: 100
  });
  // Simulate 10 minutes in the future
  const futureNow = Date.now() + 600_000;
  const v4Result = validateSporeEnvelope(zabalKeys.publicKey, pastEnvelope, { nowMs: futureNow });
  assert.equal(v4Result.valid, false);
  assert.equal(v4Result.code, 'ENVELOPE_EXPIRED');
  console.log('  ✅ Vector 4 rejected fail-closed (ENVELOPE_EXPIRED).\n');

  // ---------------------------------------------------------------------------
  // Stage 9: Adversarial Vector 5 — Consumed Nonce Replay Attack vs Idempotent Retry
  // ---------------------------------------------------------------------------
  console.log('▶ Stage 9: Adversarial Vector 5 — Consumed Nonce Replay Attack vs Idempotent Retry...');
  const consumedNonces = new Map();
  consumedNonces.set(envelope.nonce, envelope.id); // Nonce consumed by initial envelope

  // 9a: Exact same envelope retried -> IDEMPOTENT_RETRY (200 OK semantics)
  const retryResult = validateSporeEnvelope(zabalKeys.publicKey, envelope, {
    consumedNoncesStore: consumedNonces
  });
  assert.equal(retryResult.valid, true);
  assert.equal(retryResult.code, 'IDEMPOTENT_RETRY');
  console.log('  ✅ Idempotent retry permitted (same nonce + same digest).');

  // 9b: Same nonce used with different payload -> 409 REPLAY_ATTACK_DETECTED
  const replayEnvelope = SporeClient.createEnvelope({
    type: 'mission',
    issuer: 'did:civilization:zabal',
    recipient: 'did:civilization:dreamnet',
    payload: { task: 'DIFFERENT_PAYLOAD_REPLAY' },
    privateKey: zabalKeys.privateKey,
    nonce: envelope.nonce // Reused consumed nonce
  });
  const replayResult = validateSporeEnvelope(zabalKeys.publicKey, replayEnvelope, {
    consumedNoncesStore: consumedNonces
  });
  assert.equal(replayResult.valid, false);
  assert.equal(replayResult.code, '409_REPLAY_ATTACK_DETECTED');
  console.log('  ✅ Nonce replay attack rejected (409_REPLAY_ATTACK_DETECTED).\n');

  // ---------------------------------------------------------------------------
  // Stage 10: Spore Manifest Digest Verification
  // ---------------------------------------------------------------------------
  console.log('▶ Stage 10: Manifest Integrity & Digest Verification...');
  const testManifestBody = {
    v: 'spore-manifest-v1' as const,
    protocol_version: '1.0.0',
    civilization_id: 'did:civilization:dreamnet',
    name: 'DreamNet Sovereign Federation Hub',
    description: 'Autonomous multi-runtime AI civilization.',
    public_keys: [
      {
        key_id: 'test-key',
        type: 'Ed25519VerificationKey2020' as const,
        purpose: 'federation-edge',
        publicKeyPem: dreamnetKeys.publicKeyPem,
        status: 'ACTIVE' as const
      }
    ],
    supported_protocols: ['spore-v1'],
    endpoints: {
      inbound_mission_push: 'https://dreamnet.ink/api/v1/federation/missions',
      inbound_receipt_push: 'https://dreamnet.ink/api/v1/federation/receipts',
      outbound_inbox_pull: 'https://dreamnet.ink/api/v1/federation/inbox',
      proof_of_possession: 'https://dreamnet.ink/api/v1/federation/peers/register',
      credential_verification: 'https://dreamnet.ink/api/v1/federation/credentials',
      state_inspection: 'https://dreamnet.ink/api/v1/federation/state'
    },
    addressing_conventions: {
      internal_agents: 'agent:dreamnet:<agent_name>',
      external_peers: 'did:civilization:<peer_name>',
      routing_pattern: 'federation.<civilization_name>.<missions|receipts>'
    },
    created_at: '2026-09-10T00:00:00.000Z',
    expires_at: '2027-09-10T00:00:00.000Z',
    status: 'ACTIVE'
  };

  const manifestCanonical = canonicalizeRfc8785(testManifestBody);
  const manifestDigest = `sha256:${computeSha256(manifestCanonical)}`;
  const validManifest: SporeManifestV1 = {
    ...testManifestBody,
    manifest_digest: manifestDigest
  };

  const manifestValid = SporeClient.verifyManifestIntegrity(validManifest);
  assert.equal(manifestValid, true);
  console.log('  ✅ Manifest digest verified cleanly.\n');

  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('🎉 ALL 10 CONFORMANCE STAGES PASSED deterministically!');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  return {
    passed: true,
    stagesCompleted: 10,
    goldenVectorHash: expectedGoldenHash
  };
}
