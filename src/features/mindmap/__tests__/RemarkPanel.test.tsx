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
});
