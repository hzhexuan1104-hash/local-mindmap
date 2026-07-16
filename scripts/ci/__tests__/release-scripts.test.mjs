import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  assertVersionState,
  expectedAssets,
  PROJECT_ROOT,
  sha256,
} from '../release-utils.mjs';
import { buildReleaseMetadata } from '../create-release-metadata.mjs';
import { validateAssetSet } from '../verify-release-assets.mjs';

const temporaryDirectories = [];

function temporaryDirectory() {
  const directory = mkdtempSync(join(tmpdir(), 'local-mindmap-release-test-'));
  temporaryDirectories.push(directory);
  return directory;
}

function writeAsset(path, size = 2048) {
  writeFileSync(path, Buffer.alloc(size, 0x5a));
}

afterEach(() => {
  while (temporaryDirectories.length) {
    rmSync(temporaryDirectories.pop(), { recursive: true, force: true });
  }
});

describe('release version validation', () => {
  it('keeps the five release version sources aligned at 1.19.0', () => {
    expect(assertVersionState(PROJECT_ROOT, 'v1.19.0')).toMatchObject({ version: '1.19.0' });
  });

  it('rejects a tag that differs from the application version', () => {
    expect(() => assertVersionState(PROJECT_ROOT, 'v1.19.1')).toThrow('不一致');
  });
});

describe('release asset collection and validation', () => {
  it('renames only current Windows build assets and rejects stale candidates', () => {
    const root = temporaryDirectory();
    const bundleDirectory = join(root, 'src-tauri', 'target', 'x86_64-pc-windows-msvc', 'release', 'bundle', 'nsis');
    const msiDirectory = join(root, 'src-tauri', 'target', 'x86_64-pc-windows-msvc', 'release', 'bundle', 'msi');
    mkdirSync(bundleDirectory, { recursive: true });
    mkdirSync(msiDirectory, { recursive: true });
    const exe = join(bundleDirectory, 'Local Mindmap_1.19.0_x64-setup.exe');
    const msi = join(msiDirectory, 'Local Mindmap_1.19.0_x64_en-US.msi');
    const stale = join(bundleDirectory, 'Local Mindmap_1.18.0_x64-setup.exe');
    writeAsset(exe);
    writeAsset(msi);
    writeAsset(stale);
    utimesSync(stale, new Date('2020-01-01T00:00:00Z'), new Date('2020-01-01T00:00:00Z'));
    const output = join(root, 'dist', 'release', 'windows-x64');
    execFileSync(process.execPath, [
      join(PROJECT_ROOT, 'scripts', 'ci', 'collect-release-assets.mjs'),
      '--root', root,
      '--platform', 'windows',
      '--arch', 'x64',
      '--target', 'x86_64-pc-windows-msvc',
      '--version', '1.19.0',
      '--build-start', '2025-01-01T00:00:00Z',
      '--out', output,
    ]);
    const records = validateAssetSet(output, 'windows', 'x64', '1.19.0');
    expect(records.map((record) => record.filename)).toEqual([
      'Local-Mindmap_1.19.0_windows_x64-setup.exe',
      'Local-Mindmap_1.19.0_windows_x64.msi',
    ]);
  });
});

describe('release metadata', () => {
  it('generates deterministic user asset checksums and candidate UOS status', () => {
    const assetsDirectory = temporaryDirectory();
    for (const [platform, arch] of [
      ['windows', 'x64'],
      ['macos', 'arm64'],
      ['macos', 'x64'],
      ['uos', 'x64'],
      ['uos', 'arm64'],
    ]) {
      for (const asset of expectedAssets(platform, arch, '1.19.0')) {
        const path = join(assetsDirectory, asset.filename);
        writeAsset(path);
      }
    }
    const { manifest, checksumLines } = buildReleaseMetadata({
      assetsDirectory,
      version: '1.19.0',
      tag: 'v1.19.0',
      commit: 'a'.repeat(40),
      workflowRunId: '123',
      builtAt: '2026-07-16T00:00:00.000Z',
    });
    expect(manifest.artifacts).toHaveLength(8);
    expect(
      manifest.artifacts
        .filter((artifact) => artifact.platform === 'uos')
        .every((artifact) => artifact.compatibilityStatus === 'candidate'),
    ).toBe(true);
    expect(checksumLines).toEqual([...checksumLines].sort());
    const windowsExe = join(assetsDirectory, 'Local-Mindmap_1.19.0_windows_x64-setup.exe');
    expect(checksumLines.join('\n')).toContain(sha256(windowsExe));
    expect(JSON.stringify(manifest)).not.toContain(assetsDirectory);
    expect(readFileSync(windowsExe).length).toBeGreaterThan(1024);
  });

  it('rejects an unexpected old installer before a Draft Release is made', () => {
    const assetsDirectory = temporaryDirectory();
    writeAsset(join(assetsDirectory, 'Local-Mindmap_1.18.0_windows_x64-setup.exe'));
    expect(() => buildReleaseMetadata({
      assetsDirectory,
      version: '1.19.0',
      tag: 'v1.19.0',
      commit: 'a'.repeat(40),
      workflowRunId: '123',
    })).toThrow('旧版本');
  });
});

describe('release workflow contract', () => {
  it('contains the five native targets and a tag-only Draft Release gate', () => {
    const workflow = readFileSync(join(PROJECT_ROOT, '.github', 'workflows', 'release-multiplatform.yml'), 'utf8');
    expect(workflow).toContain("- 'v*.*.*'");
    expect(workflow).toContain('windows-x64');
    expect(workflow).toContain('macos-arm64');
    expect(workflow).toContain('macos-x64');
    expect(workflow).toContain('uos-x64');
    expect(workflow).toContain('uos-arm64');
    expect(workflow).toContain('ubuntu-22.04-arm');
    expect(workflow).toContain('actions/upload-artifact@v7');
    expect(workflow).toContain('actions/download-artifact@v8');
    expect(workflow).toContain("github.event_name == 'push'");
    expect(workflow).toContain('--draft');
  });
});
