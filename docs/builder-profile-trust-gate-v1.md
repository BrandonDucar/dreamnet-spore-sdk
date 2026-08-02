# Builder Profile trust gate v1

The Builder Profile trust gate converts a signed `REVIEWED` claim into a
receiving-organism admission decision. It does not trust reviewer names or
receipt IDs merely because the profile issuer included them.

## Required graph

```text
signed candidate PROFILE
  -> three or more signed RECEIPT envelopes
  -> signed REVIEWED PROFILE
       parents: candidate envelope ID
       dependencies: exact review receipt IDs
```

Candidate, review receipts, and final profile bind the same domain-separated
RFC 8785 content digest. The digest excludes review state while including the
builder identity, revision, preferences, principles, evidence, visibility, and
zero-authority declaration.

## Admission checks

`verifyReviewedBuilderProfile()` fails closed unless:

1. The final profile passes issuer, signature, schema, audience, expiry,
   revocation, and replay checks.
2. Its candidate parent resolves to a trusted signed `CANDIDATE` profile for
   the same builder, logical profile, and revision.
3. Candidate and final profile produce the same reviewable-content digest.
4. Every declared receipt resolves, passes the complete trust boundary, names
   its actual signed issuer, references the candidate, and approves that exact
   digest. The receipt envelope must be issued no later than the final profile,
   and its review time must fall after the candidate and before quorum closes.
5. Verified reviewer identities remain unique and satisfy the configured
   threshold.

A missing, rejected, revoked, expired, replay-conflicted, content-mismatched,
or identity-mismatched receipt makes the entire profile `REJECT`. The result
still grants no execution, deployment, wallet, secret, or policy authority.
