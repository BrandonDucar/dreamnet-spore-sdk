# Federation Canary v1

Federation Canary v1 is the bounded interoperability contract for proving one
external agent workflow before granting broader organism access.

```text
Warper Keeper Trapper
  -> sandbox assignment
  -> terminal receipt
  -> Proof Drop
  -> independent claim verification
  -> Whale League paper thesis
  -> University candidate evidence
```

Each state is a signed `SporeEnvelope` with a complete evidence manifest. A
state may advance exactly one stage and must identify the prior signed envelope.
This prevents a producer from skipping independent verification or presenting a
paper thesis as if it had completed earlier gates.

## Receipt Policy

- `GREEN`: the state may advance when the next stage is complete.
- `YELLOW`: processing halts until a human records a separate approval decision.
- `RED`: processing halts. Downstream work must not be scheduled.

The SDK does not create the human approval artifact. The deployment policy must
define who can approve, how that approval is signed, and whether a new canary
state may be issued after review.

## Authority Boundary

Version 1 is deliberately paper-only and denies wallet access, real trading,
public posting, production deployment, raw event-bus access, and secret access.
Those fields are literal `false` values, not descriptive policy labels.

The contract is transport-neutral. A gateway may carry it over HTTP,
CloudEvents, NATS, or Temporal, but transport success does not replace
`verifyEnvelopeWithTrust`, schema validation, revocation checks, replay
classification, or independent claim verification.

## Deployment Rule

Start with one ZAO agent, one Trapper, and one read-only assignment. Expand the
fleet only after the canary produces an accepted signed chain and the operator
reviews the receipts. Never expose DreamNet databases, root NATS subjects,
operator credentials, wallets, or Railway secrets to the external organism.
