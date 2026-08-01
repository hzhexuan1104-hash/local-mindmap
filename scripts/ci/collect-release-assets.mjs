import { existsSync, statSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import {
  assertInside,
  copyAsset,
  ensureEmptyDirectory,
  expectedAssets,
  listFilesRecursive,
  parseArgs,
  PROJECT_ROOT,
  requireArg,
  readPackageVersion,
} from './release-utils.mjs';

function parseBuildStart(value) {
  if (!value) return undefined;
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) throw new Error(`--build-start 不是有效 ISO 时间：${value}`);
  return timestamp;
}

function sourceDirectories(root, target) {
  const targetRoot = resolve(root, 'src-tauri', 'target');
  return [
    join(targetRoot, target, 'release', 'bundle'),
    join(targetRoot, 'release', 'bundle'),
  ].filter((directory, index, all) => all.indexOf(directory) === index && existsSync(directory));
}

function findSourceAsset(directories, definition, version, buildStart) {
  const candidates = directories
    .flatMap(listFilesRecursive)
    .filter((path) => path.toLowerCase().endsWith(definition.extension.toLowerCase()))
    .filter((path) => basename(path).includes(version))
    .filter((path) => !buildStart || statSync(path).mtimeMs >= buildStart)
    .sort();
  if (candidates.length !== 1) {
    throw new Error(
      `期望找到唯一的 ${definition.format} 产物，实际 ${candidates.length} 个：${candidates.map((path) => basename(path)).join(', ') || '无'}`,
    );
  }
  const candidate = candidates[0];
  if (statSync(candidate).size < 1024) throw new Error(`产物过小，拒绝收集：${candidate}`);
  return candidate;
}

try {
  const args = parseArgs(process.argv.slice(2));
  const root = resolve(args.root ?? PROJECT_ROOT);
  const platform = requireArg(args, 'platform');
  const arch = requireArg(args, 'arch');
  const target = requireArg(args, 'target');
  const version = args.version ?? readPackageVersion(root);
  const variant = typeof args.variant === 'string' && args.variant
    ? (args.variant.startsWith('_') ? args.variant : `_${args.variant}`)
    : '';
  const buildStart = parseBuildStart(args['build-start'] ?? process.env.RELEASE_BUILD_STARTED_AT);
  const outputDirectory = assertInside(root, resolve(args.out ?? join(root, 'dist', 'release', `${platform}-${arch}`)));
  const directories = sourceDirectories(root, target);
  if (directories.length === 0) throw new Error(`未找到 Tauri bundle 输出目录（target=${target}）。`);

  ensureEmptyDirectory(outputDirectory);
  const collected = expectedAssets(platform, arch, version, { variant }).map((definition) => {
    const source = findSourceAsset(directories, definition, version, buildStart);
    const destination = join(outputDirectory, definition.filename);
    copyAsset(source, destination);
    return { source: basename(source), destination: definition.filename, format: definition.format };
  });
  console.log(JSON.stringify({ platform, arch, version, outputDirectory, collected }, null, 2));
} catch (error) {
  console.error(`Release asset collection failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
