import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildReleaseMetadata } from './create-release-metadata.mjs';
import { expectedAssets, parseArgs, readPackageVersion } from './release-utils.mjs';

const TARGETS = [
  ['windows', 'x64'],
  ['macos', 'arm64'],
  ['macos', 'x64'],
  ['uos', 'x64'],
  ['uos', 'arm64'],
];

try {
  const args = parseArgs(process.argv.slice(2));
  const version = String(args.version ?? readPackageVersion());
  const assetsDirectory = mkdtempSync(join(tmpdir(), 'local-mindmap-unsigned-manifest-'));
  try {
    for (const [platform, arch] of TARGETS) {
      const variant = platform === 'macos' ? '_unsigned_preview' : '';
      for (const asset of expectedAssets(platform, arch, version, { variant })) {
        writeFileSync(join(assetsDirectory, asset.filename), Buffer.alloc(1024, 0x5a));
      }
    }
    const { manifest } = buildReleaseMetadata({
      assetsDirectory,
      version,
      tag: `v${version}`,
      releaseRef: `v${version}`,
      releaseSourceCommit: 'a'.repeat(40),
      workflowCommit: 'b'.repeat(40),
      releaseMode: 'manual-tag-repair',
      macosDistributionStatus: 'unsigned-preview',
      workflowRunId: 'dry-run',
      generatedAt: '2026-01-01T00:00:00.000Z',
    });
    console.log(JSON.stringify(manifest, null, 2));
  } finally {
    rmSync(assetsDirectory, { recursive: true, force: true });
  }
} catch (error) {
  console.error(`Unsigned release manifest dry-run failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
