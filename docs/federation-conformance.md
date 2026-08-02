# Federation Conformance

`test/fixtures/federation-canary-v1.json` is the language-neutral acceptance
target for a ZAO-to-DreamNet federation gateway. It contains:

- the public Ed25519 test key in SPKI DER form;
- the exact RFC 8785 canonical unsigned envelope;
- the signed `TRAPPER_ACCEPTED` canary envelope;
- the expected content ID and signature;
- the CloudEvents 1.0 transport metadata; and
- negative vectors for signed-content, transport-metadata, and audience
  tampering.

The key is RFC 8032 test material. It is public conformance data and must never
be accepted as an operational issuer identity.

## Required implementation result

An implementation conforms when it independently produces all of these
results:

1. Canonical unsigned bytes exactly match `canonicalUnsigned`.
2. The content digest is
   `c8245a69047a4cba79de74a40f5e236ff7d0052df4989f09578f35371c749a7f`.
3. The Ed25519 signature verifies with the supplied public key.
4. The expected audience is `gateway:dreamnet`.
5. First durable admission is `ACCEPT`.
6. Exact redelivery is `DUPLICATE` with no repeated side effects.
7. Nonce reuse with different content is `REJECT`.
8. Every published negative vector is `REJECT`.

CloudEvents is a transport wrapper. Matching its metadata is necessary, but it
does not replace envelope signature, schema, freshness, revocation, replay, or
policy verification.

## Operator rule

Conformance proves compatible implementation, not production authorization.
An external organism still requires a trusted operational key, a scoped policy,
durable replay and revocation stores, and an approved Federation Canary.
