const { app } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '../tmp/electron-smoke-data');
process.env.LMIND_TEST_DATA_DIR = root;
const report = path.join(__dirname, '../tmp/electron-smoke-result.json');
const timer = setTimeout(() => { fs.writeFileSync(report, JSON.stringify({error:'timeout'})); app.exit(1); }, 30000);
app.on('browser-window-created', (_event,win) => {
  win.webContents.on('did-finish-load', async () => {
    try {
      let state;
      for (let n=0;n<80;n++) {
        state = await win.webContents.executeJavaScript('({text:document.body.innerText, versions:window.localMindmap?.versions, nodeAccess:typeof require})');
        if (state.text.includes('子节点也已恢复')) break;
        await new Promise(resolve=>setTimeout(resolve,100));
      }
      assert.ok(state.versions.chromium);
      assert.equal(state.nodeAccess,'undefined');
      assert.ok(state.text.includes('子节点也已恢复'),state.text.slice(0,1500));
      const response = await win.webContents.executeJavaScript("(async()=>{await window.localMindmap.invoke('write_user_json',{relativePath:'config/plugin-settings.json',value:{scriptRunnerEnabled:false}});return window.localMindmap.invoke('read_user_json',{relativePath:'config/plugin-settings.json'});})()");
      assert.equal(response.scriptRunnerEnabled,false);
      const blocked = await win.webContents.executeJavaScript("window.localMindmap.invoke('not-a-command').then(()=>false,()=>true)");
      assert.equal(blocked,true);
      fs.writeFileSync(report,JSON.stringify({passed:true,...state},null,2));
      clearTimeout(timer); app.quit();
    } catch(error) {fs.writeFileSync(report,JSON.stringify({error:String(error)}));clearTimeout(timer);app.exit(1);}
  });
});
require('./main.cjs');
