import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import {
  expectedAssets,
  parseArgs,
  PROJECT_ROOT,
  requireArg,
  runChecked,
  sha256,
  writeJson,
} from './release-utils.mjs';

const MIN_ASSET_SIZE = 1024;
const PE_HEADER_POINTER_OFFSET = 0x3c;
const PE_SIGNATURE_SIZE = 4;
const PE_MACHINE_SIZE = 2;
export const PE_MACHINE_X86 = 0x14c;
export const PE_MACHINE_X64 = 0x8664;

export function validateAssetSet(directory, platform, arch, version, { variant = '' } = {}) {
  const expected = expectedAssets(platform, arch, version, { variant });
  const records = expected.map((definition) => {
    const path = join(directory, definition.filename);
    const stats = statSync(path, { throwIfNoEntry: false });
    if (!stats?.isFile()) throw new Error(`缺少预期产物：${definition.filename}`);
    if (stats.size < MIN_ASSET_SIZE) throw new Error(`产物过小：${definition.filename}`);
    return {
      filename: definition.filename,
      format: definition.format,
      size: stats.size,
      sha256: sha256(path),
    };
  });
  return records;
}

function formatPeMachine(machine) {
  return `0x${machine.toString(16)}`;
}

export function readPeMachine(path, description = 'PE 文件') {
  const stats = statSync(path, { throwIfNoEntry: false });
  if (!stats?.isFile()) throw new Error(`${description}不存在或不是文件：${path}`);
  if (stats.size === 0) throw new Error(`${description}为空文件：${path}`);

  const executable = readFileSync(path);
  if (executable.length < 2 || executable.subarray(0, 2).toString('ascii') !== 'MZ') {
    throw new Error(`${description}不是合法 PE 文件（缺少 MZ 头）：${path}`);
  }
  if (executable.length < PE_HEADER_POINTER_OFFSET + 4) {
    throw new Error(`${description}不是合法 PE 文件（DOS 头长度不足）：${path}`);
  }

  const headerOffset = executable.readUInt32LE(PE_HEADER_POINTER_OFFSET);
  const minimumPeHeaderLength = PE_SIGNATURE_SIZE + PE_MACHINE_SIZE;
  if (headerOffset > executable.length - minimumPeHeaderLength) {
    throw new Error(`${description}的 PE 头偏移越界：${path}`);
  }
  if (executable.subarray(headerOffset, headerOffset + PE_SIGNATURE_SIZE).toString('ascii') !== 'PE\0\0') {
    throw new Error(`${description}缺少 PE\\0\\0 头：${path}`);
  }
  return executable.readUInt16LE(headerOffset + PE_SIGNATURE_SIZE);
}

export function assertValidPe(path, description) {
  return readPeMachine(path, description);
}

export function assertPeArchitecture(path, expectedMachine, description) {
  const machine = readPeMachine(path, description);
  if (machine !== expectedMachine) {
    throw new Error(`${description}架构错误，期望 machine=${formatPeMachine(expectedMachine)}，实际 machine=${formatPeMachine(machine)}：${path}`);
  }
  return machine;
}

export function inspectWindowsInstaller(exe, msi) {
  const script = [
    "$ErrorActionPreference = 'Stop'",
    '$exeVersion = (Get-Item -LiteralPath $env:RELEASE_EXE).VersionInfo.ProductVersion',
    '$installer = New-Object -ComObject WindowsInstaller.Installer',
    '$database = $installer.OpenDatabase($env:RELEASE_MSI, 0)',
    '$view = $database.OpenView("SELECT `Value` FROM `Property` WHERE `Property` = \'ProductVersion\'")',
    '$view.Execute()',
    '$record = $view.Fetch()',
    "if (-not $record) { throw 'MSI 缺少 ProductVersion 属性' }",
    '$summary = $installer.SummaryInformation($env:RELEASE_MSI, 0)',
    '$template = [string]$summary.Property(7)',
    '[pscustomobject]@{ installerProductVersion = [string]$exeVersion; msiProductVersion = [string]$record.StringData(1); msiTemplateSummary = $template } | ConvertTo-Json -Compress',
  ].join('; ');
  const output = runChecked('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], {
    env: { ...process.env, RELEASE_EXE: exe, RELEASE_MSI: msi },
  });
  try {
    return JSON.parse(output);
  } catch (error) {
    throw new Error(`无法解析 Windows 安装程序元数据：${error instanceof Error ? error.message : String(error)}`);
  }
}

export function assertWindowsInstallerMetadata(metadata, version) {
  if (metadata?.installerProductVersion !== version) {
    throw new Error(`NSIS ProductVersion 不匹配，期望 ${version}，实际 ${metadata?.installerProductVersion || '空'}`);
  }
  if (metadata?.msiProductVersion !== version) {
    throw new Error(`MSI ProductVersion 不匹配，期望 ${version}，实际 ${metadata?.msiProductVersion || '空'}`);
  }
  const templateSummary = typeof metadata?.msiTemplateSummary === 'string' ? metadata.msiTemplateSummary : '';
  const msiPlatform = templateSummary.split(';', 1)[0].trim();
  if (msiPlatform.toLowerCase() !== 'x64') {
    throw new Error(`MSI Template Summary platform 不是 x64：${templateSummary || '空'}`);
  }
  return { msiPlatform: 'x64' };
}

