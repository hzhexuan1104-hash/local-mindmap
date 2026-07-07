import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LeftResourcePanel } from '../LeftResourcePanel';
import { RightInspectorPanel } from '../RightInspectorPanel';
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
    expect(html).not.toContain('<span>资源</span><h2>模板库</h2>');
  });

  it('keeps import and export under File and exposes separate find and replace', () => {
    const menus: TopMenuGroup[] = [
      {
        id: 'file',
        label: '文件',
        items: [
          { label: '导入', children: [{ label: '导入 Markdown' }] },
          { label: '导出', children: [{ label: '导出 Markdown' }] },
        ],
      },
      {
        id: 'edit',
        label: '编辑',
        items: [{ label: '查找' }, { label: '替换' }],
      },
    ];
    const html = renderToStaticMarkup(
      <TopMenuBar
        currentTitle="未命名导图 · 未保存"
        menus={menus}
        isDirty
        onUndo={noop}
        onRedo={noop}
        onQuickSave={noop}
      />,
    );

    expect(html).toContain('本地思维导图工具');
    expect(html).toContain('文件');
    expect(html).toContain('编辑');
    expect(html).toContain('导入 / 导出');
    expect(html).toContain('查找 / 替换');
    expect(html).not.toContain('导入导出');
    expect(html).toContain('document-status-dot is-dirty');
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
    expect(html).toContain('保存为节点类型');
    expect(html).toContain('应用到当前节点类型');
    expect(html).toContain('重置为节点类型默认样式');
    expect(html).toContain('新建子节点默认类型');
    expect(html).toContain('管理全局节点类型');
    expect(html).not.toContain('新增子节点类型');
    expect(html).not.toContain('管理类型</button>');
  });
});
