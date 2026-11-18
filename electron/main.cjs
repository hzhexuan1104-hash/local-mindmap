const { app, BrowserWindow, ipcMain, dialog, screen, shell } = require('electron');
const { spawn } = require('node:child_process');
const { open } = require('node:fs/promises');
const { release: osRelease } = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { createInterface } = require('node:readline');
const commands = new Set(require('./commands.json'));
const windows = new Map();
const pending = new Map();
let service, serviceFailure, sequence = 0;
const entry = path.join(__dirname, '../dist/index.html');
const entryUrl = pathToFileURL(entry).href;
const launchFile = args => args.find(arg => /\.lmind$/i.test(arg)) || null;
const maxImporterTextBytes = 1024 * 1024;
const isWin7Edition = process.platform === 'win32' && process.versions.electron?.startsWith('22.');
const dataRoot = (!app.isPackaged && process.env.LMIND_TEST_DATA_DIR) || (process.platform === 'linux'
  ? path.join(process.env.XDG_DATA_HOME || path.join(app.getPath('home'), '.local/share'), 'com.localmindmap.desktop')
  : path.join(app.getPath('appData'), 'com.localmindmap.desktop'));
app.setPath('userData', path.join(dataRoot, isWin7Edition ? 'chromium-win7' : 'chromium'));
app.setAppUserModelId('com.localmindmap.desktop');
if (isWin7Edition && osRelease().startsWith('6.1.')) app.disableHardwareAcceleration();

function startService() {
  const executable = 'local-mindmap-service' + (process.platform === 'win32' ? '.exe' : '');
  const location = app.isPackaged ? path.join(process.resourcesPath, 'native', executable) : path.join(__dirname, '../src-tauri/target/release', executable);
  service = spawn(location, [], { windowsHide: true, stdio: ['pipe','pipe','pipe'], env: {...process.env, LMIND_DATA_DIR: dataRoot} });
  const fail = error => {
    serviceFailure ??= error;
    for (const item of pending.values()) { clearTimeout(item.timer); item.reject(serviceFailure); }
    pending.clear();
  };
  service.on('error', fail);
  service.on('exit', code => fail(new Error(code === null ? '本地服务已退出。' : `本地服务已退出（0x${(code >>> 0).toString(16)}）。`)));
  service.stdin.on('error', fail);
  service.stderr.on('data', data => console.error(data.toString()));
  createInterface({input:service.stdout}).on('line', line => {
    let reply; try { reply = JSON.parse(line); } catch { return; }
    const item = pending.get(reply.id);
    if (!item) return;
    clearTimeout(item.timer); pending.delete(reply.id);
    reply.error ? item.reject(new Error(reply.error)) : item.resolve(reply.result);
  });
  return invokeNative('get_user_data_dir', {}, 10000);
}
function invokeNative(command, args, timeout = 300000) {
  return new Promise((resolve,reject) => {
    if (serviceFailure) return reject(serviceFailure);
    if (!service || service.exitCode !== null || service.killed) return reject(new Error('本地服务不可用'));
    if (pending.size >= 100) return reject(new Error('操作过多，请稍后重试'));
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('本地服务响应超时。')); }, timeout);
    pending.set(id,{resolve,reject,timer});
    service.stdin.write(JSON.stringify({id,command,args:args || {}})+'\n', error => {
      if (error) { clearTimeout(timer); pending.delete(id); reject(error); }
    });
  });
}
async function createWindow(file) {
  const area = isWin7Edition ? screen.getPrimaryDisplay().workAreaSize : null;
  const size = area ? {
    width: Math.min(1280, area.width), height: Math.min(820, area.height),
    minWidth: Math.min(800, area.width), minHeight: Math.min(540, area.height),
  } : {width:1280,height:820,minWidth:960,minHeight:640};
  const win = new BrowserWindow({...size,
    title:'Local Mindmap', icon:path.join(__dirname,'../src-tauri/icons/icon.png'),
    webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true}});
  const windowId = win.webContents.id;
  windows.set(windowId, {win,file});
  win.removeMenu();
  win.webContents.setWindowOpenHandler(() => ({action:'deny'}));
  win.webContents.on('will-navigate', (event,url) => { if (url.split('#')[0] !== entryUrl) event.preventDefault(); });
  win.webContents.session.setPermissionRequestHandler((_wc,_permission,callback) => callback(false));
  win.on('closed', () => windows.delete(windowId));
  await win.loadFile(entry);
}
class ImporterFileError extends Error {}

