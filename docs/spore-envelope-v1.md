# Spore Envelope v1

## Purpose

Spore is the evidence, trust, and lineage layer between sovereign runtimes.
It does not replace A2A task exchange, MCP tool access, Temporal workflow
durability, or an organism's internal database.

## Signed Boundary

Every envelope signs and content-addresses the complete unsigned envelope:

- protocol version and artifact kind
- issuer and key identifier
- subject, issue time, expiry, nonce, and audience
- schema and payload
- parent, dependency, and policy references
- privacy classification

The content digest is:

```text
SHA-256("spore-envelope.v1:<KIND>" || NUL || RFC8785(unsigned-envelope))
```

The content ID is:

```text
spore:<kind>:sha256:<digest>
```

Ed25519 signs the same domain-separated canonical bytes. The `id`, `hash`, and
`signature` fields are excluded from those bytes because they are derived from
the unsigned envelope.

## Proof Drops

A `proof-drop.v1` payload contains complete SHA-256 references to an execution
trace, supporting evidence, and outputs, plus runtime provenance. Placeholder
hashes are rejected.

Proof Drops do not contain mutable verification or claim status. A verifier
emits a separate `VERIFICATION` envelope and a Claim Factory emits a separate
`CLAIM` or `COUNTERCLAIM` envelope. Each references the Proof Drop content ID.

## Leases

A `spore-lease.v1` payload identifies one tenant, one spore, one policy, an
activation time, a state, and an explicit capability list. Authorization is
default-deny. There is no automatic lease creation and no wildcard capability.

A runtime must additionally maintain replay and revocation state. The SDK's
pure verifier checks signature, content ID, freshness, audience, state,
tenant, spore, and capability but deliberately does not hide a process-local
replay cache inside the protocol primitive.

## Runtime Responsibilities

Implementations must provide:

1. trusted issuer key resolution and rotation;
2. durable nonce/replay tracking;
3. revocation and supersession lookup;
4. immutable artifact storage for referenced content;
5. transport acknowledgement, retry, and dead-letter behavior;
6. policy evaluation and independent verification receipts.

NATS JetStream and Temporal Nexus adapters belong above these contracts. They
must consume the same golden vectors and cannot redefine the envelope.
