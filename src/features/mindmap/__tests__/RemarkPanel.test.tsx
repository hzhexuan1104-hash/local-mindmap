import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RemarkPanel } from '../RemarkPanel';

const noop = () => undefined;

describe('RemarkPanel', () => {
  it('keeps an empty remark editor empty instead of injecting a template', () => {
    const html = renderToStaticMarkup(
      <RemarkPanel
        selectedNode={{ id: 'node-1', text: '新节点', remark: '', children: [] }}
        mode="edit"
        onModeChange={noop}
        onRemarkChange={noop}
      />,
    );

    expect(html).toContain('class="remark-editor"');
    expect(html).not.toContain('is-virtual-template');
    expect(html).not.toContain('用例概述');
    expect(html).not.toContain('执行步骤');
    expect(html).not.toContain('预期结果');
  });

  it('renders only persisted remark text in the editor', () => {
    const html = renderToStaticMarkup(
      <RemarkPanel
        selectedNode={{ id: 'node-1', text: '新节点', remark: '实际备注', children: [] }}
        mode="edit"
        onModeChange={noop}
        onRemarkChange={noop}
      />,
    );

    expect(html).toContain('>实际备注</textarea>');
  });

  it('places the three icon actions in the remark section header', () => {
    const html = renderToStaticMarkup(
      <RemarkPanel
        selectedNode={{ id: 'node-1', text: '新节点', remark: '', children: [] }}
        mode="edit"
        onModeChange={noop}
        onRemarkChange={noop}
        embedded
      />,
    );

    expect(html).toContain('remark-section-header');
    expect(html).toContain('remark-content-frame is-edit');
    expect(html).toContain('remark-inline-actions');
    expect(html.indexOf('remark-section-header')).toBeLessThan(html.indexOf('remark-content-frame is-edit'));
    expect(html.indexOf('remark-inline-actions')).toBeLessThan(html.indexOf('remark-content-frame is-edit'));
    expect(html).toContain('aria-label="编辑备注"');
    expect(html).toContain('aria-label="预览备注"');
    expect(html).toContain('aria-label="放大备注"');
    expect(html).not.toContain('remark-mode-switch');
    expect(html).not.toContain('remark-panel-actions');
  });

  it('keeps preview text selectable without rendering a duplicate remark search snippet', () => {
    const css = readFileSync(resolve('src/styles/global.css'), 'utf8');
    const html = renderToStaticMarkup(
      <RemarkPanel
        selectedNode={{ id: 'node-1', text: '新节点', remark: '备注命中内容', children: [] }}
        mode="edit"
        activeMatch={{ nodeId: 'node-1', field: 'remark', start: 2, end: 4, text: '命中' }}
        onModeChange={noop}
        onRemarkChange={noop}
        embedded
      />,
    );

    expect(css).toMatch(/\.remark-panel\.is-embedded \.remark-content-frame > \.markdown-preview,[\s\S]*?user-select: text;/);
    expect(css).not.toContain('remark-inline-action-band');
    expect(css).not.toContain('padding-top: 46px');
    expect(html).not.toContain('remark-search-context');
    expect(html).toContain('data-search-match-active="true"');
    expect(html).toContain('备注命中内容');
  });
});
