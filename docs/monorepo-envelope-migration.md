# Monorepo Envelope Migration

The July 2026 monorepo prototype used the version string
`spore-envelope-v1`, a payload-only content hash, and an undeclared signature
encoding. Its metadata was not part of the signature scope. Changing `type`,
`issuer`, `created_at`, or `expires_at` could therefore leave its verification
result unchanged.

Those objects are compatibility inputs, not trusted `SporeEnvelope v1`
objects. The SDK recognizes them only to support controlled migration:

```text
legacy object
  -> assessLegacyMonorepoEnvelope
  -> QUARANTINE
  -> validate payload against an approved schema
  -> createLegacyReissueDraft with a trusted issuer, audience and nonce
  -> sign the complete draft with Ed25519
  -> verifyEnvelopeWithTrust
  -> ACCEPT, DUPLICATE or REJECT
```

`createLegacyReissueDraft` preserves the payload only. It deliberately does
not promote the legacy ID, issuer, or signature into the new trust boundary.
Migration services should store those source fields in a separate audit
record and link the new receipt to that record.

## Version distinction

- `spore-envelope-v1`: legacy monorepo compatibility input.
- `spore-envelope.v1`: canonical public protocol contract.

The public package remains an alpha until independent runtimes pass the same
conformance fixtures. A monorepo package must not publish itself as `1.0.0`
or redefine the envelope contract.
