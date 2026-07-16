import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { WorkspacePanelHost } from '../WorkspacePanelHost';
import { RightInspectorPanel, normalizeHexColorInput } from '../RightInspectorPanel';
import { TopMenuBar, type TopMenuGroup } from '../TopMenuBar';
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
  it('renders a single on-demand workspace panel with no navigation rail', () => {
    const html = renderToStaticMarkup(
      <WorkspacePanelHost id="templates" title="Templates" onClose={noop}><div>content</div></WorkspacePanelHost>,
    );
    expect(html).toContain('data-workspace-panel="templates"');
    expect(html).toContain('workspace-panel');
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

  it('limits the inspector to visual style and remark tabs', () => {
    const html = renderToStaticMarkup(<RightInspectorPanel selectedNode={selectedNode} nodeTypes={[nodeType]} remarkMode="edit" activeRemarkMatch={null} onNodeStyleChange={noop} onSaveStyleAsNodeType={noop} onResetNodeStyle={noop} onRemarkModeChange={noop} onRemarkChange={noop} onCollapse={noop} />);
    expect(html).toContain('样式');
    expect(html).toContain('备注');
    expect(html).not.toContain('信息');
    expect(html).not.toContain('当前节点类型');
    expect(html).not.toContain('应用到当前节点类型');
    expect(html).not.toContain('管理全局节点类型');
  });

  it('normalizes editable hex values and rejects invalid colors', () => {
    expect(normalizeHexColorInput('#ffffff')).toBe('#FFFFFF');
    expect(normalizeHexColorInput('14315f')).toBe('#14315F');
    expect(normalizeHexColorInput('#bad')).toBeNull();
  });
});
