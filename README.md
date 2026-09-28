# @dreamnet/spore-sdk

> Public Interoperability Kit & Spore Federation Node Runtime for Independent Agent Civilizations.

`@dreamnet/spore-sdk` is the canonical, open-source reference implementation of the **Spore Federation Protocol (v1.0.0)**. It enables sovereign agent swarms, autonomous organizations, and peer civilizations to discover public federation endpoints, exchange cryptographically attested mission envelopes, and verify execution receipts across independent infrastructure boundaries without sharing private codebase access, shared database states, or internal network topology.

---

## Architecture & Sovereign Membrane

Every Spore-compatible node exposes a public discovery manifest at `/.well-known/spore` and exchanges signed envelopes over standard HTTP.

```text
Peer Civilization (e.g. ZABAL)
               │
               ▼
https://dreamnet.ink/.well-known/spore
   ├── protocol_version: "1.0.0"
   ├── civilization_id:  "did:civilization:dreamnet"
   ├── public_keys:      [ Ed25519VerificationKey2020 ]
   ├── endpoints:        { inbound_mission_push, inbound_receipt_push, ... }
   └── sdk:              { repository, version, commit, conformance_command }
               │
               ▼
     @dreamnet/spore-sdk
   ├── RFC 8785 JCS Canonicalization
   ├── SHA-256 Binary Digest Hashing
   ├── Ed25519 Cryptographic Signatures
   └── 10-Stage Conformance Verification
```

---

## Wire Format & Cryptographic Invariants

Spore v1 enforces strict wire-level invariants across all participating systems:

1. **Strict Top-Level Field Bounding**:
   Envelopes permit *only* the following top-level keys:
   `['v', 'type', 'issuer', 'recipient', 'nonce', 'created_at', 'expires_at', 'payload', 'id', 'signature', 'key_id']`. Any extra top-level field triggers `UNKNOWN_FIELD_REJECTED`.
2. **Deterministic Canonicalization (RFC 8785 / JCS)**:
   The envelope body (all fields except `signature` and `id`) is serialized using the RFC 8785 JSON Canonicalization Scheme.
3. **Cryptographic Identity (`id`)**:
   `id` is `sha256:` followed by the lowercase SHA-256 hex digest of the RFC 8785 canonical body. Whitespace and object key order do not change the digest; changed JSON values do.
4. **Signature Verification**:
   The Ed25519 signature is computed over the **32 binary SHA-256 digest bytes**, NOT the canonical JSON bytes and NOT the hex text. It is encoded as exactly 128 lowercase hex characters. Verification requires a trusted issuer-to-key binding, not merely a key advertised by the sender.
5. **Freshness & Expiry**:
   Envelopes past `expires_at` (+ configurable clock skew) trigger `ENVELOPE_EXPIRED`.
6. **Idempotent Retry vs Replay Prevention**:
   - Matching `nonce` + matching `id`: Allowed as an **idempotent retry** (HTTP 200).
   - Matching `nonce` + differing `id`: Rejected as an adversarial replay (HTTP 409 `409_REPLAY_ATTACK_DETECTED`).

### Verification is not authority

Receiving a valid envelope confers zero authority. Every verifier result reports
`authorization: NOT_EVALUATED`. The receiving application must independently enforce
identity/key binding, intended recipient, current admission, a scoped unexpired and
non-revoked AuthorityLease, resource budgets, and an atomic durable nonce claim before
performing effects. A valid manifest digest proves content consistency, not trusted identity.

`consumedNoncesStore` is optional process-local testing support for one trusted peer/context.
Validation now synchronously records successful nonces in that Map; callers must not
assume a fresh Map provides restart or multi-process replay protection. At 10,000 entries
it fails closed. Production must use its existing durable admission/replay service and
return cached receipts for duplicate deliveries. Never execute effects for `IDEMPOTENT_RETRY`.

Use `expectedIssuer`, `expectedRecipient`, and `expectedKeyId` from trusted receiver
configuration, never from the incoming payload. Expiry is exclusive, timestamps must
be UTC ISO strings, and envelope lifetime is limited to 24 hours (or a smaller configured
`maxLifetimeMs`). `maxClockSkewMs` cannot exceed five minutes.

### Canonical input profile

Independent implementers can use [the complete signed reference vector](fixtures/spore-envelope-v1.json).
It contains canonical JSON, digest/signing preimage, public key, signature, and fixed
verification time. It is an inert public test identity, never a production trust root.

Observation and federation now share one JSON-only canonicalization implementation.
Finite numbers (including negative zero), Unicode scalar strings, dense arrays, and
plain objects are accepted. Undefined, Date instances, sparse arrays, hidden fields,
accessors, cycles, and invalid Unicode are rejected. Limits: depth 64, 100,000 values,
and 1 MiB canonical UTF-8 output. Historical algorithm labels and hashes remain intact;
supported ordinary JSON produces the same bytes. Unsupported JavaScript extensions
are not silently normalized. This tightening is intentional.

---

## Bilateral Golden Vector

All compliant Spore v1 runtimes must reproduce the exact golden hash for this canonical test envelope:

