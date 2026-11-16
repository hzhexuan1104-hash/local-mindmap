const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('localMindmap', Object.freeze({
  invoke: (command, args) => ipcRenderer.invoke('local-mindmap:invoke', command, args),
  versions: Object.freeze({ chromium: process.versions.chrome, electron: process.versions.electron }),
}));
