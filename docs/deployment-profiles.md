# 🚀 Spore Node Deployment Profiles

DreamNet Spore SDK supports 3 deployment profiles ranging from zero-dependency local development to distributed enterprise clusters.

---

## 1. 🏡 Local Profile (Zero-Dependency)
- **Transport**: `InMemoryTransport`
- **Database**: In-memory / SQLite
- **Best for**: Rapid local testing, Zaal agent experiments, and quick developer onboarding.

```typescript
import { InMemoryTransport } from '@dreamnet/spore-sdk';
const transport = new InMemoryTransport();
```

---

## 2. ☁️ Starter Cloud Profile (Railway / Docker)
- **Transport**: `RedisStreamsTransport`
- **Database**: PostgreSQL (Neon / Supabase)
- **Persistence**: Redis Streams & Railway Persistent Volume
- **Best for**: 24/7 background workers, Notion drips, and GoHighLevel CRM webhooks.

```typescript
import { RedisStreamsTransport } from '@dreamnet/spore-sdk';
const transport = new RedisStreamsTransport({ redisUrl: process.env.REDIS_URL });
```

---

## 3. 🌐 Distributed Enterprise Profile
- **Transport**: `NatsJetStreamTransport` / `KafkaTransport`
- **Database**: Distributed Postgres + Vector DB (Qdrant / Milvus)
- **Edge Routing**: Cloudflare Workers
- **Best for**: High-throughput multi-agent swarms processing 1,000+ tokens/sec.
