import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LeftResourcePanel } from '../LeftResourcePanel';
import {
  RightInspectorPanel,
  normalizeHexColorInput,
} from '../RightInspectorPanel';
import { TopMenuBar, type TopMenuGroup } from '../TopMenuBar';
import type { MindmapNode, MindmapNodeType } from '../../../features/mindmap/types';

const noop = () => undefined;

const nodeType: MindmapNodeType = {
  id: 'type-task',
  name: '任务节点',
  icon: '✅',
  shape: 'rounded',
  backgroundColor: '#fff7e8',
  borderColor: '#f59f00',
  textColor: '#14315f',
  fontSize: 18,
  bold: true,
  defaultText: '新任务',
  defaultRemark: '',
};

const selectedNode: MindmapNode = {
  id: 'node-1',
  text: '当前节点',
  remark: '',
  nodeTypeId: nodeType.id,
  children: [],
};

describe('v1.13 information architecture components', () => {
  it('uses clear left workspace entries with tooltips and no resource umbrella header', () => {
    const html = renderToStaticMarkup(
      <LeftResourcePanel
        activeView="templates"
        title="模板库"
        onViewChange={noop}
      >
        <div>模板内容</div>
      </LeftResourcePanel>,
    );

    expect(html).toContain('工作区面板');
    expect(html).toContain('模板库：浏览、预览和应用思维导图模板');
    expect(html).toContain('节点类型：管理全局样式模板');
    expect(html).toContain('查找：搜索和替换节点标题、备注');
    expect(html).toContain('插件：打开插件管理、中心、工作台和诊断');
    expect(html).toContain('◒');
    expect(html).toContain('🧩');
    expect(html).not.toContain('◇');
    expect(html).not.toContain('♢');
    expect(html).not.toContain('<span>资源</span><h2>模板库</h2>');
  });

  it('splits the top bar into left menus, truly centered document status, and right actions', () => {
    const menus: TopMenuGroup[] = [
      {
        id: 'file',
        label: '文件',
        items: [{ label: '新建' }],
      },
      { id: 'edit', label: '编辑', items: [{ label: '复制' }] },
      { id: 'insert', label: '插入', items: [{ label: '子节点' }] },
      { id: 'view', label: '视图', items: [{ label: '居中' }] },
      { id: 'plugin', label: '插件', items: [{ label: '插件管理' }] },
      {
        id: 'help',
        label: '帮助',
        items: [
          { label: '快捷键' },
          { label: '使用指南' },
          { label: '插件开发文档' },
          { label: '关于 Local Mindmap' },
        ],
      },
    ];
    const html = renderToStaticMarkup(
      <TopMenuBar
        currentTitle="竞赛方案 · 未保存"
        menus={menus}
        isDirty
        saveStatus="draft"
        saveStatusLabel="草稿"
        onUndo={noop}
        onRedo={noop}
        onQuickSave={noop}
      />,
    );

    const leftMenus = html.match(
      /<nav[^>]*data-testid="topbar-left-menus"[^>]*>([\s\S]*?)<\/nav>/,
    )?.[1] ?? '';
    const documentStatus = html.match(
      /<div[^>]*data-testid="topbar-document-status"[^>]*>([\s\S]*?)<\/div>/,
    )?.[1] ?? '';
    const rightActions = html.match(
      /<div[^>]*data-testid="topbar-right-actions"[^>]*>([\s\S]*?)<\/div>/,
    )?.[1] ?? '';

    expect(leftMenus).toBeTruthy();
    expect(documentStatus).toBeTruthy();
    expect(rightActions).toBeTruthy();
    const menuPositions = ['文件', '编辑', '插入', '视图', '插件', '帮助'].map(
      (label) => leftMenus.indexOf(label),
    );
    expect(menuPositions.every((position) => position >= 0)).toBe(true);
    expect(menuPositions).toEqual([...menuPositions].sort((left, right) => left - right));
    for (const label of ['文件', '编辑', '插入', '视图', '插件', '帮助']) {
      expect(leftMenus).toContain(label);
      expect(rightActions).not.toContain(label);
    }
    expect(documentStatus).toContain('竞赛方案 · 未保存');
    expect(documentStatus).toContain('草稿');
    expect(rightActions).toContain('撤销');
    expect(rightActions).toContain('重做');
    expect(rightActions).toContain('保存');

    expect(html).toContain('topbar-left-menus topbar-non-shrink');
    expect(html).toContain('topbar-document-status topbar-true-center');
    expect(html).toContain('top-document-title topbar-title-ellipsis');
    expect(html).toContain('top-menu-actions topbar-right-actions topbar-non-shrink');
    expect(html).not.toContain('本地思维导图工具');
    expect(html).not.toContain('本地化思维导图工具');
    expect(html).not.toContain('top-brand');
    expect(html).not.toContain('top-menu-spacer');
    expect(html).not.toContain('top-menu-right');
    expect(documentStatus).not.toContain('Local Mindmap');
    expect(html).not.toContain('>Local Mindmap</');
    expect(html).toContain('关于 Local Mindmap');
    expect(html).toContain('document-status-dot is-dirty is-draft');
  });

  it('renders current node style editing without renaming global node type management', () => {
    const html = renderToStaticMarkup(
      <RightInspectorPanel
        selectedNode={selectedNode}
        selectedCount={1}
        nodeTypes={[nodeType]}
        childNodeTypeId=""
        themeId="default-blue"
        themes={[{ id: 'default-blue', name: '默认蓝' }]}
        remarkMode="edit"
        activeRemarkMatch={null}
        onChildNodeTypeChange={noop}
        onSelectedNodeTypeChange={noop}
        onNodeStyleChange={noop}
        onSaveStyleAsNodeType={noop}
        onApplyStyleToNodeType={noop}
        onResetNodeStyle={noop}
        onThemeChange={noop}
        onRemarkModeChange={noop}
        onRemarkChange={noop}
        onManageNodeTypes={noop}
        onCollapse={noop}
      />,
    );

    expect(html).toContain('节点样式');
    expect(html).toContain('类型');
    expect(html).toContain('当前节点样式');
    expect(html).toContain('节点类型是全局样式模板，可被多个节点复用。');
    expect(html).toContain('下方样式默认只影响当前节点。');
    expect(html).toContain('背景色 Hex 值');
    expect(html).toContain('#FFF7E8');
    expect(html).toContain('#F59F00');
    expect(html).toContain('#14315F');
    expect(html).toContain('保存为节点类型');
    expect(html).toContain('应用到当前节点类型');
    expect(html).toContain('重置为节点类型默认样式');
    expect(html).toContain('新建子节点默认类型');
    expect(html).toContain('管理全局节点类型');
    expect(html).not.toContain('新增子节点类型');
    expect(html).not.toContain('管理类型</button>');
  });

  it('normalizes editable hex values and rejects invalid colors before style writes', () => {
    expect(normalizeHexColorInput('#ffffff')).toBe('#FFFFFF');
    expect(normalizeHexColorInput('14315f')).toBe('#14315F');
    expect(normalizeHexColorInput('#bad')).toBeNull();
    expect(normalizeHexColorInput('not-a-color')).toBeNull();
  });
});
