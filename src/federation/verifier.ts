/**
 * Spore Federation Envelope Verifier (V1 Freeze)
 * 
 * Enforces all 5 Adversarial Vectors:
 * 1. Strict Unknown Top-Level Field Rejection (UNKNOWN_FIELD_REJECTED)
 * 2. Payload / Digest Tampering Rejection (DIGEST_MISMATCH)
 * 3. Counterparty Cryptographic Signature Verification (INVALID_SIGNATURE)
 * 4. Temporal Expiry & Freshness Enforcement (ENVELOPE_EXPIRED)
 * 5. Consumed Nonce Replay Detection (409_REPLAY_ATTACK_DETECTED) vs Idempotent Retry (200 OK)
 */

import type { KeyObject } from 'node:crypto';
import { canonicalizeRfc8785, computeSha256, verifyRawSignature } from './crypto.js';
import type { SporeEnvelopeV1, SporeVerificationResult } from './types.js';

export const ALLOWED_TOP_LEVEL_FIELDS = new Set([
  'v',
  'type',
  'issuer',
  'recipient',
  'nonce',
  'created_at',
  'expires_at',
  'payload',
  'id',
  'signature',
  'key_id'
]);

export interface ValidationOptions {
  nowMs?: number;
  maxClockSkewMs?: number;
  maxLifetimeMs?: number;
  expectedIssuer?: string;
  expectedRecipient?: string;
  expectedKeyId?: string;
  // Single trusted peer/context, process-local only. Successful validation consumes the nonce.
  consumedNoncesStore?: Map<string, string>;
}

/**
 * Validates a Spore envelope against all protocol v1 security boundaries
 */
export function validateSporeEnvelope(
  counterpartyPublicKey: KeyObject | string,
  envelope: unknown,
  options: ValidationOptions = {}
): SporeVerificationResult {
  try {
    return { ...validate(counterpartyPublicKey, envelope, options), authorization: 'NOT_EVALUATED' };
  } catch {
    return { valid: false, code: 'MALFORMED_ENVELOPE', error: 'Envelope is outside the supported JSON domain', authorization: 'NOT_EVALUATED' };
  }
}

