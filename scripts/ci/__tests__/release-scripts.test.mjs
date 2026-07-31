import { execFileSync, spawnSync } from 'node:child_process';
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
import {
  assertPeArchitecture,
  assertValidPe,
  assertWindowsInstallerMetadata,
  PE_MACHINE_X64,
  PE_MACHINE_X86,
  readPeMachine,
  validateAssetSet,
  verifyWindows,
} from '../verify-release-assets.mjs';

const temporaryDirectories = [];

function temporaryDirectory() {
  const directory = mkdtempSync(join(tmpdir(), 'local-mindmap-release-test-'));
  temporaryDirectories.push(directory);
  return directory;
}

function writeAsset(path, size = 2048) {
  writeFileSync(path, Buffer.alloc(size, 0x5a));
}

function minimalPe(machine, { headerOffset = 0x80, signature = 'PE\0\0', size = 2048 } = {}) {
  const executable = Buffer.alloc(size);
  executable.write('MZ', 0, 'ascii');
  executable.writeUInt32LE(headerOffset, 0x3c);
  if (headerOffset + 6 <= executable.length) {
    executable.write(signature, headerOffset, 'ascii');
    executable.writeUInt16LE(machine, headerOffset + 4);
  }
  return executable;
}

function writePe(path, machine, options) {
  writeFileSync(path, minimalPe(machine, options));
}

function windowsFixture() {
  const directory = temporaryDirectory();
  const [installerDefinition, msiDefinition] = expectedAssets('windows', 'x64', '1.19.0');
  const installer = join(directory, installerDefinition.filename);
  const msi = join(directory, msiDefinition.filename);
  const appBinary = join(directory, 'local-mindmap.exe');
  writePe(installer, PE_MACHINE_X86);
  writeAsset(msi);
  writePe(appBinary, PE_MACHINE_X64);
  return { appBinary, directory, installer, msi };
}

const validWindowsMetadata = {
  installerProductVersion: '1.19.0',
  msiProductVersion: '1.19.0',
  msiTemplateSummary: 'x64;1033',
};

afterEach(() => {
  while (temporaryDirectories.length) {
    rmSync(temporaryDirectories.pop(), { recursive: true, force: true });
  }
});

