import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import {
  closeSync, copyFileSync, createReadStream, createWriteStream, existsSync, mkdirSync, mkdtempSync,
  openSync, readFileSync, readSync, realpathSync, renameSync, rmSync, writeFileSync,
} from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const root = fileURLToPath(new URL('../', import.meta.url));
const electronVersion = '22.3.27';
const toolchain = 'nightly-2026-06-01';
// Official Electron v22.3.27 SHASUMS256.txt.
const targets = new Map([
  ['x64', { triple: 'x86_64-win7-windows-msvc', machine: 0x8664, hash: 'ad723ed7dad32f9459f7a9de1fd6d718cf713c4809c2431503bea62ce8f786e6' }],
  ['ia32', { triple: 'i686-win7-windows-msvc', machine: 0x014c, hash: '1119ac7112590cb9c10a8c9b0bb5be65c0e11648a4f1311e6b7a5a00e497c2ce' }],
]);

function run(command, ...args) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed (${result.status ?? result.signal}).`);
}

async function sha256(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

async function electronArchive(cache, arch, expectedHash, offline) {
  const filename = `electron-v${electronVersion}-win32-${arch}.zip`;
  const cached = join(cache, filename);
  if (existsSync(cached)) {
    if (await sha256(cached) !== expectedHash) throw new Error(`Replace the cached archive with the official copy (SHA-256 mismatch): ${cached}`);
    return cached;
  }
  if (offline) throw new Error(`Offline build requires ${cached}`);

  const partial = `${cached}.${randomUUID()}.download`;
  try {
    console.log(`Downloading ${filename}`);
    const url = `https://github.com/electron/electron/releases/download/v${electronVersion}/${filename}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(10 * 60 * 1000) });
    if (!response.ok || !response.body) throw new Error(`Electron download failed (HTTP ${response.status}): ${url}`);
    await pipeline(Readable.fromWeb(response.body), createWriteStream(partial, { flags: 'wx' }));
    if (await sha256(partial) !== expectedHash) throw new Error(`Electron download did not match its official SHA-256: ${filename}`);
    renameSync(partial, cached);
    return cached;
  } finally {
    rmSync(partial, { force: true });
  }
}

function assertWin7Executable(file, machine) {
  const handle = openSync(file, 'r');
  try {
    const dosHeader = Buffer.alloc(64);
    if (readSync(handle, dosHeader, 0, dosHeader.length, 0) !== dosHeader.length || dosHeader.readUInt16LE(0) !== 0x5a4d) {
      throw new Error(`Not a Windows executable: ${file}`);
    }
    const header = Buffer.alloc(76);
    if (readSync(handle, header, 0, header.length, dosHeader.readUInt32LE(60)) !== header.length
      || header.readUInt32LE(0) !== 0x00004550 || header.readUInt16LE(4) !== machine) {
      throw new Error(`Unexpected Windows executable architecture: ${file}`);
    }
    const major = header.readUInt16LE(72);
    const minor = header.readUInt16LE(74);
    if (major > 6 || (major === 6 && minor > 1)) {
      throw new Error(`Executable requires a newer Windows subsystem (${major}.${minor}): ${file}`);
    }
  } finally {
    closeSync(handle);
  }
}

function assertWin7ServiceImports(file) {
  const pe = readFileSync(file);
  const header = pe.readUInt32LE(60);
  const optional = header + 24;
  const sections = optional + pe.readUInt16LE(header + 20);
  const sectionCount = pe.readUInt16LE(header + 6);
  const directory = optional + (pe.readUInt16LE(optional) === 0x20b ? 112 : 96);
  const offsetOf = (rva) => {
    for (let i = 0; i < sectionCount; i++) {
      const section = sections + i * 40;
      const start = pe.readUInt32LE(section + 12);
      const size = pe.readUInt32LE(section + 16);
      if (rva >= start && rva < start + size) return pe.readUInt32LE(section + 20) + rva - start;
    }
    throw new Error(`Invalid import table: ${file}`);
  };
  const imports = offsetOf(pe.readUInt32LE(directory + 8));
  const size = pe.readUInt32LE(directory + 12);
  for (let offset = imports; offset + 20 <= imports + size; offset += 20) {
    const nameRva = pe.readUInt32LE(offset + 12);
    if (!nameRva) break;
    const start = offsetOf(nameRva);
    const name = pe.toString('ascii', start, pe.indexOf(0, start));
    if (/^(combase\.dll|bcryptprimitives\.dll|api-ms-win-crt-|ucrtbase\.dll|vcruntime\d|msvcp\d)/i.test(name)) {
      throw new Error(`Native service imports ${name}; the Win7 package must not require it.`);
    }
  }
}

