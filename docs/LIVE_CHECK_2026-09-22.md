# Spore live check — 2026-09-22

Fetched `https://dreamnet.ink/.well-known/spore`.

Observed:
- protocol_version 1.0.0
- civilization_id did:civilization:dreamnet
- status ACTIVE_EDGE_ROUTED
- sdk.commit 9c71330888e9ddcc676d422ce5ee2b5825b73b59 (matches this repo HEAD used for the branch)
- sdk.tag v1.0.0
- manifest_digest sha256:87a354d847ae12139aabd7982e735b2814b840470c00ec6b6a6d3ad705f0efd7
- expires_at 2027-09-10T00:00:00.000Z
- endpoints on dreamnet.ink /api/v1/federation/*

Not the same object as the README bilateral **envelope** golden vector:

```
310934631157283079e9eaaee35984bd49ece5ebd923cb93d5eb32691f4649c4
```

That digest is the SHA-256 of a fixed test **mission envelope body**, not the live manifest.
This check does **not** re-run Ed25519 conformance locally. Do not treat live manifest presence as a passed 10-stage suite.

Drift policy: if sdk.commit on the live manifest moves off this SHA, update this file or the implementation. Do not pretend they match.
