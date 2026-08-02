import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const POLICY_KEYS = new Set([
  'schemaVersion',
  'packageName',
  'candidateVersion',
  'publishTag',
  'forbidLatest',
  'requiredNodeMajor',
  'requiredLicense',
  'requiredAncestorCommits',
  'rollbackGitRef',
  'requiredPackageScripts',
  'requiredPackedFiles',
  'allowedPackedPathPrefixes',
  'forbiddenPackedPathPrefixes',
  'maxPackedFileCount',
]);

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, item]) => [key, stable(item)]),
    );
  }
  return value;
}
function canonical(value) {
  return JSON.stringify(stable(value));
}

function digest(value) {
  return `sha256:${createHash('sha256').update(canonical(value)).digest('hex')}`;
}

function addCheck(checks, id, passed, message) {
  checks.push({ id, passed: passed === true, message });
}

function uniqueStrings(value) {
  return Array.isArray(value) &&
    value.length > 0 &&
    value.every((entry) => typeof entry === 'string' && entry.length > 0) &&
    new Set(value).size === value.length;
}

function isReleaseCandidate(version) {
  return /^\d+\.\d+\.\d+-rc\.\d+$/.test(version);
}

function isForbiddenTrackedFile(file) {
  const normalized = file.replaceAll('\\', '/').toLowerCase();
  return (
    normalized === '.env' ||
    normalized.startsWith('.env.') ||
    normalized.endsWith('.pem') ||
    normalized.endsWith('.key') ||
    normalized.endsWith('credentials.json') ||
    normalized.includes('/secrets/')
  );
}

export function evaluateReleaseCandidate({
  packageJson,
  policy,
  nodeMajor,
  trackedFiles,
  packedFiles,
  git,
  commandResults,
}) {
  const checks = [];
  const unknownPolicyFields = policy && typeof policy === 'object'
    ? Object.keys(policy).filter((key) => !POLICY_KEYS.has(key))
    : [];
  addCheck(
    checks,
    'policy_schema',
    policy?.schemaVersion === 'dreamnet.spore-release-policy.v1' && unknownPolicyFields.length === 0,
    unknownPolicyFields.length > 0
      ? `Unknown release policy fields: ${unknownPolicyFields.join(', ')}.`
      : 'Release policy schema and fields are recognized.',
  );
  addCheck(
    checks,
    'package_identity',
    packageJson?.name === policy?.packageName && packageJson?.private !== true,
    'Package name must match policy and package must be publishable.',
  );
  addCheck(
    checks,
    'candidate_version',
    packageJson?.version === policy?.candidateVersion && isReleaseCandidate(packageJson?.version),
    'Package version must be the exact policy-approved release candidate.',
  );
  addCheck(
    checks,
    'prerelease_dist_tag',
    policy?.forbidLatest === true && policy?.publishTag === 'next' && policy?.publishTag !== 'latest',
    'Release candidates must use the next dist-tag; latest is forbidden.',
  );
  addCheck(
    checks,
    'license',
    packageJson?.license === policy?.requiredLicense,
    'Package license must match the approved release policy.',
  );
  addCheck(
    checks,
    'node_runtime',
    Number.isInteger(nodeMajor) && nodeMajor >= policy?.requiredNodeMajor,
    'Node runtime must meet the minimum production release version.',
  );
  addCheck(
    checks,
    'package_scripts',
    uniqueStrings(policy?.requiredPackageScripts) &&
      policy.requiredPackageScripts.every((name) => typeof packageJson?.scripts?.[name] === 'string'),
    'All required verification and build scripts must exist.',
  );
  addCheck(
    checks,
    'clean_tree',
    git?.clean === true,
    'Release gate requires a clean Git worktree.',
  );
  addCheck(
    checks,
    'commit_identity',
    typeof git?.commit === 'string' && /^[a-f0-9]{40}$/.test(git.commit),
    'Release must be evaluated at an immutable Git commit.',
  );

  const requiredAncestorsValid = uniqueStrings(policy?.requiredAncestorCommits) &&
    policy.requiredAncestorCommits.every(
      (commit) => /^[a-f0-9]{40}$/.test(commit) && git?.ancestors?.[commit] === true,
    );
  addCheck(
    checks,
    'required_lineage',
    requiredAncestorsValid,
    'Every approved security, compatibility, canary, and conformance commit must be an ancestor.',
  );
  addCheck(
    checks,
    'rollback_ref',
    /^[a-f0-9]{40}$/.test(policy?.rollbackGitRef ?? '') &&
      git?.rollbackRefCommit === policy.rollbackGitRef &&
      git?.ancestors?.[policy.rollbackGitRef] === true,
    'Rollback must resolve to an existing immutable ancestor commit.',
  );

  addCheck(
    checks,
    'tracked_secret_paths',
    Array.isArray(trackedFiles) && !trackedFiles.some(isForbiddenTrackedFile),
    'Tracked files must not include common credential or private-key paths.',
  );

  const requiredPackedFilesValid = uniqueStrings(policy?.requiredPackedFiles) &&
    policy.requiredPackedFiles.every((file) => packedFiles.includes(file));
  addCheck(
    checks,
    'required_pack_files',
    requiredPackedFilesValid,
    'Package tarball must include all required legal, metadata, and documentation files.',
  );

  const allowedPackedFiles = new Set(policy?.requiredPackedFiles ?? []);
  const packedPathsValid = Array.isArray(packedFiles) && packedFiles.length > 0 &&
    packedFiles.length <= policy?.maxPackedFileCount &&
    packedFiles.every((file) => {
      const normalized = file.replaceAll('\\', '/');
      const allowed = allowedPackedFiles.has(normalized) ||
        policy?.allowedPackedPathPrefixes?.some((prefix) => normalized.startsWith(prefix));
      const forbidden = policy?.forbiddenPackedPathPrefixes?.some(
        (prefix) => normalized === prefix || normalized.startsWith(prefix),
      );
      return allowed && !forbidden;
    });
  addCheck(
    checks,
    'pack_allowlist',
    packedPathsValid,
    'Every tarball path must be explicitly allowed and outside forbidden source, test, secret, and ops paths.',
  );

  for (const result of commandResults ?? []) {
    addCheck(
      checks,
      `command_${result.id}`,
      result.passed === true,
      `${result.label} must complete successfully.`,
    );
  }

  const status = checks.every((check) => check.passed) ? 'GREEN' : 'RED';
  return {
    status,
    promotable: status === 'GREEN',
    checks,
    authority: {
      merge: false,
      publish: false,
      setLatestDistTag: false,
    },
  };
}

