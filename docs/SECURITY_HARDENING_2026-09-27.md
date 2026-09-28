# Spore v1.0.1 boundary hardening

This release preserves the existing spore-envelope-v1 signing protocol:
canonical JSON -> SHA-256 binary digest -> Ed25519 -> 128 lowercase hex characters.
It corrects README prose that incorrectly named raw JSON bytes as the signing input.
It does not adopt the incompatible development-branch domain-separated envelope format.

Changes: complete field checks, UTC timestamp ordering/lifetime checks, strict hex,
bounded shared JSON input domain, explicit trust-context comparison, process-local
nonce consumption, and NOT_EVALUATED authorization output. The immutable bilateral
golden hash remains unchanged. No historical receipts are rehashed.

Observation inputs that relied on undefined, Date, sparse arrays, getters, or other
JavaScript extensions now reject. Convert them explicitly to valid JSON at the producer
boundary; do not silently delete evidence to make a hash succeed.

The optional Map is for one trusted peer/context in one process. It is not a replacement
for the application's durable atomic replay store. All live effects still require admission,
current scoped authority, and independently verified execution receipts. A valid signature
or manifest digest creates no authority. Muse's external export is still a separate test.

Verification: pnpm typecheck; pnpm test; pnpm build. Tests include malformed signed data,
tampering, replay, exact signing bytes, JSON edge rejection, and compatibility vectors.
Rollback: revert this release or use the preceding pinned commit, keeping live writes closed.
