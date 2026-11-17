const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const { spawn } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { createInterface } = require('node:readline');
const commands = new Set(require('./commands.json'));
const windows = new Map();
const pending = new Map();
let service, sequence = 0;
const entry = path.join(__dirname, '../dist/index.html');
const entryUrl = pathToFileURL(entry).href;
const launchFile = args => args.find(arg => /\.lmind$/i.test(arg)) || null;
const dataRoot = (!app.isPackaged && process.env.LMIND_TEST_DATA_DIR) || (process.platform === 'linux'
  ? path.join(process.env.XDG_DATA_HOME || path.join(app.getPath('home'), '.local/share'), 'com.localmindmap.desktop')
  : path.join(app.getPath('appData'), 'com.localmindmap.desktop'));
app.setPath('userData', path.join(dataRoot, 'chromium'));
app.setAppUserModelId('com.localmindmap.desktop');

function startService() {
  const executable = 'local-mindmap-service' + (process.platform === 'win32' ? '.exe' : '');
  const location = app.isPackaged ? path.join(process.resourcesPath, 'native', executable) : path.join(__dirname, '../src-tauri/target/release', executable);
  service = spawn(location, [], { windowsHide: true, stdio: ['pipe','pipe','pipe'], env: {...process.env, LMIND_DATA_DIR: dataRoot} });
  const fail = error => { for (const item of pending.values()) { clearTimeout(item.timer); item.reject(error); } pending.clear(); };
  service.on('error', fail);
  service.on('exit', () => fail(new Error('本地服务已退出，请重启软件。')));
  service.stderr.on('data', data => console.error(data.toString()));
  createInterface({input:service.stdout}).on('line', line => {
    let reply; try { reply = JSON.parse(line); } catch { return; }
    const item = pending.get(reply.id);
    if (!item) return;
    clearTimeout(item.timer); pending.delete(reply.id);
    reply.error ? item.reject(new Error(reply.error)) : item.resolve(reply.result);
  });
}
function invokeNative(command, args) {
  return new Promise((resolve,reject) => {
    if (!service || service.exitCode !== null || service.killed) return reject(new Error('本地服务不可用'));
    if (pending.size >= 100) return reject(new Error('操作过多，请稍后重试'));
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('操作超时')); }, 300000);
    pending.set(id,{resolve,reject,timer});
    service.stdin.write(JSON.stringify({id,command,args:args || {}})+'\n', error => {
      if (error) { clearTimeout(timer); pending.delete(id); reject(error); }
    });
  });
}
async function createWindow(file) {
  const win = new BrowserWindow({width:1280,height:820,minWidth:960,minHeight:640,
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
    return canceled || !selectedPath
      ? null
      : { path: selectedPath, name: path.basename(selectedPath) };
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
  app.on('second-instance', (_event,args) => {
    const file = launchFile(args.slice(1));
    if (file) void createWindow(file);
    else windows.values().next().value?.win.focus();
  });
  let openedFile = launchFile(process.argv.slice(1));
  app.on('open-file',(event,file) => {
    event.preventDefault();
    if (app.isReady()) void createWindow(file); else openedFile = file;
  });
  app.whenReady().then(() => { startService(); return createWindow(openedFile); }).catch(error => { dialog.showErrorBox('启动失败',String(error)); app.quit(); });
  app.on('activate', () => { if (!windows.size) void createWindow(null); });
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', () => service?.kill());
}
