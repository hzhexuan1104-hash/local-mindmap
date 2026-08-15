import { renderToStaticMarkup } from 'react-dom/server';
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

  it('places icon actions in a separate band above the editor', () => {
    const html = renderToStaticMarkup(
      <RemarkPanel
        selectedNode={{ id: 'node-1', text: '新节点', remark: '', children: [] }}
        mode="edit"
        onModeChange={noop}
        onRemarkChange={noop}
        embedded
      />,
    );

    expect(html).toContain('remark-inline-action-band');
    expect(html).toContain('remark-content-frame is-edit');
    expect(html).toContain('remark-inline-actions');
    expect(html.indexOf('remark-inline-action-band')).toBeLessThan(html.indexOf('remark-content-frame is-edit'));
    expect(html).toContain('aria-label="编辑备注"');
    expect(html).toContain('aria-label="预览备注"');
    expect(html).toContain('aria-label="放大备注"');
    expect(html).not.toContain('remark-mode-switch');
    expect(html).not.toContain('remark-panel-actions');
  });
});
