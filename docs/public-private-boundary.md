# Public and Private Boundary

The public SDK defines portable contracts and verification behavior. An
independent organism can implement those contracts without receiving access
to DreamNet's databases, credentials, deployment topology, prompts, private
datasets, or internal policies.

## Public SDK

- RFC 8785 canonicalization and SHA-256 content IDs
- Ed25519-signed `SporeEnvelope v1`
- immutable Proof Drop references
- fail-closed capability leases
- observation and portable artifact types
- deterministic conformance fixtures
- transport interfaces and local in-memory development transport

The package does not currently contain a complete Spore node runtime, health
server, Redis implementation, NATS implementation, Kafka implementation, key
registry, revocation service, or encrypted synchronization service.

## Runtime-owned responsibilities

Each organism retains authority over:

- identity and trusted-key resolution
- replay and revocation state
- workflow execution and recovery
- transport credentials and infrastructure
- private memory and datasets
- policy evaluation and human approvals
- budgets, settlement, and signing keys

Interoperability occurs through signed envelopes and explicit capabilities,
not shared database access or ambient trust.