describe('release version validation', () => {
  it('keeps the five release version sources aligned at 1.20.0', () => {
    expect(assertVersionState(PROJECT_ROOT, 'v1.20.0')).toMatchObject({ version: '1.20.0' });
  });

  it('rejects a tag that differs from the application version', () => {
    expect(() => assertVersionState(PROJECT_ROOT, 'v1.20.1')).toThrow('不一致');
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

describe('Windows PE and installer verification', () => {
  it('reads x86 and x64 machine values from valid minimal PE files', () => {
    const directory = temporaryDirectory();
    const x86 = join(directory, 'x86.exe');
    const x64 = join(directory, 'x64.exe');
    writePe(x86, PE_MACHINE_X86);
    writePe(x64, PE_MACHINE_X64);

    expect(readPeMachine(x86, 'x86 fixture')).toBe(PE_MACHINE_X86);
    expect(readPeMachine(x64, 'x64 fixture')).toBe(PE_MACHINE_X64);
    expect(assertValidPe(x86, 'NSIS 安装程序')).toBe(PE_MACHINE_X86);
    expect(assertPeArchitecture(x64, PE_MACHINE_X64, '应用主程序')).toBe(PE_MACHINE_X64);
  });

  it('rejects files without an MZ header and identifies the file role', () => {
    const path = join(temporaryDirectory(), 'not-pe.exe');
    writeAsset(path);
    expect(() => readPeMachine(path, '应用主程序')).toThrow(/应用主程序.*MZ/);
  });

  it('rejects a missing PE signature', () => {
    const path = join(temporaryDirectory(), 'missing-signature.exe');
    writePe(path, PE_MACHINE_X64, { signature: 'NOPE' });
    expect(() => readPeMachine(path, '应用主程序')).toThrow(/应用主程序.*PE/);
  });

  it('rejects an out-of-bounds PE header offset', () => {
    const path = join(temporaryDirectory(), 'bad-offset.exe');
    writeFileSync(path, minimalPe(PE_MACHINE_X64, { headerOffset: 0x1000, size: 128 }));
    expect(() => readPeMachine(path, '应用主程序')).toThrow(/应用主程序.*偏移越界/);
  });

  it('accepts an x86 NSIS stub while verifying the x64 application binary', () => {
    const fixture = windowsFixture();
    const nativeVerification = verifyWindows(fixture.directory, '1.19.0', fixture.appBinary, {
      inspectInstaller: () => validWindowsMetadata,
    });

    expect(nativeVerification).toEqual({
      installerMachine: '0x14c',
      applicationMachine: '0x8664',
      applicationArchitecture: 'x64',
      msiPlatform: 'x64',
    });
    expect(JSON.stringify(nativeVerification)).not.toContain(fixture.directory);
  });

  it('rejects an x86 application binary', () => {
    const fixture = windowsFixture();
    writePe(fixture.appBinary, PE_MACHINE_X86);
    expect(() => verifyWindows(fixture.directory, '1.19.0', fixture.appBinary, {
      inspectInstaller: () => validWindowsMetadata,
    })).toThrow(/应用主程序架构错误.*0x8664.*0x14c/);
  });

  it('requires an explicit app-binary argument', () => {
    const fixture = windowsFixture();
    expect(() => verifyWindows(fixture.directory, '1.19.0', undefined, {
      inspectInstaller: () => validWindowsMetadata,
    })).toThrow('--app-binary');
  });

  it('fails the Windows CLI when app-binary is omitted or native verification is skipped', () => {
    const fixture = windowsFixture();
    const verifier = join(PROJECT_ROOT, 'scripts', 'ci', 'verify-release-assets.mjs');
    const baseArgs = [
      verifier,
      '--platform', 'windows',
      '--arch', 'x64',
      '--version', '1.19.0',
      '--release-dir', fixture.directory,
    ];
    const missingApp = spawnSync(process.execPath, baseArgs, { encoding: 'utf8' });
    expect(missingApp.status).toBe(1);
    expect(missingApp.stderr).toContain('--app-binary');

    const skipped = spawnSync(process.execPath, [...baseArgs, '--skip-native'], { encoding: 'utf8' });
    expect(skipped.status).toBe(1);
    expect(skipped.stderr).toContain('不允许使用 --skip-native');
  });

  it('rejects a missing or empty application binary', () => {
    const fixture = windowsFixture();
    expect(() => verifyWindows(fixture.directory, '1.19.0', join(fixture.directory, 'missing.exe'), {
      inspectInstaller: () => validWindowsMetadata,
    })).toThrow(/应用主程序不存在/);

    writeFileSync(fixture.appBinary, Buffer.alloc(0));
    expect(() => verifyWindows(fixture.directory, '1.19.0', fixture.appBinary, {
      inspectInstaller: () => validWindowsMetadata,
    })).toThrow(/应用主程序为空文件/);
  });

  it('rejects mismatched NSIS and MSI ProductVersion values', () => {
    expect(() => assertWindowsInstallerMetadata({
      ...validWindowsMetadata,
      installerProductVersion: '1.18.0',
    }, '1.19.0')).toThrow('NSIS ProductVersion 不匹配');
    expect(() => assertWindowsInstallerMetadata({
      ...validWindowsMetadata,
      msiProductVersion: '1.18.0',
    }, '1.19.0')).toThrow('MSI ProductVersion 不匹配');
  });

  it('accepts an x64 MSI Template Summary case-insensitively', () => {
    expect(assertWindowsInstallerMetadata({
      ...validWindowsMetadata,
      msiTemplateSummary: 'X64;1033',
    }, '1.19.0')).toEqual({ msiPlatform: 'x64' });
  });

  it('rejects Intel and Intel64 MSI Template Summary platforms', () => {
    for (const template of ['Intel;1033', 'Intel64;1033']) {
      expect(() => assertWindowsInstallerMetadata({
        ...validWindowsMetadata,
        msiTemplateSummary: template,
      }, '1.19.0')).toThrow(/Template Summary platform 不是 x64/);
    }
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
    expect(workflow).toContain('if [ "${{ matrix.user_platform }}" = "windows" ]');
    expect(workflow).toContain('--app-binary "src-tauri/target/${{ matrix.rust_target }}/release/local-mindmap.exe"');
  });
});
