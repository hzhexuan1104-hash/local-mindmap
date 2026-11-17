const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { app, dialog } = require('electron');

const tmp = path.join(__dirname, '../tmp');
fs.mkdirSync(tmp, { recursive: true });
const root = fs.mkdtempSync(path.join(tmp, 'plugin-import-smoke-'));
process.env.LMIND_TEST_DATA_DIR = root;
const saveJson = (relativePath, data) => {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(data, null, 2));
  return target;
};
const input = saveJson('本地 输入.data', {});
const newMapInput = saveJson('新导图.data', {});
const project = saveJson('original.lmind', {
  version: '1.0',
  meta: { theme: 'default-blue', createTime: new Date().toISOString(), updateTime: new Date().toISOString() },
  nodeTypes: [{
    id: 'stats', name: '统计节点', icon: null, shape: 'pill',
    backgroundColor: '#ffff00', borderColor: '#808000', textColor: '#000000',
    fontSize: 18, bold: true, defaultText: '统计模板标题', defaultRemark: '',
  }],
  rootNode: { id: 'root', text: '原始导图', remark: '', children: [
    { id: 'source', text: '两处  空格  示例', remark: '', children: [] },
  ] },
});
const originalContent = fs.readFileSync(project, 'utf8');
const pluginId = 'test.file-import';
const manifest = {
  manifestVersion: 1, pluginId, name: '文件导入测试', version: '1.0.0',
  pluginType: 'script', entry: 'main.js', enabled: true,
  capabilities: ['script', 'import'], permissions: ['mindmap:write'],
};
saveJson('config/plugin-settings.json', { scriptRunnerEnabled: true });
saveJson('plugins/plugin-registry.json', [{ ...manifest, trusted: true }]);
const manifestPath = saveJson(`plugins/installed/${pluginId}/manifest.json`, manifest);
fs.writeFileSync(path.join(path.dirname(manifestPath), 'main.js'), `function run(context) {
  const input = context.inputFile;
  if (input.path === ${JSON.stringify(newMapInput)} && input.name === "新导图.data") {
    return [{type:"createMindmap",rootNode:{text:"全新导图",children:[{text:"新分支",type:"stats"}]}}];
  }
  if (input.path !== ${JSON.stringify(input)} || input.name !== "本地 输入.data") throw Error("inputFile mismatch");
  return [
    {type:"updateNode",nodeId:"source",patch:{text:input.name}},
    {type:"addChildNode",parentId:"source",node:{text:"导入分支",type:"stats",children:[{text:"导入后代",type:"missing"}]}}
  ];
}`);
process.argv.push(project);

// Stub only the OS picker. Exercise real Electron IPC, plugin execution and renderer updates.
const picks = [null, input, newMapInput];
let pickerCalls = 0;
dialog.showOpenDialog = async (parent, options) => {
  pickerCalls++;
  assert.ok(parent.webContents);
  assert.deepEqual(options.properties, ['openFile']);
  assert.equal(options.filters, undefined);
  const selected = picks.shift();
  return { canceled: !selected, filePaths: selected ? [selected] : [] };
};
const timer = setTimeout(() => { console.error('Plugin import smoke timed out'); app.exit(1); }, 30000);
app.on('browser-window-created', (_event, win) => {
  win.webContents.once('did-finish-load', async () => {
    const js = (source) => win.webContents.executeJavaScript(source);
    const waitFor = async (condition, check = () => js(condition)) => {
      for (let attempt = 0; attempt < 50; attempt++) {
        if (await check()) return;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      throw new Error(`Timed out waiting for ${condition}`);
    };
    const click = (selector) => js(`document.querySelector(${JSON.stringify(selector)}).click()`);
    const key = (key, extra = '') => js(`document.body.dispatchEvent(new KeyboardEvent('keydown', {key:${JSON.stringify(key)},bubbles:true,cancelable:true${extra}}))`);
    const runImport = async () => {
      await click('[data-menu-item-id="file"]');
      await click('[data-menu-item-id="file/import"]');
      await click(`[data-menu-item-id="file/import/plugin-import-${pluginId}"]`);
    };
    try {
      await waitFor('document.body.textContent.includes("两处  空格  示例")');
      await js(`(() => {
        const node = [...document.querySelectorAll('.mindmap-node')].find(node => node.textContent.includes('空格'));
        node.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true}));
      })()`);
      await js(`(() => {
        const select = document.querySelector('[aria-label="新增同级节点类型"]');
        select.value = 'stats';
        select.dispatchEvent(new Event('change', {bubbles:true}));
        window.confirm = () => true;
      })()`);
      await key('Escape');
      await key('Enter');
      await waitFor('document.querySelector(".node-editor")?.value === "统计模板标题"');
      await js(`document.querySelector('.node-editor').dispatchEvent(new KeyboardEvent('keydown',
        {key:'Enter',bubbles:true,cancelable:true}))`);
      await waitFor('!document.querySelector(".node-editor")');

      await key('h', ',ctrlKey:true');
      await js(`(() => {
        const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        const fill = (selector, value) => {
          const input = document.querySelector(selector);
          set.call(input, value);
          input.dispatchEvent(new Event('input', {bubbles:true}));
        };
        fill('.search-float-row input[type="search"]', '  ');
        fill('input[placeholder="替换为"]', ' / ');
      })()`);
      await click('.search-float-action');
      await waitFor('document.body.textContent.includes("两处 / 空格  示例")');
      await click('.search-float-action + .search-float-action');
      await waitFor('document.body.textContent.includes("两处 / 空格 / 示例")');
      await click('[aria-label="关闭查找"]');

      await runImport();
      await waitFor('file picker', () => pickerCalls === 1);
      assert.equal(await js('document.body.textContent.includes("导入分支")'), false);
      await runImport();
      await waitFor('document.body.textContent.includes("导入后代")');
      assert.equal(await js('document.body.textContent.includes("本地 输入.data")'), true);
      assert.equal(await js(`Array.from(document.querySelectorAll('.mindmap-node')).find(node =>
        node.textContent.includes('导入分支')).style.getPropertyValue('--node-bg')`), '#ffff00');

      await runImport();
      await waitFor('document.body.textContent.includes("全新导图")');
      assert.equal(await js('document.body.textContent.includes("导入分支")'), false);
      assert.equal(fs.readFileSync(project, 'utf8'), originalContent);
      assert.equal(pickerCalls, 3);
      console.log('Electron import, typed Enter, and whitespace replacement smoke passed');
      clearTimeout(timer);
      app.quit();
    } catch (error) {
      console.error(error);
      clearTimeout(timer);
      app.exit(1);
    }
  });
});
require('./main.cjs');
