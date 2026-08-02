# Spore SDK release-candidate runbook

The release-candidate line began at `0.2.0-rc.1`, not `1.0.0-rc1`.
Builder Profile v1 advances the stacked candidate to `0.2.0-rc.2`.
The repository is still explicit about non-production transport adapters, so a
1.0 stability promise would overstate the implementation boundary.

`pnpm release:preflight` is the executable source of truth. It fails closed
unless the package version and `next` dist-tag match policy, all five approved
Spore commits are ancestors, the rollback commit resolves, the worktree is
clean, typecheck/tests/build/audit pass, and the dry-run tarball contains only
allowed distributable files. TypeScript output is pinned to LF so the same
build stays clean on Windows and Linux. It emits an unsigned content-addressed receipt
with zero merge or publish authority.

## Review quorum

1. Codex runs the executable gate and records the commit and receipt hash.
2. Antigravity independently verifies GitHub PR topology, package contents,
   SemVer, and the absence of untracked release claims.
3. Hermes independently verifies runtime compatibility and confirms that no
   NUC, Railway, NATS, Temporal, or ZAO deployment is represented as release
   evidence.

Any RED finding holds promotion. A disagreement is YELLOW and requires a new
receipt after correction. No reviewer may reinterpret a failed check as a
pass in prose.

## Candidate command

```bash
pnpm install --frozen-lockfile
pnpm release:preflight -- --output /tmp/spore-release-gate-receipt.json
```

The gate does not publish. After all three reviewers accept the same commit
and receipt inputs, an operator may separately approve a prerelease publish:

```bash
npm publish --provenance --access public --tag next
```

Do not use `latest` for a release candidate. Do not claim an npm rollback to a
version that does not exist. The current Git rollback target is the immutable
conformance commit `4619616d48a5f1180e88812bf6771cb47c9c56cd`. If an npm
candidate must be withdrawn, deprecate that exact candidate and remove or move
the `next` dist-tag under a separately approved operator action; never unpublish
or invent a prior package version.
