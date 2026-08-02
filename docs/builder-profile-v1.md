# Builder Profile v1

Builder Profile v1 carries evidence-backed operating principles between models
and organisms. It transfers reviewed judgment, not chat history, credentials,
tool permissions, or execution authority.

## Boundary

The profile is a `PROFILE` SporeEnvelope signed with Ed25519. Each principle
must declare where it applies, known exceptions, a bounded confidence score,
and at least one complete SHA-256 evidence reference. An approved profile
requires at least three reviewer-attributed receipt envelope IDs. Later
revisions must reference the profile envelope they supersede. Reviewer receipts
are also envelope dependencies, and the superseded profile is an envelope
parent, so a consumer can traverse the review and revision history without
parsing prose.

`REVIEWED` is an issuer claim, not proof that the cited reviews are valid. A
receiving organism must resolve every dependency, verify its signature and
schema, match its issuer to the declared reviewer, enforce reviewer
independence, and apply local policy. Until those checks pass, the profile has
candidate trust regardless of its payload status.

Profiles support only `PRIVATE` and `FEDERATED` visibility in v1. The envelope
maps those to `RESTRICTED` and `CONFIDENTIAL`; public profiles are deliberately
excluded until redaction and selective-disclosure policy exists.

## Authority

The following values are invariant:

```json
{
  "advisoryOnly": true,
  "grantsCapabilities": false,
  "overridesPolicy": false,
  "authorizesExecution": false
}
```

A profile can influence planning only after normal identity, lease, policy,
budget, approval, and tool authorization checks. It cannot bypass them.

## Lifecycle

```text
receipted decisions
  -> candidate principle
  -> evidence references
  -> three attributed review receipts
  -> reviewed signed profile
  -> bounded use by an intended audience
  -> superseding revision or revocation
```

The monorepo `BuilderProfileEnvelope.ts` introduced at `6c1b896d` is treated as
a conceptual predecessor only. It is not wire-compatible and must pass through
the legacy quarantine boundary rather than being accepted as canonical Spore.
