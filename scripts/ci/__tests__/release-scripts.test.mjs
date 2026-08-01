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
import { buildReleaseNotes, UNSIGNED_MACOS_WARNING } from '../generate-release-notes.mjs';
import {
  APPLE_SIGNING_SECRETS,
  getAppleSigningState,
  getMacosDistributionMode,
} from '../check-apple-signing-state.mjs';
import {
  resolveReleaseRef,
  selectReleaseRef,
  V120_RELEASE_COMMIT,
} from '../resolve-release-ref.mjs';
import { assertSafeDraftUpdate } from '../publish-draft-release.mjs';
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

describe('release source and Apple signing decisions', () => {
  it('uses the selected workflow branch when a manual release_ref is empty', () => {
    expect(selectReleaseRef({
      eventName: 'workflow_dispatch',
      releaseRef: '',
      githubRef: 'refs/heads/main',
      githubRefName: 'main',
    })).toBe('refs/heads/main');
  });

  it('resolves v1.20.0 to its immutable release source commit while keeping workflow commit separate', () => {
    const calls = [];
    const gitRunner = (_root, args) => {
      calls.push(args);
      if (args[0] === 'rev-parse' && args[2] === 'v1.20.0^{commit}') return V120_RELEASE_COMMIT;
      if (args[0] === 'rev-list') return V120_RELEASE_COMMIT;
      throw new Error(`Unexpected git call: ${args.join(' ')}`);
    };
    expect(resolveReleaseRef({
      eventName: 'workflow_dispatch',
      releaseRef: 'v1.20.0',
      workflowCommit: 'f'.repeat(40),
      gitRunner,
    })).toEqual({
      release_ref: 'v1.20.0',
      release_tag: 'v1.20.0',
      release_commit: V120_RELEASE_COMMIT,
      workflow_commit: 'f'.repeat(40),
      is_tag_release: true,
    });
    expect(calls).toHaveLength(2);
  });

  it('rejects a moved v1.20.0 tag', () => {
    const gitRunner = (_root, args) => {
      if (args[0] === 'rev-parse') return 'a'.repeat(40);
      return 'a'.repeat(40);
    };
    expect(() => resolveReleaseRef({
      eventName: 'workflow_dispatch',
      releaseRef: 'v1.20.0',
      workflowCommit: 'f'.repeat(40),
      gitRunner,
    })).toThrow(V120_RELEASE_COMMIT);
  });

  it('fails when the requested tag cannot be resolved', () => {
    expect(() => resolveReleaseRef({
      eventName: 'workflow_dispatch',
      releaseRef: 'v9.9.9',
      workflowCommit: 'f'.repeat(40),
      gitRunner: () => { throw new Error('unknown revision'); },
    })).toThrow('unknown revision');
  });

  it('requires all seven Apple secrets and never returns their values', () => {
    const complete = Object.fromEntries(APPLE_SIGNING_SECRETS.map((name) => [name, `secret-${name}`]));
    expect(getAppleSigningState(complete)).toEqual({
      apple_signing_ready: true,
      missing_apple_secrets: [],
    });
    const incomplete = getAppleSigningState({ ...complete, APPLE_PASSWORD: '' });
    expect(incomplete).toEqual({
      apple_signing_ready: false,
      missing_apple_secrets: ['APPLE_PASSWORD'],
    });
    expect(JSON.stringify(incomplete)).not.toContain('secret-');
  });

  it('only selects unsigned preview after an explicit opt-in', () => {
    expect(getMacosDistributionMode({ signingReady: true, allowUnsigned: true })).toBe('release');
    expect(getMacosDistributionMode({ signingReady: false, allowUnsigned: true })).toBe('unsigned-preview');
    expect(getMacosDistributionMode({ signingReady: false, allowUnsigned: false })).toBe('rejected');
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
      releaseRef: 'v1.19.0',
      releaseSourceCommit: 'a'.repeat(40),
      workflowCommit: 'b'.repeat(40),
      releaseMode: 'manual-tag-repair',
      macosDistributionStatus: 'release',
      workflowRunId: '123',
      generatedAt: '2026-07-16T00:00:00.000Z',
    });
    expect(manifest.assets).toHaveLength(8);
    expect(
      manifest.assets
        .filter((artifact) => artifact.platform === 'uos')
        .every((artifact) => artifact.compatibilityStatus === 'candidate'),
    ).toBe(true);
    expect(manifest.releaseSourceCommit).toBe('a'.repeat(40));
    expect(manifest.workflowCommit).toBe('b'.repeat(40));
    expect(
      manifest.assets
        .filter((artifact) => artifact.platform === 'macos')
        .every((artifact) => artifact.signed === true && artifact.notarized === true),
    ).toBe(true);
    expect(checksumLines).toEqual([...checksumLines].sort());
    const windowsExe = join(assetsDirectory, 'Local-Mindmap_1.19.0_windows_x64-setup.exe');
    expect(checksumLines.join('\n')).toContain(sha256(windowsExe));
    expect(JSON.stringify(manifest)).not.toContain(assetsDirectory);
    expect(JSON.stringify(manifest)).not.toContain('secret-');
    expect(readFileSync(windowsExe).length).toBeGreaterThan(1024);
  });

  it('rejects an unexpected old installer before a Draft Release is made', () => {
    const assetsDirectory = temporaryDirectory();
    writeAsset(join(assetsDirectory, 'Local-Mindmap_1.18.0_windows_x64-setup.exe'));
    expect(() => buildReleaseMetadata({
      assetsDirectory,
      version: '1.19.0',
      tag: 'v1.19.0',
      releaseRef: 'v1.19.0',
      releaseSourceCommit: 'a'.repeat(40),
      workflowCommit: 'b'.repeat(40),
      releaseMode: 'manual-tag-repair',
      macosDistributionStatus: 'release',
      workflowRunId: '123',
    })).toThrow('旧版本');
  });
  it('labels unsigned macOS preview assets without using formal filenames', () => {
    const assetsDirectory = temporaryDirectory();
    for (const [platform, arch] of [
      ['windows', 'x64'], ['macos', 'arm64'], ['macos', 'x64'], ['uos', 'x64'], ['uos', 'arm64'],
    ]) {
      const variant = platform === 'macos' ? '_unsigned_preview' : '';
      for (const asset of expectedAssets(platform, arch, '1.19.0', { variant })) {
        writeAsset(join(assetsDirectory, asset.filename));
      }
    }
    const { manifest } = buildReleaseMetadata({
      assetsDirectory,
      version: '1.19.0',
      tag: 'v1.19.0',
      releaseRef: 'v1.19.0',
      releaseSourceCommit: 'a'.repeat(40),
      workflowCommit: 'b'.repeat(40),
      releaseMode: 'manual-tag-repair',
      macosDistributionStatus: 'unsigned-preview',
      workflowRunId: '123',
    });
    const macosAssets = manifest.assets.filter((asset) => asset.platform === 'macos');
    expect(macosAssets.every((asset) => asset.filename.includes('_unsigned_preview.dmg'))).toBe(true);
    expect(macosAssets.every((asset) => asset.signed === false && asset.notarized === false)).toBe(true);
    expect(macosAssets.every((asset) => asset.distributionStatus === 'unsigned-preview')).toBe(true);
    expect(macosAssets.every((asset) => asset.userActionRequired?.includes('not notarized'))).toBe(true);
  });
});

