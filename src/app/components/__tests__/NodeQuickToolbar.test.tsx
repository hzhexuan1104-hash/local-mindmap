import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { NodeQuickToolbar } from '../NodeQuickToolbar';

describe('NodeQuickToolbar', () => {
  it('renders the compact groups and disables actions without a selection', () => {
    const html = renderToStaticMarkup(
      <NodeQuickToolbar
        selectedNode={null}
        hasSelection={false}
        onAddChild={() => undefined}
        onAddSibling={() => undefined}
        onAddParent={() => undefined}
        onOpenRemark={() => undefined}
        onSetPriority={() => undefined}
        onSetProgress={() => undefined}
        onAddTag={() => false}
        onRemoveTag={() => undefined}
      />,
    );

    expect(html).toContain('节点快捷工具条');
    expect(html).toContain('下级');
    expect(html).toContain('优先级');
    expect(html).toContain('完成度');
    expect(html).toContain('添加标签');
    expect(html).toContain('disabled=""');
    expect(html).toContain('priority-choice--1');
    expect(html).toContain('priority-choice--9');
    expect(html).not.toContain('node-note-popover');
    expect(html).not.toContain('<textarea');
  });

  it('keeps tag names inside the fixed-width dropdown instead of the toolbar row', () => {
    const html = renderToStaticMarkup(
      <NodeQuickToolbar
        selectedNode={{
          id: 'node-1',
          text: '当前节点',
          remark: '已有备注',
          tags: ['需求', '高优先级', '第一阶段'],
          children: [],
        }}
        hasSelection
        onAddChild={() => undefined}
        onAddSibling={() => undefined}
        onAddParent={() => undefined}
        onOpenRemark={() => undefined}
        onSetPriority={() => undefined}
        onSetProgress={() => undefined}
        onAddTag={() => true}
        onRemoveTag={() => undefined}
      />,
    );

    expect(html).toContain('3 个');
    expect(html).not.toContain('高优先级');
    expect(html).toContain('node-quick-toolbar-tag-trigger');
  });
});
