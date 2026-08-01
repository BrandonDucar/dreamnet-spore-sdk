# Runtime Verification Boundary

## Adapter rule

Transport adapters carry `SporeEnvelope v1`; they do not redefine it.

For CloudEvents and NATS, the CloudEvent `data` field contains the complete
signed `SporeEnvelope`. CloudEvent metadata mirrors the envelope ID, issuer,
kind, time, and subject so routing metadata can be checked before trust
evaluation. The wrapper itself does not replace the envelope signature.

```text
NATS message
  -> parse CloudEvent
  -> verify wrapper/envelope consistency
  -> resolve trusted issuer key
  -> verify content ID, signature, freshness and audience
  -> validate payload schema
  -> check revocation
  -> atomically classify nonce
  -> ACCEPT, DUPLICATE or REJECT
```

## Dispositions

- `ACCEPT`: ACK the message and begin the authorized workflow.
- `DUPLICATE`: ACK the message without executing side effects again.
- `REJECT`: quarantine the message and emit a signed rejection receipt.

A repeated nonce with the same envelope ID is an idempotent delivery. A
repeated nonce with a different envelope ID is a replay conflict.

Verification policy must explicitly decide whether expiry, replay protection,
and revocation checks are required. Action-bearing envelopes should require an
expiry. Durable Proof Drops can omit expiry while using a separate replay TTL.

## Production dependencies

The SDK includes process-local stores only for deterministic testing. A real
runtime must provide:

- a trusted issuer-key resolver with rotation and validity windows;
- an atomic durable replay store, such as Postgres or Redis with compare-set;
- durable revocation and supersession state;
- an explicit schema registry;
- a quarantine store and signed receipt publisher.

## Hermes runtime mapping

The canonical package import is `@dreamnet/spore-sdk`. Runtime code must not
import a second `@antigravity/spore-envelope/v1` contract or construct another
object named `SporeEnvelopeV1`.

Recommended NATS behavior:

1. publish one CloudEvent containing one signed envelope;
2. use `Nats-Msg-Id` equal to the envelope content ID;
3. use durable consumers and explicit ACK;
4. call `fromSporeCloudEvent` before `verifyEnvelopeWithTrust`;
5. ACK `DUPLICATE` without invoking Temporal again;
6. publish a signed RED receipt for `REJECT` before terminating or routing to DLQ;
7. start Temporal only for `ACCEPT`.

Temporal workflow IDs should derive from the accepted envelope ID. This makes
workflow start idempotent without making Temporal the protocol authority.