function validate(counterpartyPublicKey: KeyObject | string, envelope: unknown, options: ValidationOptions): SporeVerificationResult {
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) {
    return {
      valid: false,
      code: 'MALFORMED_ENVELOPE',
      error: 'Envelope must be a JSON object'
    };
  }

  const env = envelope as Record<string, unknown>;
  // Reject accessors, cycles, non-JSON values, and excessive resource use before inspecting fields.
  canonicalizeRfc8785(env);

  // 1. Vector 1: Unknown top-level field rejection (Fail-closed)
  for (const key of Object.keys(env)) {
    if (!ALLOWED_TOP_LEVEL_FIELDS.has(key)) {
      return {
        valid: false,
        code: 'UNKNOWN_FIELD_REJECTED',
        error: `Top-level field '${key}' is prohibited in SporeEnvelope v1. Extensible data must reside in 'payload'.`
      };
    }
  }

  // Check required fields
  const requiredFields = ['v', 'type', 'issuer', 'recipient', 'nonce', 'created_at', 'expires_at', 'payload', 'id', 'signature'];
  for (const field of requiredFields) {
    if (env[field] === undefined || env[field] === null) {
      return {
        valid: false,
        code: 'MISSING_REQUIRED_FIELD',
        error: `Required envelope field '${field}' is missing`
      };
    }
  }

  if (env.v !== 'spore-envelope-v1') {
    return {
      valid: false,
      code: 'UNSUPPORTED_PROTOCOL_VERSION',
      error: `Unsupported version '${env.v}'. Expected 'spore-envelope-v1'.`
    };
  }

  const stringFields = ['type', 'issuer', 'recipient', 'nonce', 'created_at', 'expires_at', 'id', 'signature'];
  if (stringFields.some(field => typeof env[field] !== 'string' || !(env[field] as string).trim() || (env[field] as string).length > 2048) ||
      (env.key_id !== undefined && (typeof env.key_id !== 'string' || !env.key_id.trim() || env.key_id.length > 2048)) ||
      !['mission', 'receipt', 'capability_query', 'event'].includes(env.type as string) ||
      !env.payload || typeof env.payload !== 'object' || Array.isArray(env.payload) ||
      !/^sha256:[a-f0-9]{64}$/.test(env.id as string) || !/^[a-f0-9]{128}$/.test(env.signature as string)) {
    return { valid: false, code: 'MALFORMED_ENVELOPE', error: 'Envelope field types or encodings are invalid' };
  }
  for (const [option, field] of [['expectedIssuer', 'issuer'], ['expectedRecipient', 'recipient'], ['expectedKeyId', 'key_id']] as const) {
    if (options[option] !== undefined && (typeof options[option] !== 'string' || !options[option] || options[option] !== env[field])) {
      return { valid: false, code: 'IDENTITY_CONTEXT_MISMATCH', error: `Envelope ${field} does not match trusted context` };
    }
  }

  const now = options.nowMs ?? Date.now();
  const maxSkew = options.maxClockSkewMs ?? 60_000;
  const maxLifetime = options.maxLifetimeMs ?? 86_400_000;
  const expiresAtMs = new Date(env.expires_at as string).getTime();
  const createdAtMs = new Date(env.created_at as string).getTime();
  if (!Number.isFinite(now) || !Number.isFinite(maxSkew) || maxSkew < 0 || maxSkew > 300_000 ||
      !Number.isFinite(maxLifetime) || maxLifetime <= 0 || maxLifetime > 86_400_000) {
    return { valid: false, code: 'INVALID_VERIFICATION_POLICY', error: 'Invalid verification clock or lifetime limits' };
  }
  if (!Number.isFinite(createdAtMs) || !Number.isFinite(expiresAtMs) ||
      new Date(createdAtMs).toISOString() !== env.created_at || new Date(expiresAtMs).toISOString() !== env.expires_at ||
      expiresAtMs <= createdAtMs || expiresAtMs - createdAtMs > maxLifetime) {
    return { valid: false, code: 'INVALID_TIMESTAMP', error: 'Envelope timestamps must be ordered UTC ISO dates within the lifetime limit' };
  }

  // 2. Vector 4: Expiry enforcement
  if (expiresAtMs + maxSkew <= now) {
    return {
      valid: false,
      code: 'ENVELOPE_EXPIRED',
      error: `Envelope expired at ${env.expires_at} (current time: ${new Date(now).toISOString()})`
    };
  }

  if (createdAtMs - maxSkew > now) {
    return {
      valid: false,
      code: 'FUTURE_TIMESTAMP_REJECTED',
      error: `Envelope created in the future: ${env.created_at}`
    };
  }

  // 3. Vector 2: Canonical RFC 8785 Digest verification
  const { id, signature, ...bodyWithoutSig } = env;
  const canonicalJson = canonicalizeRfc8785(bodyWithoutSig);
  const computedHash = computeSha256(canonicalJson);
  const expectedId = `sha256:${computedHash}`;

  if (id !== expectedId) {
    return {
      valid: false,
      code: 'DIGEST_MISMATCH',
      error: `Envelope ID '${id}' does not match computed RFC 8785 body digest '${expectedId}'`,
      computedHash
    };
  }

  // 4. Vector 3: Cryptographic Ed25519 signature check
  const sigHex = env.signature as string;
  const sigValid = verifyRawSignature(counterpartyPublicKey, computedHash, sigHex);
  if (!sigValid) {
    return {
      valid: false,
      code: 'INVALID_SIGNATURE',
      error: 'Ed25519 signature verification failed against counterparty public key'
    };
  }

  // 5. Vector 5: Nonce tracking & replay attack prevention
  if (options.consumedNoncesStore) {
    const nonce = env.nonce as string;
    const existingId = options.consumedNoncesStore.get(nonce);
    if (existingId) {
      if (existingId === (id as string)) {
        // Idempotent retry: valid replay of identical envelope
        return {
          valid: true,
          code: 'IDEMPOTENT_RETRY',
          computedHash
        };
      } else {
        // Replay attack: same nonce used for different payload
        return {
          valid: false,
          code: '409_REPLAY_ATTACK_DETECTED',
          error: `Nonce '${nonce}' was already consumed with a different envelope body (${existingId} vs ${id})`
        };
      }
    }
    // Atomic only within this synchronous invocation/process, never a durable admission guarantee.
    if (options.consumedNoncesStore.size >= 10_000) {
      return { valid: false, code: 'REPLAY_STORE_FULL', error: 'Replay store capacity reached; do not clear live claims to bypass it' };
    }
    options.consumedNoncesStore.set(nonce, id as string);
  }

  return {
    valid: true,
    code: 'VALID',
    computedHash
  };
}