async function main() {
  const { values } = parseArgs({ options: {
    arch: { type: 'string', multiple: true }, 'cache-dir': { type: 'string' }, offline: { type: 'boolean' },
  } });
  if (process.platform !== 'win32') throw new Error('Build on Windows 10/11 with the MSVC C++ tools and Windows SDK installed.');
  const architectures = [...new Set(values.arch ?? targets.keys())];
  for (const arch of architectures) if (!targets.has(arch)) throw new Error(`Unknown architecture: ${arch}. Use x64 or ia32.`);

  run('rustup.exe', 'run', toolchain, 'rustc', '--version');
  const cache = values['cache-dir'] ? resolve(values['cache-dir']) : join(root, 'tmp', 'win7-build-cache');
  const output = join(root, 'release-win7');
  const temp = join(root, 'tmp');
  for (const dir of [cache, output, temp]) mkdirSync(dir, { recursive: true });
  const { name: packageName, version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  run(process.execPath, join(root, 'node_modules', 'typescript', 'bin', 'tsc'), '-b');

  for (const arch of architectures) {
    const { triple, machine, hash } = targets.get(arch);
    const runtime = await electronArchive(cache, arch, hash, values.offline);
    run('cargo.exe', `+${toolchain}`, 'build', '-Z', 'build-std=std,panic_abort', '--locked', '--release',
      '--manifest-path', 'src-tauri/Cargo.toml', '--target', triple, '--target-dir', 'src-tauri/target', ...(values.offline ? ['--offline'] : []));
    const service = join(root, 'src-tauri', 'target', triple, 'release', 'local-mindmap-service.exe');
    assertWin7Executable(service, machine);
    assertWin7ServiceImports(service);

    const name = `LocalMindmap-${version}-win7-${arch}`;
    const stage = mkdtempSync(join(realpathSync(temp), 'win7-stage-'));
    try {
      const portable = join(stage, name);
      mkdirSync(portable);
      run('tar.exe', '-xf', runtime, '-C', portable);
      const launcher = join(portable, 'electron.exe');
      assertWin7Executable(launcher, machine);
      renameSync(launcher, join(portable, 'LocalMindmap-Win7.exe'));
      const resources = join(portable, 'resources');
      rmSync(join(resources, 'default_app.asar'), { force: true });
      const application = join(resources, 'app');
      for (const dir of [join(application, 'electron'), join(application, 'src-tauri', 'icons'), join(resources, 'native')]) mkdirSync(dir, { recursive: true });
      for (const entry of ['electron/main.cjs', 'electron/preload.cjs', 'electron/commands.json', 'src-tauri/icons/icon.png']) {
        copyFileSync(join(root, entry), join(application, entry));
      }
      copyFileSync(service, join(resources, 'native', basename(service)));
      copyFileSync(join(root, 'docs', 'windows-7-portable.md'), join(portable, 'Readme-Windows-7.md'));
      writeFileSync(join(application, 'package.json'), JSON.stringify({ name: packageName, version, productName: 'Local Mindmap', main: 'electron/main.cjs' }));
      run(process.execPath, join(root, 'node_modules', 'vite', 'bin', 'vite.js'), 'build', '--mode', 'win7', '--outDir', join(application, 'dist'));

      const stagedZip = join(stage, `${name}.zip`);
      run('tar.exe', '-a', '-cf', stagedZip, '-C', stage, name);
      const digest = await sha256(stagedZip);
      const artifact = join(output, basename(stagedZip));
      renameSync(stagedZip, artifact);
      writeFileSync(`${artifact}.sha256`, `${digest}  ${basename(artifact)}\n`);
      console.log(`Created ${artifact}`);
    } finally {
      const resolvedStage = realpathSync(stage);
      if (dirname(resolvedStage) !== realpathSync(temp) || !/^win7-stage-[a-z0-9]+$/i.test(basename(resolvedStage))) {
        throw new Error(`Unexpected staging path: ${resolvedStage}`);
      }
      rmSync(resolvedStage, { recursive: true, force: true });
    }
  }
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