function run(command, args, cwd, { capture = false } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: capture ? 'pipe' : 'inherit',
    windowsHide: true,
  });
  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    error: result.error,
  };
}

function resolvePnpmCli() {
  const cli = process.env.npm_execpath;
  if (!cli || !existsSync(cli) || !/pnpm(?:\.cjs|\.js)$/i.test(cli)) {
    throw new Error('Release preflight must be launched through pnpm so its CLI can be resolved safely.');
  }
  return cli;
}

function resolveNpmCli() {
  const candidates = [
    path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    path.resolve(path.dirname(process.execPath), '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
  ];
  const cli = candidates.find((candidate) => existsSync(candidate));
  if (!cli) throw new Error('Unable to resolve npm-cli.js without a shell.');
  return cli;
}

function gitOutput(root, args) {
  const result = run('git', args, root, { capture: true });
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `git ${args.join(' ')} failed.`);
  }
  return result.stdout.trim();
}

function commandCheck(id, label, command, args, root) {
  const result = run(command, args, root);
  return { id, label, passed: result.status === 0 && !result.error };
}

export function createReleaseGateReceipt({
  packageJson,
  policy,
  pnpmLock,
  git,
  pack,
  evaluation,
  evaluatedAt = new Date(),
}) {
  const body = {
    schemaVersion: 'dreamnet.spore-release-gate-receipt.v1',
    evaluatedAt: evaluatedAt.toISOString(),
    subject: {
      packageName: packageJson.name,
      version: packageJson.version,
      publishTag: policy.publishTag,
      gitCommit: git.commit,
      gitBranch: git.branch,
    },
    inputs: {
      packageJson: digest(packageJson),
      releasePolicy: digest(policy),
      pnpmLock: `sha256:${createHash('sha256').update(pnpmLock).digest('hex')}`,
      packedFileManifest: digest(pack.files),
    },
    package: {
      filename: pack.filename,
      fileCount: pack.files.length,
      unpackedSize: pack.unpackedSize,
      shasum: pack.shasum,
      integrity: pack.integrity,
    },
    decision: evaluation,
    attestation: {
      type: 'UNSIGNED_LOCAL_DIGEST',
      authenticated: false,
    },
  };
  return {
    ...body,
    receipt: {
      algorithm: 'sha256:stable-json-v1',
      hash: digest(body),
    },
  };
}

