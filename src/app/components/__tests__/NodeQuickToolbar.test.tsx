import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { getTagDropdownPosition, NodeQuickToolbar } from '../NodeQuickToolbar';

describe('NodeQuickToolbar', () => {
  it('renders the compact groups and disables actions without a selection', () => {
    const html = renderToStaticMarkup(
      <NodeQuickToolbar
        selectedNode={null}
        selectedNodes={[]}
        hasSelection={false}
        priorityValue="none"
        progressValue="none"
        availableTags={[]}
        onAddChild={() => undefined}
        onAddSibling={() => undefined}
        onAddParent={() => undefined}
        onOpenRemark={() => undefined}
        onSetPriority={() => undefined}
        onSetProgress={() => undefined}
        onAddTag={() => false}
        onRemoveTag={() => undefined}
        onToggleTag={() => undefined}
      />,
    );

    expect(html).toContain('节点快捷工具栏');
    expect(html).toContain('下级');
    expect(html).toContain('<span class="node-quick-select-label">优先级</span>');
    expect(html).toContain('<span class="node-quick-select-label">完成度</span>');
    expect(html).toContain('添加标签');
    expect(html).toContain('disabled=""');
    expect(html).toContain('node-quick-toolbar-structure-actions');
    expect(html).toContain('node-quick-action-symbol');
    expect(html).toContain('aria-label="设置优先级"');
    expect(html).toContain('aria-label="设置完成度"');
    expect(html).toContain('class="chevron-icon"');
    expect(html).toContain('data-chevron-direction="down"');
    expect(html).toContain('title="优先级"');
    expect(html).toContain('title="完成度"');
    expect(html).toContain('⚑ 无');
    expect(html).toContain('🔴 1');
    expect(html).toContain('◔ 无');
    expect(html).toContain('◑ 50%');
    expect(html).not.toContain('最高');
    expect(html).not.toContain('很高');
    expect(html).not.toContain('未开始');
    expect(html).not.toContain('进行中');
    expect(html).toContain('>备注</span>');
    expect(html).toContain('aria-label="打开备注编辑"');
    expect(html).toContain('>▤</span>');
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
        selectedNodes={[{
          id: 'node-1',
          text: '当前节点',
          remark: '已有备注',
          tags: ['需求', '高优先级', '第一阶段'],
          children: [],
        }]}
        hasSelection
        priorityValue="mixed"
        progressValue="mixed"
        availableTags={['需求', '高优先级', '第一阶段', '可复用']}
        onAddChild={() => undefined}
        onAddSibling={() => undefined}
        onAddParent={() => undefined}
        onOpenRemark={() => undefined}
        onSetPriority={() => undefined}
        onSetProgress={() => undefined}
        onAddTag={() => true}
        onRemoveTag={() => undefined}
        onToggleTag={() => undefined}
      />,
    );

    expect(html).toContain('3 个');
    expect(html).not.toContain('高优先级');
    expect(html).toContain('node-quick-toolbar-tag-trigger');
    expect(html).toContain('value="mixed"');
  });

  it('hosts node styling at the far end of the quick-action row', () => {
    const html = renderToStaticMarkup(
      <NodeQuickToolbar
        selectedNode={null}
        selectedNodes={[]}
        hasSelection={false}
        priorityValue="none"
        progressValue="none"
        availableTags={[]}
        onAddChild={() => undefined}
        onAddSibling={() => undefined}
        onAddParent={() => undefined}
        onOpenRemark={() => undefined}
        onSetPriority={() => undefined}
        onSetProgress={() => undefined}
        onAddTag={() => false}
        onRemoveTag={() => undefined}
        onToggleTag={() => undefined}
        styleToolbar={<section className="node-style-toolbar is-embedded">样式</section>}
      />,
    );

    expect(html).toContain('node-quick-toolbar-scroll has-node-style-toolbar');
    expect(html).toContain('node-quick-toolbar-style-slot');
    expect(html.indexOf('node-quick-toolbar-style-slot')).toBeGreaterThan(html.indexOf('node-tag-group'));
  });

  it('keeps priority and progress triggers wide enough for values and labels', () => {
    const css = readFileSync('src/styles/global.css', 'utf8');

    expect(css).toMatch(/\.node-quick-select select\s*\{[^}]*min-width:\s*104px;/);
    expect(css).toMatch(/\.node-quick-select-progress select\s*\{[^}]*min-width:\s*104px;/);
    expect(css).not.toContain('最高优先级');
    expect(css).toMatch(/\.node-quick-select select,\r?\n\.node-style-toolbar select/);
    expect(css).toContain('appearance: none;');
    expect(css).toContain('stroke-width=\'1.75\'');
  });

  it('anchors the tag dialog outside the horizontally scrolling toolbar row', () => {
    const source = readFileSync('src/app/components/NodeQuickToolbar.tsx', 'utf8');
    const css = readFileSync('src/styles/global.css', 'utf8');

    expect(getTagDropdownPosition({
      toolbarLeft: 20,
      toolbarTop: 80,
      toolbarWidth: 720,
      triggerRight: 520,
      triggerBottom: 122,
      menuWidth: 260,
    })).toEqual({ left: 240, top: 50 });
    expect(source).toContain('ref={toolbarScrollRef}');
    expect(source).toContain('ref={tagDropdownRef}');
    expect(source.indexOf('ref={tagDropdownRef}')).toBeGreaterThan(source.indexOf('ref={toolbarScrollRef}'));
    expect(css).toContain('.node-quick-toolbar > .node-tag-dropdown');
  });

});
