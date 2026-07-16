import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync, copyFileSync } from 'node:fs';
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';

export const PROJECT_ROOT = resolve(import.meta.dirname, '../..');
export const RELEASE_ASSET_DEFINITIONS = {
  windows: {
    x64: [
      { format: 'exe', extension: '.exe', filename: (version) => `Local-Mindmap_${version}_windows_x64-setup.exe` },
      { format: 'msi', extension: '.msi', filename: (version) => `Local-Mindmap_${version}_windows_x64.msi` },
    ],
  },
  macos: {
    arm64: [{ format: 'dmg', extension: '.dmg', filename: (version, variant = '') => `Local-Mindmap_${version}_macos_arm64${variant}.dmg` }],
    x64: [{ format: 'dmg', extension: '.dmg', filename: (version, variant = '') => `Local-Mindmap_${version}_macos_x64${variant}.dmg` }],
  },
  uos: {
    x64: [
      { format: 'deb', extension: '.deb', filename: (version) => `Local-Mindmap_${version}_uos_x64.deb` },
      { format: 'appimage', extension: '.AppImage', filename: (version) => `Local-Mindmap_${version}_uos_x64.AppImage` },
    ],
    arm64: [
      { format: 'deb', extension: '.deb', filename: (version) => `Local-Mindmap_${version}_uos_arm64.deb` },
      { format: 'appimage', extension: '.AppImage', filename: (version) => `Local-Mindmap_${version}_uos_arm64.AppImage` },
    ],
  },
};

export function fail(message) {
  throw new Error(message);
}

export function stripBom(text) {
  return text.replace(/^\uFEFF/, '');
}

export function readUtf8(path) {
  return stripBom(readFileSync(path, 'utf8'));
}

export function readJson(path) {
  try {
    return JSON.parse(readUtf8(path));
  } catch (error) {
    fail(`无法解析 JSON 文件 ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current.startsWith('--')) continue;
    const [key, inlineValue] = current.slice(2).split('=', 2);
    if (inlineValue !== undefined) {
      args[key] = inlineValue;
    } else if (argv[index + 1] && !argv[index + 1].startsWith('--')) {
      args[key] = argv[index + 1];
      index += 1;
    } else {
      args[key] = true;
    }
  }
  return args;
}

export function requireArg(args, key) {
  const value = args[key];
  if (!value || value === true) fail(`缺少必填参数 --${key}`);
  return String(value);
}

export function readPackageVersion(root = PROJECT_ROOT) {
  const packageJson = readJson(join(root, 'package.json'));
  if (typeof packageJson.version !== 'string') fail('package.json 缺少 version。');
  return packageJson.version;
}

export function readCargoPackageVersion(cargoToml) {
  const packageSection = /\[package\]([\s\S]*?)(?:\n\[|$)/.exec(readUtf8(cargoToml));
  const version = packageSection?.[1].match(/^version\s*=\s*"([^"]+)"\s*$/m)?.[1];
  if (!version) fail(`未能读取 ${cargoToml} 的 [package].version。`);
  return version;
}

export function readCargoLockPackageVersion(cargoLock, packageName = 'local-mindmap') {
  const packages = readUtf8(cargoLock).split(/\r?\n\[\[package\]\]\r?\n/);
  for (const candidate of packages) {
    const name = candidate.match(/^name\s*=\s*"([^"]+)"\s*$/m)?.[1];
    if (name !== packageName) continue;
    const version = candidate.match(/^version\s*=\s*"([^"]+)"\s*$/m)?.[1];
    if (version) return version;
  }
  fail(`Cargo.lock 中缺少 ${packageName} 包版本。`);
}

export function collectVersionState(root = PROJECT_ROOT) {
  const packageJson = readJson(join(root, 'package.json'));
  const packageLock = readJson(join(root, 'package-lock.json'));
  const tauriConfig = readJson(join(root, 'src-tauri', 'tauri.conf.json'));
  const state = {
    packageJson: packageJson.version,
    packageLock: packageLock.version,
    packageLockRoot: packageLock.packages?.['']?.version,
    cargoToml: readCargoPackageVersion(join(root, 'src-tauri', 'Cargo.toml')),
    cargoLock: readCargoLockPackageVersion(join(root, 'src-tauri', 'Cargo.lock')),
    tauriConfig: tauriConfig.version,
  };
  for (const [source, value] of Object.entries(state)) {
    if (typeof value !== 'string' || !value) fail(`${source} 缺少应用版本。`);
  }
  return state;
}

export function assertVersionState(root = PROJECT_ROOT, tag) {
  const versions = collectVersionState(root);
  const uniqueVersions = [...new Set(Object.values(versions))];
  if (uniqueVersions.length !== 1) {
    fail(`版本不一致：${Object.entries(versions).map(([key, value]) => `${key}=${value}`).join(', ')}`);
  }
  const version = uniqueVersions[0];
  if (tag) {
    if (!/^v\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(tag)) {
      fail(`tag 格式无效：${tag}`);
    }
    if (tag.slice(1) !== version) fail(`tag ${tag} 与应用版本 ${version} 不一致。`);
  }
  return { version, versions };
}

export function expectedAssets(platform, arch, version, { variant = '' } = {}) {
  const definitions = RELEASE_ASSET_DEFINITIONS[platform]?.[arch];
  if (!definitions) fail(`不支持的发布目标：${platform}-${arch}`);
  if (variant && !['_preview', '_unsigned'].includes(variant)) fail(`不支持的产物变体：${variant}`);
  return definitions.map((definition) => ({
    ...definition,
    filename: definition.filename(version, platform === 'macos' ? variant : ''),
  }));
}

export function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

export function listFilesRecursive(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? listFilesRecursive(path) : [path];
  });
}

export function ensureEmptyDirectory(directory) {
  rmSync(directory, { recursive: true, force: true });
  mkdirSync(directory, { recursive: true });
}

export function copyAsset(source, destination) {
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(source, destination);
  if (process.platform !== 'win32') {
    const mode = statSync(source).mode;
    if ((mode & 0o111) !== 0) {
      // Copying with Node does not guarantee the executable bit on every runner.
      const result = spawnSync('chmod', ['+x', destination], { encoding: 'utf8' });
      if (result.status !== 0) fail(`无法保留可执行权限：${destination}: ${result.stderr}`);
    }
  }
}

export function assertInside(root, candidate) {
  const rootPath = resolve(root);
  const candidatePath = resolve(candidate);
  if (candidatePath !== rootPath && !candidatePath.startsWith(`${rootPath}${sep}`)) {
    fail(`路径越出允许目录：${candidatePath}`);
  }
  return candidatePath;
}

export function runChecked(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', stdio: 'pipe', ...options });
  if (result.error) fail(`无法执行 ${command}: ${result.error.message}`);
  if (result.status !== 0) {
    fail(`${command} ${args.join(' ')} 失败：${[result.stdout, result.stderr].filter(Boolean).join('\n').trim()}`);
  }
  return result.stdout.trim();
}

export function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export function releaseFileRecord(path, assetsRoot) {
  return {
    filename: basename(path),
    relativePath: relative(assetsRoot, path).split('\\').join('/'),
    sha256: sha256(path),
    size: statSync(path).size,
    extension: extname(path),
  };
}
