import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createReleaseGateReceipt,
  evaluateReleaseCandidate,
} from '../scripts/release-preflight.mjs';

const ancestors = [
  '558a4e48dc9e125240c91c012213950e97c1768e',
  'bdf96fba9a4ce006b61b1884713f7f450809da23',
  'bb5d79a114872e6d5649be2744a9e29efbe7b9c4',
  '5b1cd56f89e2cc1dcde8166e53fb3ccd6d9e90e4',
  '4619616d48a5f1180e88812bf6771cb47c9c56cd',
  '82d987f1ed94c5746f7dc6123c3389d0482df85c',
];
const requiredGitAttributes = [
  '* text=auto',
  '*.cjs text eol=lf',
  '*.cts text eol=lf',
  '*.js text eol=lf',
  '*.json text eol=lf',
  '*.md text eol=lf',
  '*.mjs text eol=lf',
  '*.mts text eol=lf',
  '*.ts text eol=lf',
  '*.tsx text eol=lf',
  '*.yaml text eol=lf',
  '*.yml text eol=lf',
];
const rollbackCommit = '4619616d48a5f1180e88812bf6771cb47c9c56cd';

function fixture() {
  const packageJson = {
    name: '@dreamnet/spore-sdk',
    version: '0.2.0-rc.2',
    license: 'Apache-2.0',
    repository: {
      type: 'git',
      url: 'https://github.com/BrandonDucar/dreamnet-spore-sdk.git',
    },
    scripts: {
      typecheck: 'tsc --noEmit',
      test: 'tsx --test',
      build: 'tsc',
      prepack: 'npm run build',
    },
  };
  const buildConfig = {
    compilerOptions: {
      newLine: 'lf',
    },
  };
  const gitAttributes = `${requiredGitAttributes.join('\n')}\n`;
  const policy = {
    schemaVersion: 'dreamnet.spore-release-policy.v1',
    packageName: '@dreamnet/spore-sdk',
    repositoryUrl: 'https://github.com/BrandonDucar/dreamnet-spore-sdk.git',
    candidateVersion: '0.2.0-rc.2',
    publishTag: 'next',
    forbidLatest: true,
    requiredNodeMajor: 20,
    requiredBuildNewLine: 'lf',
    requiredGitAttributes,
    requiredLicense: 'Apache-2.0',
    requiredAncestorCommits: ancestors,
    rollbackGitRef: rollbackCommit,
    requiredPackageScripts: ['typecheck', 'test', 'build', 'prepack'],
    requiredPackedFiles: [
      'package.json',
      'README.md',
      'LICENSE',
      'NOTICE',
      'dist/index.js',
      'dist/index.d.ts',
    ],
    allowedPackedPathPrefixes: ['dist/'],
    forbiddenPackedPathPrefixes: ['.env', 'src/', 'test/', 'scripts/'],
    maxPackedFileCount: 250,
  };
  const git = {
    clean: true,
    branch: 'codex/spore-release-gate-v1',
    commit: 'a'.repeat(40),
    ancestors: Object.fromEntries(ancestors.map((commit) => [commit, true])),
    rollbackRefCommit: rollbackCommit,
  };
  return {
    packageJson,
    buildConfig,
    gitAttributes,
    policy,
    nodeMajor: 20,
    trackedFiles: ['package.json', 'src/index.ts'],
    packedFiles: ['LICENSE', 'NOTICE', 'README.md', 'dist/index.d.ts', 'dist/index.js', 'package.json'],
    git,
    commandResults: [
      { id: 'test', label: 'tests', passed: true },
      { id: 'build', label: 'build', passed: true },
    ],
  };
}

test('accepts a clean, lineage-pinned, next-tag release candidate', () => {
  const input = fixture();
  const result = evaluateReleaseCandidate(input);
  assert.equal(result.status, 'GREEN');
  assert.equal(result.promotable, true);
  assert.deepEqual(result.authority, {
    merge: false,
    publish: false,
    setLatestDistTag: false,
  });
});
test('rejects latest, version drift, missing lineage, and imaginary rollback refs', () => {
  const input = fixture();
  input.policy.publishTag = 'latest';
  input.packageJson.version = '1.0.0-rc.1';
  input.git.ancestors[ancestors[2]] = false;
  input.git.rollbackRefCommit = null;
  const result = evaluateReleaseCandidate(input);

  assert.equal(result.status, 'RED');
  for (const id of ['candidate_version', 'prerelease_dist_tag', 'required_lineage', 'rollback_ref']) {
    assert.ok(result.checks.some((check) => check.id === id && check.passed === false));
  }
});

test('rejects dirty trees, tracked secrets, forbidden pack paths, and failed commands', () => {
  const input = fixture();
  input.git.clean = false;
  input.trackedFiles.push('.env.production');
  input.packedFiles.push('src/private.ts');
  input.commandResults.push({ id: 'audit', label: 'audit', passed: false });
  const result = evaluateReleaseCandidate(input);

  assert.equal(result.status, 'RED');
  for (const id of ['clean_tree', 'tracked_secret_paths', 'pack_allowlist', 'command_audit']) {
    assert.ok(result.checks.some((check) => check.id === id && check.passed === false));
  }
});

test('rejects platform-dependent TypeScript build newlines', () => {
  const input = fixture();
  input.buildConfig.compilerOptions.newLine = 'crlf';
  const result = evaluateReleaseCandidate(input);

  assert.equal(result.status, 'RED');
  assert.ok(result.checks.some(
    (check) => check.id === 'deterministic_newlines' && check.passed === false,
  ));
});

test('rejects missing repository line-ending attributes', () => {
  const input = fixture();
  input.gitAttributes = '* text=auto\n*.ts text eol=lf\n';
  const result = evaluateReleaseCandidate(input);

  assert.equal(result.status, 'RED');
  assert.ok(result.checks.some(
    (check) => check.id === 'git_attributes' && check.passed === false,
  ));
});

test('emits a content-addressed receipt with zero publish authority', () => {
  const input = fixture();
  const decision = evaluateReleaseCandidate(input);
  const receipt = createReleaseGateReceipt({
    packageJson: input.packageJson,
    buildConfig: input.buildConfig,
    gitAttributes: input.gitAttributes,
    policy: input.policy,
    pnpmLock: 'lockfileVersion: 9',
    git: input.git,
    pack: {
      filename: 'dreamnet-spore-sdk-0.2.0-rc.2.tgz',
      files: input.packedFiles,
      unpackedSize: 1000,
      shasum: 'b'.repeat(40),
      integrity: 'sha512-example',
    },
    evaluation: decision,
    evaluatedAt: new Date('2026-08-02T12:00:00.000Z'),
  });

  assert.match(receipt.receipt.hash, /^sha256:[a-f0-9]{64}$/);
  assert.equal(receipt.decision.authority.publish, false);
  assert.equal(receipt.attestation.authenticated, false);
});