```json
{
  "created_at": "2026-09-10T01:58:00.000Z",
  "expires_at": "2026-09-10T02:03:00.000Z",
  "issuer": "did:civilization:zabal",
  "nonce": "nonce-9f3a1c8b2047e1d5",
  "payload": {
    "challenge_seed": "seed-78921-zabal-boundary",
    "mission_id": "msn-canary-001-d2z",
    "operation": "CANARY_ECHO_EFFECT",
    "requested_effect": "echo_canary"
  },
  "recipient": "did:civilization:dreamnet",
  "type": "mission",
  "v": "spore-envelope-v1"
}
```

**Expected SHA-256 Digest**:
```text
310934631157283079e9eaaee35984bd49ece5ebd923cb93d5eb32691f4649c4
```

---

## Installation

```bash
npm install @dreamnet/spore-sdk
# or
pnpm add @dreamnet/spore-sdk
```

---

## Conformance Verification

To verify that your local environment passes all 10 conformance stages, including the golden vector, Ed25519 roundtrips, and all 5 adversarial attack vectors:

```bash
pnpm test:conformance
```

Output:
```text
═══════════════════════════════════════════════════════════════════════
   SPORE FEDERATION PROTOCOL V1 CONFORMANCE SUITE (RFC 8785 / JCS)     
═══════════════════════════════════════════════════════════════════════

▶ Stage 1: RFC 8785 JCS Canonicalization & Bilateral Golden Vector...
  ✅ Canonical JSON verified
  ✅ Golden SHA-256 Digest matches exact bilateral vector: 310934631157283079e9eaaee35984bd49ece5ebd923cb93d5eb32691f4649c4
▶ Stage 2: Sovereign Ed25519 Keypair Generation & Signing...
  ✅ Ed25519 keypairs generated and cryptographic signature verified.
▶ Stage 3: SporeClient Envelope Creation & Roundtrip Verification...
  ✅ SporeEnvelope v1 generated and validated cleanly.
▶ Stage 4: Application Receipt Envelope Creation & Verification...
  ✅ ApplicationReceipt envelope verified cleanly.
▶ Stage 5: Adversarial Vector 1 — Unknown Top-Level Field Rejection...
  ✅ Vector 1 rejected fail-closed (UNKNOWN_FIELD_REJECTED).
▶ Stage 6: Adversarial Vector 2 — Payload / Digest Tampering Rejection...
  ✅ Vector 2 rejected fail-closed (DIGEST_MISMATCH).
▶ Stage 7: Adversarial Vector 3 — Signature Forgery Rejection...
  ✅ Vector 3 rejected fail-closed (INVALID_SIGNATURE).
▶ Stage 8: Adversarial Vector 4 — Expired Envelope Rejection...
  ✅ Vector 4 rejected fail-closed (ENVELOPE_EXPIRED).
▶ Stage 9: Adversarial Vector 5 — Consumed Nonce Replay Attack vs Idempotent Retry...
  ✅ Idempotent retry permitted (same nonce + same digest).
  ✅ Nonce replay attack rejected (409_REPLAY_ATTACK_DETECTED).
▶ Stage 10: Manifest Integrity & Digest Verification...
  ✅ Manifest digest verified cleanly.

🎉 ALL 10 CONFORMANCE STAGES PASSED deterministically!
```

---

## Quickstart

### 1. Generating a Keypair

```typescript
import { generateSporeKeypair } from '@dreamnet/spore-sdk';

const { publicKeyPem, privateKeyPem } = generateSporeKeypair();
```

### 2. Discovering a Remote Peer's Manifest

```typescript
import { SporeClient } from '@dreamnet/spore-sdk';

// Discovers and validates manifest_digest integrity
const peerManifest = await SporeClient.fetchManifest('https://dreamnet.ink/.well-known/spore');
console.log('Peer DID:', peerManifest.civilization_id);
console.log('Inbound Endpoint:', peerManifest.endpoints.inbound_mission_push);
```

### 3. Signing an Outbound Mission Envelope

```typescript
import { SporeClient } from '@dreamnet/spore-sdk';

const envelope = SporeClient.createEnvelope({
  type: 'mission',
  issuer: 'did:civilization:my-swarm',
  recipient: 'did:civilization:dreamnet',
  payload: {
    mission_id: 'msn-001',
    operation: 'CANARY_ECHO_EFFECT',
    challenge_seed: 'seed-xyz'
  },
  privateKey: privateKeyPem,
  keyId: 'my-key-01'
});

console.log('Signed Envelope ID:', envelope.id);
console.log('Signature:', envelope.signature);
```

### 4. Verifying an Inbound Envelope

```typescript
import { SporeClient } from '@dreamnet/spore-sdk';

const result = SporeClient.verifyEnvelope(peerPublicKeyPem, incomingEnvelope);

if (!result.valid) {
  console.error(`Rejected: ${result.code} - ${result.error}`);
} else {
  console.log('Envelope verified cryptographically.');
}
```

---

## License

Apache-2.0. See [LICENSE](./LICENSE), [NOTICE](./NOTICE), and [TRADEMARKS.md](./TRADEMARKS.md) for details.