export function verifyWindows(directory, version, appBinary, { inspectInstaller = inspectWindowsInstaller } = {}) {
  if (!appBinary) throw new Error('Windows 原生架构验证缺少必填参数 --app-binary');
  const [exe, msi] = expectedAssets('windows', 'x64', version).map((asset) => join(directory, asset.filename));
  const installerMachine = assertValidPe(exe, 'NSIS 安装程序');
  const applicationMachine = assertPeArchitecture(appBinary, PE_MACHINE_X64, 'Local Mindmap 应用主程序');
  const metadata = inspectInstaller(exe, msi);
  const { msiPlatform } = assertWindowsInstallerMetadata(metadata, version);
  return {
    installerMachine: formatPeMachine(installerMachine),
    applicationMachine: formatPeMachine(applicationMachine),
    applicationArchitecture: 'x64',
    msiPlatform,
  };
}

function mountedMacApp(mountPoint) {
  const applications = runChecked('find', [mountPoint, '-maxdepth', '2', '-type', 'd', '-name', '*.app'])
    .split(/\r?\n/)
    .filter(Boolean);
  if (applications.length !== 1) throw new Error(`DMG 中应恰有一个 .app，实际 ${applications.length} 个。`);
  return applications[0];
}

function verifyMacos(directory, arch, version, signed) {
  const [definition] = expectedAssets('macos', arch, version, { variant: signed ? '' : '_preview' });
  const dmg = join(directory, definition.filename);
  runChecked('hdiutil', ['verify', dmg]);
  const mountPoint = mkdtempSync(join(tmpdir(), 'local-mindmap-dmg-'));
  try {
    runChecked('hdiutil', ['attach', '-readonly', '-nobrowse', '-mountpoint', mountPoint, dmg]);
    const app = mountedMacApp(mountPoint);
    const executable = join(app, 'Contents', 'MacOS', 'local-mindmap');
    const architecture = runChecked('lipo', ['-info', executable]);
    const expectedArchitecture = arch === 'arm64' ? 'arm64' : 'x86_64';
    const unexpectedArchitecture = arch === 'arm64' ? 'x86_64' : 'arm64';
    if (!architecture.includes(expectedArchitecture) || architecture.includes(unexpectedArchitecture)) {
      throw new Error(`macOS 应用架构不符合 ${arch} 单架构要求：${architecture}`);
    }
    if (signed) {
      runChecked('codesign', ['--verify', '--deep', '--strict', app]);
      runChecked('xcrun', ['stapler', 'validate', app]);
    }
  } finally {
    try {
      runChecked('hdiutil', ['detach', mountPoint, '-quiet']);
    } catch {
      // The verification error is more useful than a detach cleanup error.
    }
    rmSync(mountPoint, { recursive: true, force: true });
  }
}

function verifyUos(directory, arch, version) {
  const [debDefinition, appImageDefinition] = expectedAssets('uos', arch, version);
  const deb = join(directory, debDefinition.filename);
  const appImage = join(directory, appImageDefinition.filename);
  const expectedDebArch = arch === 'arm64' ? 'arm64' : 'amd64';
  if (runChecked('dpkg-deb', ['-f', deb, 'Architecture']) !== expectedDebArch) {
    throw new Error(`DEB 架构应为 ${expectedDebArch}。`);
  }
  if (runChecked('dpkg-deb', ['-f', deb, 'Version']) !== version) {
    throw new Error(`DEB 版本应为 ${version}。`);
  }
  const contents = runChecked('dpkg-deb', ['-c', deb]);
  if (!contents.includes('.desktop')) throw new Error('DEB 缺少 desktop 文件。');
  if (!contents.match(/icons?.*\.(png|svg)/i)) throw new Error('DEB 缺少应用图标。');
  if ((statSync(appImage).mode & 0o111) === 0) throw new Error('AppImage 缺少可执行权限。');
  const fileDescription = runChecked('file', ['-b', appImage]);
  const expectedElfArch = arch === 'arm64' ? /aarch64|ARM aarch64/i : /x86-64|x86_64/i;
  if (!expectedElfArch.test(fileDescription)) throw new Error(`AppImage ELF 架构错误：${fileDescription}`);
  const extractDirectory = mkdtempSync(join(tmpdir(), 'local-mindmap-appimage-'));
  try {
    runChecked(appImage, ['--appimage-extract'], { cwd: extractDirectory });
  } finally {
    rmSync(extractDirectory, { recursive: true, force: true });
  }
}

export function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    const platform = requireArg(args, 'platform');
    const arch = requireArg(args, 'arch');
    const version = requireArg(args, 'version');
    const directory = resolve(args['release-dir'] ?? join(args.root ?? PROJECT_ROOT, 'dist', 'release', `${platform}-${arch}`));
    const variant = typeof args.variant === 'string' && args.variant ? `_${args.variant}` : '';
    const signed = args['macos-signed'] === 'true';
    const records = validateAssetSet(directory, platform, arch, version, { variant });
    if (platform === 'windows' && args['skip-native'] !== undefined) {
      throw new Error('Windows 发布资产不允许使用 --skip-native 绕过原生架构验证。');
    }
    let nativeVerification;
    if (!args['skip-native']) {
      if (platform === 'windows') {
        const appBinary = resolve(requireArg(args, 'app-binary'));
        nativeVerification = verifyWindows(directory, version, appBinary);
      }
      else if (platform === 'macos') verifyMacos(directory, arch, version, signed);
      else if (platform === 'uos') verifyUos(directory, arch, version);
      else throw new Error(`不支持的验证平台：${platform}`);
    }
    const verification = {
      platform,
      arch,
      version,
      signed,
      verifiedAt: new Date().toISOString(),
      assets: records,
      ...(nativeVerification ? { nativeVerification } : {}),
    };
    const out = resolve(args.out ?? join(directory, `verification-${platform}-${arch}.json`));
    writeJson(out, verification);
    console.log(JSON.stringify(verification, null, 2));
  } catch (error) {
    console.error(`Release asset verification failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
