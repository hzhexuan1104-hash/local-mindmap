import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { WorkspacePanelHost } from '../WorkspacePanelHost';
import { RightInspectorPanel } from '../RightInspectorPanel';
import { NodeManagerDrawer } from '../NodeManagerDrawer';
import { NodeStyleToolbar } from '../NodeStyleToolbar';
import { createEmptyNodeTypeDraft } from '../../../features/mindmap/nodeTypes';
import { getMenuHoverPath, TopMenuBar, type TopMenuGroup } from '../TopMenuBar';
import type { MindmapNode, MindmapNodeType } from '../../../features/mindmap/types';

const noop = () => undefined;
const nodeType: MindmapNodeType = {
  id: 'type-task', name: 'Task', icon: '✓', shape: 'rounded',
  backgroundColor: '#fff7e8', borderColor: '#f59f00', textColor: '#14315f',
  fontSize: 18, bold: true, defaultText: 'New task', defaultRemark: '',
};
const selectedNode: MindmapNode = {
  id: 'node-1', text: 'Current node', remark: '', nodeTypeId: nodeType.id, children: [],
};

describe('v1.18 information architecture components', () => {
  it('uses a crisp native Chinese UI font stack with regular menu weight', () => {
    const css = readFileSync(resolve('src/styles/global.css'), 'utf8');

    expect(css).toContain('"Microsoft YaHei UI", "Microsoft YaHei"');
    expect(css).toMatch(
      /\.top-menu-trigger\s*\{[^}]*font-size: 12px;[^}]*font-weight: 500;/,
    );
    expect(css).toMatch(
      /\.node-quick-toolbar button\s*\{[^}]*font-size: 12px;[^}]*font-weight: 500;/,
    );
  });

  it('renders a single on-demand workspace panel with no navigation rail', () => {
    const html = renderToStaticMarkup(
      <WorkspacePanelHost id="templates" title="Templates" onClose={noop}><div>content</div></WorkspacePanelHost>,
    );
    expect(html).toContain('data-workspace-panel="templates"');
    expect(html).toContain('workspace-panel');
    expect(html).toContain('workspace-overlay-backdrop');
    expect(html).toContain('aria-modal="true"');
    expect(html).not.toContain('resource-rail');
  });

  it('keeps the required six top-level menus in order without insert', () => {
    const menus: TopMenuGroup[] = [
      ['file', 'File'], ['edit', 'Edit'], ['node', 'Node'], ['view', 'View'], ['plugins', 'Plugins'], ['help', 'Help'],
    ].map(([id, label]) => ({ id, label, items: [{ id: `${id}.action`, label: `${label} action`, execute: noop }] }));
    const html = renderToStaticMarkup(<TopMenuBar currentTitle="Document" menus={menus} isDirty={false} />);
    const positions = ['File', 'Edit', 'Node', 'View', 'Plugins', 'Help'].map((label) => html.indexOf(`>${label}<`));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((left, right) => left - right));
    expect(html).not.toContain('Insert');
    expect(html).not.toContain('topbar-right-actions');
  });

  it('renders bounded data-driven submenu metadata', () => {
    const html = renderToStaticMarkup(<TopMenuBar currentTitle="Document" menus={[{ id: 'file', label: 'File', items: [{ id: 'open', label: 'Open', children: [{ id: 'recent', label: 'Recent files', children: [{ id: 'entry', label: 'Example', shortcut: 'Ctrl+O', checked: true, execute: noop }] }] }] }]} isDirty={false} />);
    expect(html).toContain('data-menu-item-id="file"');
    expect(html).toContain('aria-haspopup="menu"');
  });

  it('places the quick-action disclosure in the top menu layer', () => {
    const expanded = renderToStaticMarkup(
      <TopMenuBar
        currentTitle="Document"
        menus={[]}
        isDirty={false}
        isQuickToolbarExpanded
        onToggleQuickToolbar={noop}
      />,
    );
    const collapsed = renderToStaticMarkup(
      <TopMenuBar
        currentTitle="Document"
        menus={[]}
        isDirty={false}
        isQuickToolbarExpanded={false}
        onToggleQuickToolbar={noop}
      />,
    );

    expect(expanded).toContain('topbar-quick-toolbar-toggle');
    expect(expanded).toContain('aria-expanded="true"');
    expect(collapsed).toContain('aria-expanded="false"');
  });

  it('closes an open sibling submenu when hovering a leaf action', () => {
    expect(getMenuHoverPath(['file', 'location'], true)).toEqual(['file', 'location']);
    expect(getMenuHoverPath(['file', 'settings'], false)).toEqual(['file']);
  });

  it('limits the inspector to the selected node and its remark', () => {
    const html = renderToStaticMarkup(<RightInspectorPanel selectedNode={selectedNode} nodeTypes={[nodeType]} remarkMode="edit" activeRemarkMatch={null} onRemarkModeChange={noop} onRemarkChange={noop} onCollapse={noop} />);

    expect(html).toContain('Current node');
    expect(html).toContain('Task');
    expect(html).toContain('备注');
    expect(html).toContain('inspector-remark-context-details');
    expect(html).not.toContain('当前节点');
    expect(html).not.toContain('节点样式');
    expect(html).toContain('备注');
    expect(html).not.toContain('节点形状');
    expect(html).not.toContain('背景色');
    expect(html).not.toContain('重置为类型默认样式');
  });

  it('shows the complete node-type name in the compact remark context', () => {
    const css = readFileSync(resolve('src/styles/global.css'), 'utf8');

    expect(css).toMatch(
      /\.inspector-panel-remark \.inspector-node-type\s*\{[^}]*max-width:\s*none;[^}]*overflow:\s*visible;[^}]*text-overflow:\s*clip;[^}]*white-space:\s*normal;/,
    );
  });

  it('moves compact batch-capable style controls to the canvas toolbar', () => {
    const html = renderToStaticMarkup(<NodeStyleToolbar selectedNode={selectedNode} selectedNodeCount={2} isRoot={false} nodeTypes={[nodeType]} onNodeStyleChange={noop} onNodeIconChange={noop} onResetNodeStyle={noop} />);

    expect(html).toContain('node-style-toolbar');
    expect(html).toContain('aria-label="节点图标"');
    expect(html).toContain('aria-label="节点形状"');
    expect(html).toContain('aria-label="背景色"');
    expect(html).toContain('aria-label="边框色"');
    expect(html).toContain('aria-label="文字色"');
    expect(html).toContain('aria-label="字号"');
    expect(html).toContain('aria-label="加粗"');
    expect(html).toContain('将应用到 2 个节点');
  });

  it('disables the canvas style toolbar when no node is selected', () => {
    const html = renderToStaticMarkup(<NodeStyleToolbar selectedNode={null} selectedNodeCount={0} isRoot={false} nodeTypes={[nodeType]} onNodeStyleChange={noop} onNodeIconChange={noop} onResetNodeStyle={noop} />);

    expect(html).toContain('disabled=""');
    expect(html).toContain('未选中节点，样式工具不可用');
  });

  it('keeps node-type management in a modal without a current-node switcher', () => {
    const html = renderToStaticMarkup(
      <NodeManagerDrawer
        nodeTypes={[nodeType]}
        draft={createEmptyNodeTypeDraft()}
        editingNodeTypeId={null}
        onDraftChange={noop}
        onSave={noop}
        onEdit={noop}
        onDelete={noop}
        onImport={noop}
        onExport={noop}
      />,
    );

    expect(html).toContain('node-manager-drawer');
    expect(html).toContain('节点类型列表');
    expect(html).toContain('导入类型包');
    expect(html).not.toContain('切换节点类型');
  });

  it('marks the generated-ID node-type name input as a field-level validation target', () => {
    const html = renderToStaticMarkup(
      <NodeManagerDrawer
        nodeTypes={[]}
        draft={{ ...createEmptyNodeTypeDraft(), name: '' }}
        editingNodeTypeId={null}
        onDraftChange={noop}
        onSave={noop}
        onEdit={noop}
        onDelete={noop}
        onImport={noop}
        onExport={noop}
      />,
    );

    expect(html).toContain('aria-invalid="false"');
  });
});
