# DreamNet Spore SDK

Portable contracts and runtime adapters for exchanging observations, assignments, results, claims, receipts, and proof artifacts between independent agent systems.

Spore is the interoperability layer. It lets another runtime participate in DreamNet without sharing DreamNet's database, deployment topology, or model provider.

> Status: early technical preview (`0.1.0-alpha.1`). Interfaces may evolve before a stable release.

## What It Provides

- typed portable contracts for observations, assignments, capabilities, results, claims, receipts, and verification
- deterministic JSON canonicalization and SHA-256 content hashing
- observation ingestion with tamper rejection and deduplication
- isolated classifiers and configurable governance
- in-memory and Redis Streams transports
- receipt and x402 adapters
- live GitHub and CoinGecko sensory spikes
- examples for weather, market, repository, and cross-system Proof Drop flows

## Install

This repository currently builds from source:

```bash
git clone https://github.com/BrandonDucar/dreamnet-spore-sdk.git
cd dreamnet-spore-sdk
pnpm install
pnpm build
pnpm test
```

Node.js 20 or later is required.

## Core Flow

```text
external source
  -> StandardObservation
  -> canonical hash verification
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

A valid observation includes its provenance, source metadata, evidence, confidence, and the canonical SHA-256 hash of its evidence payload.

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

Spore does not decide global priorities, replace an orchestrator, or make trust claims by itself. It provides portable envelopes and verification hooks so independent organisms can exchange evidence while retaining their own policy and execution authority.

## Roadmap

- publish the package to npm
- replace `Record<string, any>` boundaries with schema-validated payloads
- add signed identity and freshness verification
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
