import { join, resolve } from 'node:path';
import { parseArgs, PROJECT_ROOT, readJson, requireArg, readPackageVersion, runChecked, writeJson } from './release-utils.mjs';

try {
  const args = parseArgs(process.argv.slice(2));
  const root = resolve(args.root ?? PROJECT_ROOT);
  const platform = requireArg(args, 'platform');
  const arch = requireArg(args, 'arch');
  const rustTarget = requireArg(args, 'rust-target');
  const out = resolve(args.out ?? join(root, 'dist', 'release', `${platform}-${arch}`, `build-info-${platform}-${arch}.json`));
  const version = args.version ?? readPackageVersion(root);
  const gitSha = args['git-sha'] ?? process.env.GITHUB_SHA ?? runChecked('git', ['rev-parse', 'HEAD'], { cwd: root });
  const tag = args.tag ?? process.env.RELEASE_TAG ?? '';
  const releaseSourceCommit = args['release-source-commit'] ?? gitSha;
  const workflowCommit = args['workflow-commit'] ?? process.env.GITHUB_SHA ?? null;
  const distributionStatus = args['distribution-status'] ?? 'candidate';
  const signed = args.signed === 'true';
  const notarized = args.notarized === 'true';
  const nodeVersion = runChecked(process.execPath, ['--version']);
  const rustcVersion = runChecked('rustc', ['--version']);
  const tauriVersion = readJson(join(root, 'node_modules', '@tauri-apps', 'cli', 'package.json')).version;
  writeJson(out, {
    version,
    tag,
    gitSha,
    releaseSourceCommit,
    workflowCommit,
    platform,
    arch,
    rustTarget,
    distributionStatus,
    signed,
    notarized,
    nodeVersion,
    rustcVersion,
    tauriVersion,
    workflowRunId: process.env.GITHUB_RUN_ID ?? null,
    builtAt: new Date().toISOString(),
  });
  console.log(`Wrote ${out}`);
} catch (error) {
  console.error(`Build info generation failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
