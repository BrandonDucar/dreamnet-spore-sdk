# DreamNet Spore SDK

Portable contracts and runtime adapters for exchanging observations, assignments, results, claims, receipts, and proof artifacts between independent agent systems.

Spore is the interoperability layer. It lets another runtime participate in DreamNet without sharing DreamNet's database, deployment topology, or model provider.

> Status: early technical preview (`0.2.0-alpha.1`). Interfaces may evolve before a stable release.

## What It Provides

- typed portable contracts for observations, assignments, capabilities, results, claims, receipts, and verification
- RFC 8785 canonicalization, domain-separated content IDs, and Ed25519 signatures
- signed `SporeEnvelope`, `ProofDrop`, and fail-closed `SporeLease` contracts
- key resolution, schema policy, replay classification, and revocation hooks
- CloudEvents 1.0 transport mapping without redefining the signed envelope
- a paper-only federation canary state machine spanning Trappers, Proof Drops,
  independently verified claims, Whale League theses, and University evidence
- observation ingestion with tamper rejection and deduplication
- isolated classifiers and configurable governance
- in-memory transport and an explicitly non-production Redis Streams placeholder
- experimental receipt and x402 shape adapters that do not establish settlement
- live GitHub and CoinGecko sensory spikes
- examples for weather, market, repository, and cross-system Proof Drop flows

## Install

This repository currently builds from source:

```bash
git clone https://github.com/BrandonDucar/dreamnet-spore-sdk.git
cd dreamnet-spore-sdk
pnpm install
pnpm typecheck
pnpm build
pnpm test
```

Node.js 20 or later is required.

## Core Flow

```text
external source
  -> StandardObservation
  -> signed Spore envelope verification
  -> deduplication
  -> isolated classifiers
  -> transport
  -> PortableReceipt / PortableClaim / ProofArtifact
```

## Minimal Example

```ts
import {
  BloodstreamPipeline,
  InMemoryTransport,
  VitalSignalDetector,
} from '@dreamnet/spore-sdk';

const transport = new InMemoryTransport();
const pipeline = new BloodstreamPipeline(transport);

pipeline.registerClassifier(new VitalSignalDetector());
transport.subscribe(async (observation) => {
  console.log(observation.provenance);
});

const result = await pipeline.process(observation);
if (!result.success) throw new Error(result.error);
```

A valid v1 envelope binds provenance, source metadata, evidence, confidence,
audience, freshness, policy references and lineage into one content ID and
Ed25519 signature. Changing any signed field invalidates the envelope.

## Security Core

`SporeEnvelope v1` is the common immutable wrapper. A Proof Drop is sealed
once; later verification and claims are separate envelopes referencing its
content ID. Leases grant only explicitly listed capabilities and fail closed
when missing, expired, revoked, addressed to another organism, or signed by
the wrong key.

The deterministic `pnpm test` suite covers RFC 8785 vectors, malformed I-JSON,
wrong keys, tampering, freshness, audience, complete content references and
lease authorization. Live network demonstrations remain available separately
through `pnpm test:examples` and are not conformance evidence.

See [Spore Envelope v1](./docs/spore-envelope-v1.md) for the protocol boundary.
See [Runtime Verification Boundary](./docs/runtime-verification-boundary.md)
for NATS and Temporal adapter integration.
See [Federation Canary v1](./docs/federation-canary-v1.md) for the bounded ZAO
interoperability workflow and yellow/red receipt behavior.
See [Federation Conformance](./docs/federation-conformance.md) for the fixed
cross-language Ed25519 fixture and required acceptance and rejection results.

## Portable Contracts

| Contract | Purpose |
| --- | --- |
| `StandardObservation` | Evidence-bearing sensory input |
| `PortableAssignment` | Runtime-neutral task dispatch |
| `CapabilityManifest` | Worker and spike capability declaration |
| `WorkResult` | Assignment outcome |
| `ProofArtifact` | Verifiable evidence target |
| `PortableReceipt` | Immutable execution reference |
| `VerificationResult` | Integrity, identity, authorization, and freshness checks |
| `PortableClaim` | Claim linked to supporting receipts |

## Design Boundaries

Spore does not decide global priorities, replace an orchestrator, or make trust
claims by itself. It provides portable envelopes and verification hooks so
independent organisms can exchange evidence while retaining their own policy
and execution authority.

The current Redis Streams class and x402 adapter are compatibility scaffolds,
not production transport or payment verification. Do not use them as evidence
of durable delivery or settlement.

## Roadmap

- publish the package to npm
- replace remaining legacy `Record<string, any>` boundaries with runtime schemas
- add issuer key resolution, revocation and replay stores
- add durable deduplication
- add NATS and Cloudflare Queue transports
- add conformance fixtures and compatibility tests
- publish a stable protocol versioning policy

## Related Projects

- [DreamNet](https://github.com/BrandonDucar/DreamNet)
- [DreamLoops](https://github.com/BrandonDucar/Dreamloops)
- [Temporal durability lab](https://github.com/BrandonDucar/dreamnet-temporal)
- [Warper Keeper](https://warper-keeper.dreamnet.ink)

## License

Apache-2.0. See [LICENSE](./LICENSE), [NOTICE](./NOTICE), and [TRADEMARKS.md](./TRADEMARKS.md).
