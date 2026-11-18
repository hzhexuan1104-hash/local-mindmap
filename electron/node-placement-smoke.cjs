const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { app } = require('electron');

const tmp = path.join(__dirname, '../tmp');
fs.mkdirSync(tmp, { recursive: true });
const root = fs.mkdtempSync(path.join(tmp, 'node-placement-smoke-'));
process.env.LMIND_TEST_DATA_DIR = root;
const file = path.join(root, 'positioned.lmind');
const timestamp = '2026-11-18T00:00:00.000Z';
fs.writeFileSync(file, JSON.stringify({
  version: '1.0',
  meta: { theme: 'default-blue', createTime: timestamp, updateTime: timestamp },
  nodeTypes: [],
  rootNode: {
    id: 'root',
    text: '手动移动过的主题',
    remark: '',
    position: { x: 30, y: 100 },
    collapsed: true,
    children: [{
      id: 'old', text: '原有远处节点', remark: '', position: { x: 650, y: 25 }, children: [],
    }],
  },
}));
process.argv.push(file);

const timer = setTimeout(() => { console.error('Node placement smoke timed out'); app.exit(1); }, 30000);
app.on('browser-window-created', (_event, win) => {
  win.webContents.once('did-finish-load', async () => {
    const js = (source) => win.webContents.executeJavaScript(source);
    const waitFor = async (source) => {
      for (let attempt = 0; attempt < 50; attempt++) {
        if (await js(source)) return;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      throw new Error(`Timed out waiting for ${source}`);
    };
    const key = (key, extra = '') =>
      js(`document.body.dispatchEvent(new KeyboardEvent('keydown', {key:${JSON.stringify(key)},bubbles:true,cancelable:true${extra}}))`);
    const boxes = () => js(`
      [...document.querySelectorAll('.mindmap-node-wrap')].map((wrap) => ({
        x: parseFloat(wrap.style.left), y: parseFloat(wrap.style.top),
        width: parseFloat(wrap.style.width), height: parseFloat(wrap.style.height),
        text: wrap.querySelector('.mindmap-node').textContent,
      }))`);
    const add = async (shortcut) => {
      await key(shortcut);
      await waitFor('Boolean(document.querySelector(".node-editor"))');
      await js(`document.querySelector(".node-editor").dispatchEvent(new KeyboardEvent('keydown',
        {key:'Enter',bubbles:true,cancelable:true}))`);
      await waitFor('!document.querySelector(".node-editor")');
    };
    try {
      await waitFor('document.body.textContent.includes("手动移动过的主题")');
      const [before] = await boxes();
      assert.equal(await js('document.body.textContent.includes("原有远处节点")'), false);

      for (let index = 0; index < 2; index++) {
        await js("document.querySelector('.mindmap-node.is-root').click()");
        await add('Tab');
      }
      await add('Enter');
      const [center, existing, first, second, third] = await boxes();
      assert.deepEqual(center, before);
      assert.equal(existing.text.trim(), '原有远处节点');
      assert.equal(existing.x, 746);
      assert.equal(existing.y, 121);
      assert.equal(first.x - (center.x + center.width), 46);
      assert.equal(second.x, first.x);
      assert.equal(third.x, first.x);
      assert.equal(second.y - (first.y + first.height), 18);
      assert.equal(third.y - (second.y + second.height), 18);
      if (process.env.LMIND_CAPTURE_SMOKE) {
        await js('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))');
        const screenshot = path.join(root, 'node-placement.png');
        fs.writeFileSync(screenshot, (await win.webContents.capturePage()).toPNG());
        console.log('Node placement screenshot: ' + screenshot);
      }

      await key('z', ',ctrlKey:true');
      await waitFor('document.querySelectorAll(".mindmap-node-wrap").length === 4');
      await key('y', ',ctrlKey:true');
      await waitFor('document.querySelectorAll(".mindmap-node-wrap").length === 5');
      assert.deepEqual(await boxes(), [center, existing, first, second, third]);

      // Continue past the bottom of the original viewport without scrolling or changing zoom.
      const viewTransform = () => js(`(() => {
        const matrix = new DOMMatrix(getComputedStyle(document.querySelector('.mindmap-pan-layer')).transform);
        return { scale: matrix.a, y: matrix.f };
      })()`);
      const initialView = await viewTransform();
      for (let index = 0; index < 12; index++) {
        await js("document.querySelector('.mindmap-node.is-root').click()");
        await add('Tab');
      }
      assert.equal(await js(`(() => {
        const node = document.querySelector('.mindmap-node.is-selected').getBoundingClientRect();
        const canvas = document.querySelector('.mindmap-canvas').getBoundingClientRect();
        return node.bottom <= canvas.bottom && node.top >= canvas.top && node.right <= canvas.right && node.left >= canvas.left;
      })()`), true);
      const finalView = await viewTransform();
      assert.ok(finalView.y < initialView.y);
      assert.equal(finalView.scale, initialView.scale);
      console.log('Electron node placement, collapsed-parent expansion, sibling alignment, viewport reveal, undo and redo smoke passed');
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