function parseOutputArgument(args) {
  const index = args.indexOf('--output');
  if (index === -1) return undefined;
  if (!args[index + 1]) throw new TypeError('--output requires a path.');
  return path.resolve(args[index + 1]);
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const outputPath = parseOutputArgument(process.argv.slice(2));
  try {
    const packageJson = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
    const policy = JSON.parse(readFileSync(path.join(root, 'release', 'spore-release-policy.json'), 'utf8'));
    const pnpmLock = readFileSync(path.join(root, 'pnpm-lock.yaml'), 'utf8');
    const pnpmCli = resolvePnpmCli();
    const npmCli = resolveNpmCli();
    const cleanBefore = gitOutput(root, ['status', '--porcelain']).length === 0;
    const commandResults = [
      commandCheck('typecheck', 'TypeScript typecheck', process.execPath, [pnpmCli, 'typecheck'], root),
      commandCheck('test', 'Deterministic test suite', process.execPath, [pnpmCli, 'test'], root),
      commandCheck('build', 'Production package build', process.execPath, [pnpmCli, 'build'], root),
      commandCheck(
        'audit',
        'Production dependency audit',
        process.execPath,
        [pnpmCli, 'audit', '--prod', '--audit-level', 'high'],
        root,
      ),
    ];

    const packResult = run(
      process.execPath,
      [npmCli, 'pack', '--dry-run', '--json', '--ignore-scripts'],
      root,
      { capture: true },
    );
    commandResults.push({
      id: 'pack_dry_run',
      label: 'NPM pack dry-run',
      passed: packResult.status === 0 && !packResult.error,
    });
    let packData = { filename: null, files: [], unpackedSize: null, shasum: null, integrity: null };
    if (packResult.status === 0) {
      const parsed = JSON.parse(packResult.stdout);
      const item = Array.isArray(parsed) ? parsed[0] : parsed;
      packData = {
        filename: item.filename ?? null,
        files: (item.files ?? []).map((entry) => entry.path).sort(),
        unpackedSize: item.unpackedSize ?? null,
        shasum: item.shasum ?? null,
        integrity: item.integrity ?? null,
      };
    }

    const commit = gitOutput(root, ['rev-parse', 'HEAD']);
    const branch = process.env.GITHUB_HEAD_REF || gitOutput(root, ['branch', '--show-current']) || '(detached)';
    const ancestors = {};
    for (const requiredCommit of policy.requiredAncestorCommits ?? []) {
      const result = run('git', ['merge-base', '--is-ancestor', requiredCommit, 'HEAD'], root, { capture: true });
      ancestors[requiredCommit] = result.status === 0;
    }
    let rollbackRefCommit = null;
    try {
      rollbackRefCommit = gitOutput(root, ['rev-parse', `${policy.rollbackGitRef}^{commit}`]);
    } catch {
      rollbackRefCommit = null;
    }
    const cleanAfter = gitOutput(root, ['status', '--porcelain']).length === 0;
    const git = {
      clean: cleanBefore && cleanAfter,
      commit,
      branch,
      ancestors,
      rollbackRefCommit,
    };
    const trackedFiles = gitOutput(root, ['ls-files']).split(/\r?\n/).filter(Boolean);
    const evaluation = evaluateReleaseCandidate({
      packageJson,
      policy,
      nodeMajor: Number.parseInt(process.versions.node.split('.')[0], 10),
      trackedFiles,
      packedFiles: packData.files,
      git,
      commandResults,
    });
    const receipt = createReleaseGateReceipt({
      packageJson,
      policy,
      pnpmLock,
      git,
      pack: packData,
      evaluation,
    });

    if (outputPath) {
      mkdirSync(path.dirname(outputPath), { recursive: true });
      writeFileSync(outputPath, `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600 });
    }
    console.log(JSON.stringify({
      status: evaluation.status,
      promotable: evaluation.promotable,
      packageName: packageJson.name,
      version: packageJson.version,
      publishTag: policy.publishTag,
      gitCommit: commit,
      receiptHash: receipt.receipt.hash,
      outputPath: outputPath ?? null,
      failedChecks: evaluation.checks.filter((check) => !check.passed).map((check) => check.id),
    }));
    process.exitCode = evaluation.promotable ? 0 : 1;
  } catch (error) {
    console.error(JSON.stringify({
      status: 'RED',
      promotable: false,
      error: error instanceof Error ? error.message : String(error),
    }));
    process.exitCode = 1;
  }
}