async function readImporterText(selectedPath) {
  const file = await open(selectedPath, 'r');
  try {
    const stat = await file.stat();
    if (!stat.isFile()) throw new ImporterFileError('请选择普通文件。');
    const tooLarge = 'JavaScript 导入插件只支持 1 MiB 以内的文本文件。';
    if (stat.size > maxImporterTextBytes) throw new ImporterFileError(tooLarge);
    const buffer = Buffer.alloc(maxImporterTextBytes + 1);
    let length = 0;
    while (length < buffer.length) {
      const { bytesRead } = await file.read(buffer, length, buffer.length - length, length);
      if (!bytesRead) break;
      length += bytesRead;
    }
    if (length > maxImporterTextBytes) throw new ImporterFileError(tooLarge);
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, length));
    } catch {
      throw new ImporterFileError('文件不是有效的 UTF-8 文本。请转换编码或使用支持该格式的外部命令导入插件。');
    }
  } finally {
    await file.close();
  }
}
ipcMain.handle('local-mindmap:invoke', async (event,command,args) => {
  const owner = windows.get(event.sender.id);
  if (!owner || event.senderFrame !== event.sender.mainFrame || event.senderFrame.url.split('#')[0] !== entryUrl || !commands.has(command)) throw new Error('无效的桌面请求');
  if (command === 'get_launch_file') return owner.file;
  if (command === 'select_plugin_input_file') {
    const { canceled, filePaths } = await dialog.showOpenDialog(owner.win, {
      title: '选择插件导入文件',
      properties: ['openFile'],
    });
    const selectedPath = filePaths[0];
    if (canceled || !selectedPath) return null;
    const input = { path: selectedPath, name: path.basename(selectedPath) };
    if (args?.readText === true) {
      try {
        input.text = await readImporterText(selectedPath);
      } catch (error) {
        return { error: error instanceof ImporterFileError ? error.message : '无法读取所选文件，请确认文件仍存在且可读取。' };
      }
    }
    return input;
  }
  if (command === 'open_attachment_link') {
    const url = new URL(args.url);
    if (!['https:','http:'].includes(url.protocol) || url.username || url.password) throw new Error('链接无效');
    return shell.openExternal(url.href);
  }
  return invokeNative(command,args);
});
if (!app.requestSingleInstanceLock()) app.quit();
else {
  let openedFile = launchFile(process.argv.slice(1));
  const startup = app.whenReady().then(async () => {
    await startService();
    await createWindow(openedFile);
    return true;
  }).catch(error => {
    const hint = isWin7Edition ? '\n请确认系统为 Windows 7 SP1 或更高版本，且已完整解压对应位数的便携版。' : '';
    dialog.showErrorBox('启动失败', `无法启动本地思维导图。\n${error.message ?? error}${hint}`);
    app.quit();
    return false;
  });
  const afterStartup = action => { void startup.then(ready => ready && action()).catch(console.error); };
  app.on('second-instance', (_event,args) => {
    const file = launchFile(args.slice(1));
    afterStartup(() => file ? createWindow(file) : windows.values().next().value?.win.focus());
  });
  app.on('open-file',(event,file) => {
    event.preventDefault();
    if (app.isReady()) afterStartup(() => createWindow(file)); else openedFile = file;
  });
  app.on('activate', () => afterStartup(() => { if (!windows.size) return createWindow(null); }));
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', () => service?.kill());
}
