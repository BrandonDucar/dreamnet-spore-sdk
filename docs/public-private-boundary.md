# Public / Private Architectural Boundary

This document outlines the strict boundary between the **Public Open-Source Spore SDK** and **Private Mother DreamNet Core**.

---

```
                       ┌──────────────────────────────────────────────┐
                       │           MOTHER DREAMNET (Private)          │
                       │  • Private Skip-Tracing & Wealth Vault       │
                       │  • Master Quorum Consensus & Agent Passports │
                       │  • Proprietary Signal Screener               │
                       └──────────────────────┬───────────────────────┘
                                              │
                              (Secure Encrypted Sync Protocol)
                                              │
                       ┌──────────────────────▼───────────────────────┐
                       │     DREAMNET SPORE SDK / SPORE NODE (Public) │
                       │  • Open VacuumSpike Interfaces & Observation │
                       │  • Transport Abstraction (InMemory, Redis)   │
                       │  • Portable Receipt & Proof Drop Adapters     │
                       └──────────────────────────────────────────────┘
```

---

## 🌐 Public Scope (`dreamnet-spore-sdk`)
- **Spore Runtime**: Node lifecycle, plugin registration, health endpoints.
- **Observation SDK**: `VacuumSpike` interface, observation contracts, hashing.
- **Governance SDK**: Configurable budget & velocity interfaces (user-defined limits).
- **Protocol Adapters**: Portable receipt wrapping for ZAO/ZOE (Proof Drops, Spark Capsules).
- **Transport Abstraction**: Pluggable transport interfaces (`InMemoryTransport`, `RedisStreamsTransport`).

## 🏰 Private Scope (Mother DreamNet)
- **Proprietary Data Vaults**: High-equity real estate tax rolls, phone/email skip-tracing, and gold allocation models.
- **Master Quorum Voting**: Swarm consensus engines, prompt chaining, and private agent passports.
- **Monetization Vault**: Controlled lead release valves ($1,500/pack lead monetization).
