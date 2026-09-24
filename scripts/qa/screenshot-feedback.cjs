// Local browser regression for the ten screenshot feedback items.
// PLAYWRIGHT_PATH may point to an existing installation; no downloads are needed.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
const { mkdirSync, mkdtempSync } = require('node:fs');
const { join } = require('node:path');
const { tmpdir } = require('node:os');
const outputDir = process.env.QA_OUTPUT_DIR || mkdtempSync(join(tmpdir(), 'local-mindmap-qa-'));
mkdirSync(outputDir, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.QA_BROWSER_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined) });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(process.env.QA_URL || 'http://127.0.0.1:5173');
    const nodes = page.locator('.mindmap-node');
    await nodes.first().dblclick();
    const editor = page.locator('.node-editor');
    await editor.fill('根节点');
    await editor.press('End');
    await editor.press('Shift+Enter');
    await editor.press('a');
    assert.equal(await editor.inputValue(), '根节点\na');
    await editor.press('Enter');
    assert.equal(await nodes.count(), 1);
    assert.equal(await nodes.first().locator('.node-text-content').textContent(), '根节点\na');
    assert.equal(await nodes.first().locator('.node-text-content').evaluate((el) => getComputedStyle(el).whiteSpace), 'pre-wrap');

    await page.getByRole('button', { name: '下级', exact: true }).click();
    await editor.fill('待替换甲'); await editor.press('Enter');
    await page.getByRole('button', { name: '同级', exact: true }).click();
    await editor.fill('待替换乙'); await editor.press('Enter');

    for (const label of ['节点图标', '字号']) {
      const select = page.getByLabel(label, { exact: true });
      await select.hover();
      const style = await select.evaluate((el) => {
        const css = getComputedStyle(el);
        return { size: css.backgroundSize, repeat: css.backgroundRepeat, padding: parseFloat(css.paddingRight) };
      });
      assert.equal(style.size, '14px 14px'); assert.equal(style.repeat, 'no-repeat'); assert.ok(style.padding >= 28);
    }

    await page.getByRole('button', { name: '打开备注编辑', exact: true }).click();
    await page.getByLabel('Markdown 备注').fill('### 测试表格\n\n| 表头1 | 表头2 | 表头3 |\n| --- | --- | --- |\n| 1 | 一段需要正常换行的中文内容，而不是挤成单列 | 内容3 |');
    await page.getByRole('button', { name: '预览备注', exact: true }).click();
    const checkTable = async (scope) => {
      const table = scope.locator('.markdown-preview table');
      const width = await table.evaluate((el) => ({ table: el.getBoundingClientRect().width, parent: el.parentElement.getBoundingClientRect().width, cells: [...el.querySelectorAll('th')].map((cell) => cell.getBoundingClientRect().width) }));
      assert.ok(width.table > width.parent * .9);
      assert.ok(width.cells.every((cell) => cell > width.table / 4));
    };
    await checkTable(page.locator('.inspector-panel'));
    await page.getByRole('button', { name: '放大备注', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await checkTable(dialog);
    assert.ok(await page.locator('#root').evaluate((el) => el.inert));
    assert.equal(await dialog.locator('.eyebrow').textContent(), '节点内容');
    assert.equal(await dialog.locator('.remark-preview-section-label').textContent(), '备注内容');
    assert.ok(await dialog.getByRole('button', { name: '下一个同级节点备注' }).isDisabled());
    await dialog.getByRole('button', { name: '上一个同级节点备注' }).click();
    assert.equal(await dialog.locator('h2').textContent(), '待替换甲');
    assert.ok(await dialog.getByRole('button', { name: '上一个同级节点备注' }).isDisabled());
    await dialog.getByRole('button', { name: '下一个同级节点备注' }).click();
    assert.equal(await dialog.locator('h2').textContent(), '待替换乙');
    assert.ok(await dialog.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return document.elementFromPoint(rect.x + 30, rect.y + 30)?.closest('[role="dialog"]') === el;
    }));
    await page.screenshot({ path: join(outputDir, 'preview-after.png') });
    await page.keyboard.press('Escape');
    assert.equal(await dialog.count(), 0);
    assert.equal(await page.locator('#root').evaluate((el) => el.inert), false);

    await page.getByRole('button', { name: '折叠子节点', exact: true }).click();
    await nodes.first().click();
    await page.keyboard.press('Control+f');
    await page.getByPlaceholder('查找内容').fill('待替换');
    await page.getByPlaceholder('替换为').fill('已替换');
    await page.getByRole('button', { name: '替换', exact: true }).click();
    assert.equal(await page.locator('.mindmap-node.is-selected .node-text-content').textContent(), '已替换甲');
    assert.equal(await nodes.count(), 3);
    assert.ok(await page.locator('.mindmap-node.is-selected').evaluate((el) => {
      const rect = el.getBoundingClientRect();
      const canvas = document.querySelector('.mindmap-canvas').getBoundingClientRect();
      return rect.left >= canvas.left && rect.right <= canvas.right && rect.top >= canvas.top && rect.bottom <= canvas.bottom;
    }));
    assert.equal(await page.locator('.mindmap-node.is-selected, .mindmap-node.is-search-match').count(), 1);
    await page.getByRole('button', { name: '替换', exact: true }).click();
    assert.equal(await page.locator('.mindmap-node.is-selected .node-text-content').textContent(), '已替换乙');
    await page.getByPlaceholder('查找内容').fill('已替换');
    await page.getByRole('button', { name: '下一个匹配' }).click();
    assert.equal(await page.locator('.mindmap-node.is-selected .node-text-content').textContent(), '已替换甲');
    assert.equal(await page.locator('.mindmap-node.is-selected, .mindmap-node.is-search-match').count(), 1);
    await page.getByRole('button', { name: '下一个匹配' }).click();
    assert.equal(await page.locator('.mindmap-node.is-selected .node-text-content').textContent(), '已替换乙');
    assert.equal(await page.locator('.mindmap-node.is-selected, .mindmap-node.is-search-match').count(), 1);
    await page.getByPlaceholder('查找内容').fill('不存在');
    await page.getByRole('button', { name: '替换', exact: true }).click();
    await page.setViewportSize({ width: 900, height: 720 });
    const toast = page.locator('.top-status-message');
    assert.ok(await toast.isVisible());
    assert.equal(await toast.evaluate((el) => getComputedStyle(el).fontSize), '14px');
    await page.screenshot({ path: join(outputDir, 'search-after.png') });
    assert.deepEqual(errors, []);
    console.log('PASS: multiline editing, dropdowns, responsive tables, modal layers/focus, sibling preview, direct/repeated replacement, single search ring and narrow-screen notification');
    console.log(`Screenshots: ${outputDir}`);
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
