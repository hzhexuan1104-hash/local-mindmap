import { writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  expectedAssets,
  listFilesRecursive,
  parseArgs,
  PROJECT_ROOT,
  readJson,
  releaseFileRecord,
  requireArg,
  writeJson,
} from './release-utils.mjs';

const RELEASE_TARGETS = [
  ['windows', 'x64'],
  ['macos', 'arm64'],
  ['macos', 'x64'],
  ['uos', 'x64'],
  ['uos', 'arm64'],
];

function expectedReleaseAssets(version, macosDistributionStatus) {
  return RELEASE_TARGETS.flatMap(([platform, arch]) =>
    expectedAssets(platform, arch, version, {
      variant:
        platform === 'macos' && macosDistributionStatus === 'unsigned-preview'
          ? '_unsigned_preview'
          : '',
    }).map((asset) => ({ ...asset, platform, arch })),
  );
}

function assetStatus(platform, macosDistributionStatus) {
  if (platform === 'macos') {
    const signed = macosDistributionStatus === 'release';
    return {
      signed,
      notarized: signed,
      distributionStatus: signed ? 'release' : 'unsigned-preview',
      compatibilityStatus: signed ? 'verified' : 'unsigned-preview',
      ...(signed
        ? {}
        : {
            userActionRequired:
              'Gatekeeper may block first launch. This package is not notarized.',
          }),
    };
  }
  return {
    signed: false,
    notarized: false,
    distributionStatus: platform === 'uos' ? 'candidate' : 'release',
    compatibilityStatus: 'candidate',
  };
}

function readVerification(filesByName, platform, arch) {
  const path = filesByName.get(`verification-${platform}-${arch}.json`);
  if (!path) return undefined;
  const record = readJson(path);
  return typeof record === 'object' && record ? record : undefined;
}

export function buildReleaseMetadata({
  assetsDirectory,
  version,
  tag,
  releaseRef,
  releaseSourceCommit,
  workflowCommit,
  releaseMode,
  macosDistributionStatus,
  workflowRunId,
  draftReleaseStatus = 'pending',
  generatedAt = new Date().toISOString(),
}) {
  if (tag !== `v${version}`) throw new Error(`tag ${tag} 与版本 ${version} 不一致。`);
  const expected = expectedReleaseAssets(version, macosDistributionStatus);
  const files = listFilesRecursive(assetsDirectory);
  const filesByName = new Map(files.map((path) => [basename(path), path]));
  const duplicates = files
    .map((path) => basename(path))
    .filter((filename, index, all) => all.indexOf(filename) !== index);
  if (duplicates.length) throw new Error(`Release assets 存在重复文件名：${[...new Set(duplicates)].join(', ')}`);
  const expectedNames = new Set(expected.map((asset) => asset.filename));
  const unexpectedInstallers = files
    .map((path) => basename(path))
    .filter((filename) => /\.(exe|msi|dmg|deb|appimage)$/i.test(filename) && !expectedNames.has(filename));
  if (unexpectedInstallers.length) {
    throw new Error(`发现旧版本或未声明安装包：${unexpectedInstallers.join(', ')}`);
  }

  const assets = expected.map((asset) => {
    const path = filesByName.get(asset.filename);
    if (!path) throw new Error(`缺少 Release 资产：${asset.filename}`);
    const record = releaseFileRecord(path, assetsDirectory);
    const verification = readVerification(filesByName, asset.platform, asset.arch);
    return {
      filename: record.filename,
      platform: asset.platform,
      arch: asset.arch,
      format: asset.format,
      size: record.size,
      sha256: record.sha256,
      ...assetStatus(asset.platform, macosDistributionStatus),
      ...(verification?.nativeVerification
        ? { nativeVerification: verification.nativeVerification }
        : {}),
    };
  });
  const manifest = {
    schemaVersion: 2,
    appName: 'Local Mindmap',
    version,
    tag,
    releaseRef,
    releaseSourceCommit,
    workflowCommit,
    generatedAt,
    releaseMode,
    workflowRunId,
    assets,
  };
  const checksumLines = assets
    .slice()
    .sort((left, right) => left.filename.localeCompare(right.filename))
    .map((asset) => `${asset.sha256}  ${asset.filename}`);
  const macosStatus = macosDistributionStatus === 'release' ? 'release (signed and notarized)' : 'unsigned-preview (not signed or notarized)';
  const summary = [
    '# Local Mindmap release build summary',
    '',
    `- Release source ref: ${releaseRef}`,
    `- Release source commit: ${releaseSourceCommit}`,
    `- Workflow commit: ${workflowCommit}`,
    `- Version: ${version}`,
    `- Trigger mode: ${releaseMode}`,
    '- Windows status: release',
    `- macOS ARM64 status: ${macosStatus}`,
    `- macOS x64 status: ${macosStatus}`,
    '- UOS x64 status: candidate',
    '- UOS ARM64 status: candidate',
    `- Signing mode: ${macosDistributionStatus === 'release' ? 'Apple Developer ID' : 'unsigned preview'}`,
    `- Notarization status: ${macosDistributionStatus === 'release' ? 'notarized' : 'not notarized'}`,
    `- Draft Release status: ${draftReleaseStatus}`,
    '',
    '| Asset | Platform | Architecture | SHA-256 | Distribution status |',
    '| --- | --- | --- | --- | --- |',
    ...assets.map((asset) => `| ${asset.filename} | ${asset.platform} | ${asset.arch} | ${asset.sha256} | ${asset.distributionStatus} |`),
    '',
    'UOS packages are Ubuntu 22.04-built compatibility candidates until they pass the documented real-device UOS acceptance matrix.',
  ].join('\n');
  return { manifest, checksumLines, summary };
}

export function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    const root = resolve(args.root ?? PROJECT_ROOT);
    const assetsDirectory = resolve(args['assets-dir'] ?? join(root, 'release-assets'));
    const version = requireArg(args, 'version');
    const tag = requireArg(args, 'tag');
    const releaseSourceCommit = String(args['release-source-commit'] ?? args.commit ?? '');
    if (!releaseSourceCommit) throw new Error('Missing required argument --release-source-commit');
    const workflowCommit = requireArg(args, 'workflow-commit');
    const releaseRef = requireArg(args, 'release-ref');
    const releaseMode = requireArg(args, 'release-mode');
    const macosDistributionStatus = requireArg(args, 'macos-distribution-status');
    const workflowRunId = String(args['workflow-run-id'] ?? process.env.GITHUB_RUN_ID ?? 'local');
    if (!['release', 'unsigned-preview'].includes(macosDistributionStatus)) {
      throw new Error(`Unsupported macOS distribution status: ${macosDistributionStatus}`);
    }
    const { manifest, checksumLines, summary } = buildReleaseMetadata({
      assetsDirectory,
      version,
      tag,
      releaseRef,
      releaseSourceCommit,
      workflowCommit,
      releaseMode,
      macosDistributionStatus,
      workflowRunId,
      draftReleaseStatus: String(args['draft-release-status'] ?? 'pending'),
    });
    writeJson(join(assetsDirectory, 'release-manifest.json'), manifest);
    writeFileSync(join(assetsDirectory, 'SHA256SUMS.txt'), `${checksumLines.join('\n')}\n`, 'utf8');
    writeFileSync(join(assetsDirectory, 'build-summary.md'), `${summary}\n`, 'utf8');
    console.log(`Release metadata generated for ${manifest.assets.length} assets.`);
  } catch (error) {
    console.error(`Release metadata generation failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
