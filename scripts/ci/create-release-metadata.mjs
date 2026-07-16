import { writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  expectedAssets,
  listFilesRecursive,
  parseArgs,
  PROJECT_ROOT,
  requireArg,
  releaseFileRecord,
  writeJson,
} from './release-utils.mjs';

const RELEASE_TARGETS = [
  ['windows', 'x64'],
  ['macos', 'arm64'],
  ['macos', 'x64'],
  ['uos', 'x64'],
  ['uos', 'arm64'],
];

function expectedReleaseAssets(version) {
  return RELEASE_TARGETS.flatMap(([platform, arch]) =>
    expectedAssets(platform, arch, version).map((asset) => ({ ...asset, platform, arch })),
  );
}

export function buildReleaseMetadata({ assetsDirectory, version, tag, commit, workflowRunId, builtAt = new Date().toISOString() }) {
  const expected = expectedReleaseAssets(version);
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
  const artifacts = expected.map((asset) => {
    const path = filesByName.get(asset.filename);
    if (!path) throw new Error(`缺少 Release 资产：${asset.filename}`);
    const record = releaseFileRecord(path, assetsDirectory);
    return {
      filename: record.filename,
      platform: asset.platform,
      arch: asset.arch,
      format: asset.format,
      sha256: record.sha256,
      size: record.size,
      signed: asset.platform === 'macos',
      notarized: asset.platform === 'macos',
      compatibilityStatus: asset.platform === 'uos' ? 'candidate' : asset.platform === 'macos' ? 'verified' : 'candidate',
    };
  });
  const manifest = {
    schemaVersion: 1,
    appName: 'Local Mindmap',
    version,
    tag,
    commit,
    builtAt,
    workflowRunId,
    artifacts,
  };
  const checksumLines = artifacts
    .slice()
    .sort((left, right) => left.filename.localeCompare(right.filename))
    .map((artifact) => `${artifact.sha256}  ${artifact.filename}`);
  const summary = [
    '# Local Mindmap release build summary',
    '',
    `- Version: ${version}`,
    `- Tag: ${tag}`,
    `- Commit: ${commit}`,
    `- Workflow run: ${workflowRunId}`,
    '',
    '| Asset | Platform | Architecture | SHA-256 | Compatibility |',
    '| --- | --- | --- | --- | --- |',
    ...artifacts.map((artifact) => `| ${artifact.filename} | ${artifact.platform} | ${artifact.arch} | ${artifact.sha256} | ${artifact.compatibilityStatus} |`),
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
    const commit = requireArg(args, 'commit');
    const workflowRunId = String(args['workflow-run-id'] ?? process.env.GITHUB_RUN_ID ?? 'local');
    if (tag !== `v${version}`) throw new Error(`tag ${tag} 与版本 ${version} 不一致。`);
    const { manifest, checksumLines, summary } = buildReleaseMetadata({ assetsDirectory, version, tag, commit, workflowRunId });
    writeJson(join(assetsDirectory, 'release-manifest.json'), manifest);
    writeFileSync(join(assetsDirectory, 'SHA256SUMS.txt'), `${checksumLines.join('\n')}\n`, 'utf8');
    writeFileSync(join(assetsDirectory, 'build-summary.md'), `${summary}\n`, 'utf8');
    console.log(`Release metadata generated for ${manifest.artifacts.length} assets.`);
  } catch (error) {
    console.error(`Release metadata generation failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
