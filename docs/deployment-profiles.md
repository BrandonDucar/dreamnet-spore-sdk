# Spore Deployment Profiles

Only the local profile is implemented in this repository today. The other
profiles describe adapter targets and must not be treated as deployed runtime
capabilities.

## Local profile

- Transport: `InMemoryTransport`
- Verification: local RFC 8785, SHA-256, and Ed25519 operations
- Persistence: none
- Best for: deterministic protocol tests and adapter development

`InMemoryTransport` is process-local. Subscriber failures are not durable and
there is no acknowledgement or replay mechanism.

## Durable worker profile

Status: planned.

The existing `RedisStreamsTransport` is a logging placeholder. It does not
perform Redis commands and must not be used for production delivery.

A production implementation must provide consumer groups, explicit
acknowledgement, idempotency, retry, backpressure, dead-letter handling,
metrics, and replay tests.

## Federated organism profile

Status: planned.

The intended runtime uses NATS JetStream for durable event transport and
Temporal Nexus for cross-organism workflows. Neither adapter is implemented
in this public package yet. Both must consume `SporeEnvelope v1` unchanged and
pass the repository's golden vectors before being advertised as compatible.
