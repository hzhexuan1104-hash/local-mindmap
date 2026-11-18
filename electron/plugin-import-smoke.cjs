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
const treeInput = path.join(root, '多层分支.json');
const longTreeInput = path.join(root, '多条提示.json');
const malformedInput = saveJson('无效分支.json', [{ text: '不应添加', children: [{ children: [] }] }]);
const invalidUtf8Input = path.join(root, '其他编码.data');
const oversizedInput = path.join(root, '大文件.data');
const example = path.join(__dirname, '../docs/examples/sample-import-plugin');
fs.writeFileSync(treeInput, '\ufeff' + fs.readFileSync(path.join(example, 'branches.json'), 'utf8'));
fs.copyFileSync(treeInput, longTreeInput);
fs.writeFileSync(invalidUtf8Input, Buffer.from([0xc0, 0xc1]));
fs.writeFileSync(oversizedInput, Buffer.alloc(1024 * 1024 + 1));
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
const importer = JSON.parse(fs.readFileSync(path.join(example, 'manifest.json'), 'utf8'));
saveJson('plugins/plugin-registry.json', [{ ...manifest, trusted: true }, { ...importer, enabled: true, trusted: true }]);
const manifestPath = saveJson(`plugins/installed/${pluginId}/manifest.json`, manifest);
const importerPath = saveJson(`plugins/installed/${importer.pluginId}/manifest.json`, importer);
fs.writeFileSync(path.join(path.dirname(importerPath), 'main.js'), `
${fs.readFileSync(path.join(example, 'main.js'), 'utf8')}
const originalRun = run;
run = (context) => context.inputFile.name !== '多条提示.json' ? originalRun(context) : [
  ...originalRun(context),
  {type:"showMessage",level:"warning",message:"请核对导入层级。"},
  {type:"showMessage",level:"error",message:"诊断示例"},
  ...Array.from({length:16},(_, i) => ({type:"showMessage",message:"处理记录 " + (i + 1)}))
];`);
fs.writeFileSync(path.join(path.dirname(manifestPath), 'main.js'), `function run(context) {
  const input = context.inputFile;
  if (input.path === ${JSON.stringify(newMapInput)} && input.name === "新导图.data") {
    return [{type:"createMindmap",rootNode:{text:"全新导图",children:[{text:"新分支",type:"stats"}]}}];
  }
  if (input.path !== ${JSON.stringify(input)} || input.name !== "本地 输入.data" || "text" in input) throw Error("inputFile mismatch");
  return [
    {type:"updateNode",nodeId:"source",patch:{text:input.name}},
    {type:"addChildNode",parentId:"source",node:{text:"导入分支",type:"stats",children:[{text:"导入后代",type:"missing"}]}}
  ];
}`);
process.argv.push(project);

// Stub only the OS picker. Exercise real Electron IPC, plugin execution and renderer updates.
const picks = [null, input, newMapInput, malformedInput, invalidUtf8Input, oversizedInput, treeInput, longTreeInput];
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
    const capture = async (name) => {
      if (!process.env.LMIND_CAPTURE_SMOKE) return;
      const screenshot = path.join(root, name);
      fs.writeFileSync(screenshot, (await win.webContents.capturePage()).toPNG());
      console.log('Plugin feedback screenshot: ' + screenshot);
    };
    const runImport = async (id = pluginId) => {
      await click('[data-menu-item-id="file"]');
      await click('[data-menu-item-id="file/import"]');
      await click(`[data-menu-item-id="file/import/plugin-import-${id}"]`);
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
      await runImport(importer.pluginId);
      await waitFor('document.body.textContent.includes("nodes[0].children[0].text")');
      assert.equal(await js('document.body.textContent.includes("不应添加")'), false);
      await runImport(importer.pluginId);
      await waitFor('document.body.textContent.includes("不是有效的 UTF-8 文本")');
      await runImport(importer.pluginId);
      await waitFor('document.body.textContent.includes("1 MiB 以内")');
      assert.equal(await js('document.body.textContent.includes("Error invoking remote method")'), false);
      await runImport(importer.pluginId);
      await waitFor('document.querySelector(".feedback-dialog-done") && document.body.textContent.includes("收集需求")');
      assert.equal(await js('document.querySelector(".feedback-messages li").textContent.includes("多层分支.json")'), true);
      assert.equal(await js('document.querySelector(".feedback-dialog").offsetHeight < 280 && !document.querySelector(".top-status-message")'), true);
      await capture('plugin-feedback.png');
      await click('.feedback-dialog-done');
      await key('z', ',ctrlKey:true');
      await waitFor('!document.body.textContent.includes("收集需求")');

      await runImport(importer.pluginId);
      await waitFor('Boolean(document.querySelector(".feedback-message--error"))');
      assert.equal(await js('document.querySelector(".feedback-message--warning")?.textContent'), '提醒请核对导入层级。');
      assert.equal(await js('document.querySelector(".feedback-message--error")?.textContent'), '错误诊断示例');
      win.webContents.setZoomFactor(1.6);
      assert.equal(await js(`(() => {
        const panel = document.querySelector('.feedback-dialog');
        const body = panel.querySelector('.feedback-dialog-body');
        const bounds = panel.getBoundingClientRect();
        return bounds.top >= 0 && bounds.bottom <= innerHeight && bounds.width < innerWidth &&
          body.scrollHeight > body.clientHeight &&
          document.activeElement === panel.querySelector('.feedback-dialog-done');
      })()`), true);
      win.webContents.setZoomFactor(1);
      await capture('plugin-feedback-long.png');
      await key('Escape');
      await waitFor('!document.querySelector(".feedback-dialog")');
      await key('z', ',ctrlKey:true');
      await waitFor('!document.body.textContent.includes("收集需求") && document.body.textContent.includes("全新导图")');
      assert.equal(fs.readFileSync(project, 'utf8'), originalContent);
      assert.equal(pickerCalls, 8);
      console.log('Electron legacy and dedicated import, nested branches, dialog, undo, typed Enter, and whitespace replacement smoke passed');
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