describe('Draft Release safety and notes', () => {
  const unsignedManifest = {
    tag: 'v1.20.0',
    releaseSourceCommit: 'a'.repeat(40),
    workflowCommit: 'b'.repeat(40),
    assets: [
      { platform: 'macos', arch: 'arm64', filename: 'Local-Mindmap_1.20.0_macos_arm64_unsigned_preview.dmg', distributionStatus: 'unsigned-preview' },
      { platform: 'macos', arch: 'x64', filename: 'Local-Mindmap_1.20.0_macos_x64_unsigned_preview.dmg', distributionStatus: 'unsigned-preview' },
      { platform: 'windows', arch: 'x64', filename: 'Local-Mindmap_1.20.0_windows_x64.msi', distributionStatus: 'release' },
    ],
  };

  it('adds the required warning only when a macOS asset is unsigned preview', () => {
    const unsignedNotes = buildReleaseNotes(unsignedManifest);
    expect(unsignedNotes).toContain(UNSIGNED_MACOS_WARNING);
    expect(unsignedNotes).toContain('Unsigned Preview');
    const signedNotes = buildReleaseNotes({
      ...unsignedManifest,
      assets: unsignedManifest.assets.map((asset) => ({ ...asset, distributionStatus: 'release' })),
    });
    expect(signedNotes).not.toContain(UNSIGNED_MACOS_WARNING);
  });

  it('only permits update of a workflow-managed Draft with the same source commit', () => {
    const release = {
      isDraft: true,
      targetCommitish: 'a'.repeat(40),
      body: '<!-- local-mindmap-workflow-managed: true -->\n<!-- local-mindmap-release-source-commit: ' + 'a'.repeat(40) + ' -->',
    };
    expect(() => assertSafeDraftUpdate(release, {
      tag: 'v1.20.0',
      releaseSourceCommit: 'a'.repeat(40),
    })).not.toThrow();
    expect(() => assertSafeDraftUpdate({ ...release, isDraft: false }, {
      tag: 'v1.20.0',
      releaseSourceCommit: 'a'.repeat(40),
    })).toThrow('published');
    expect(() => assertSafeDraftUpdate({ ...release, targetCommitish: 'c'.repeat(40) }, {
      tag: 'v1.20.0',
      releaseSourceCommit: 'a'.repeat(40),
    })).toThrow('not');
    expect(() => assertSafeDraftUpdate({ ...release, body: '' }, {
      tag: 'v1.20.0',
      releaseSourceCommit: 'a'.repeat(40),
    })).toThrow('unknown asset provenance');
  });
});

describe('release workflow contract', () => {
  it('contains five native targets, immutable release source checkout, and unsigned macOS safeguards', () => {
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
    expect(workflow).toContain('release_ref:');
    expect(workflow).toContain('allow_unsigned_macos:');
    expect(workflow).toContain('resolve-release-ref.mjs');
    expect(workflow).toContain('check-apple-signing-state.mjs');
    expect(workflow).toContain('needs.preflight.outputs.release_commit');
    expect(workflow).toContain('needs.preflight.outputs.workflow_commit');
    expect(workflow).toContain('_unsigned_preview');
    expect(workflow).toContain('notarytool submit');
    expect(workflow).toContain("github.event_name == 'workflow_dispatch' && inputs.create_draft_release");
    expect(workflow).toContain('--draft');
    expect(workflow).toContain('if [ "${{ matrix.user_platform }}" = "windows" ]');
    expect(workflow).toContain('--app-binary "$GITHUB_WORKSPACE/release-source/src-tauri/target/${{ matrix.rust_target }}/release/local-mindmap.exe"');
  });
});
