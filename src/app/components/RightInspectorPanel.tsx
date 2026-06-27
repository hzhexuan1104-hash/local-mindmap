import { useState } from 'react';
import { RemarkPanel } from '../../features/mindmap/RemarkPanel';
import type {
  MindmapNode,
  MindmapNodeType,
} from '../../features/mindmap/types';

type InspectorTab = 'style' | 'remark' | 'info';

type ThemeOption = {
  id: string;
  name: string;
};

type RightInspectorPanelProps = {
  selectedNode: MindmapNode;
  selectedCount: number;
  nodeTypes: MindmapNodeType[];
  childNodeTypeId: string;
  themeId: string;
  themes: ThemeOption[];
  remarkMode: 'edit' | 'preview';
  onChildNodeTypeChange: (nodeTypeId: string) => void;
  onSelectedNodeTypeChange: (nodeTypeId: string) => void;
  onThemeChange: (themeId: string) => void;
  onRemarkModeChange: (mode: 'edit' | 'preview') => void;
  onRemarkChange: (remark: string) => void;
  onManageNodeTypes: () => void;
  onCollapse: () => void;
};

export function RightInspectorPanel({
  selectedNode,
  selectedCount,
  nodeTypes,
  childNodeTypeId,
  themeId,
  themes,
  remarkMode,
  onChildNodeTypeChange,
  onSelectedNodeTypeChange,
  onThemeChange,
  onRemarkModeChange,
  onRemarkChange,
  onManageNodeTypes,
  onCollapse,
}: RightInspectorPanelProps) {
  const [activeTab, setActiveTab] = useState<InspectorTab>('style');
  const selectedNodeType =
    nodeTypes.find((nodeType) => nodeType.id === selectedNode.nodeTypeId) ?? null;

  return (
    <aside className="inspector-panel" aria-label="节点检查器">
      <header className="inspector-header">
        <div>
          <span>当前节点</span>
          <h2 title={selectedNode.text}>{selectedNode.text}</h2>
        </div>
        <button
          type="button"
          className="panel-collapse-action"
          onClick={onCollapse}
          aria-label="收起右侧面板"
          title="收起右侧面板"
        >
          ›
        </button>
      </header>

      <div className="inspector-tabs" role="tablist" aria-label="属性面板">
        {(
          [
            ['style', '样式'],
            ['remark', '备注'],
            ['info', '信息'],
          ] as const
        ).map(([tab, label]) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            className={activeTab === tab ? 'is-active' : undefined}
            onClick={() => setActiveTab(tab)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="inspector-content">
        {activeTab === 'style' ? (
          <div className="inspector-section">
            <label className="stacked-control">
              <span>
                节点类型
                {selectedCount > 1 ? `（应用到 ${selectedCount} 个节点）` : ''}
              </span>
              <select
                value={selectedNode.nodeTypeId ?? ''}
                onChange={(event) =>
                  onSelectedNodeTypeChange(event.target.value)
                }
              >
                <option value="">普通节点</option>
                {nodeTypes.map((nodeType) => (
                  <option key={nodeType.id} value={nodeType.id}>
                    {nodeType.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="stacked-control">
              <span>新增子节点类型</span>
              <select
                value={childNodeTypeId}
                onChange={(event) => onChildNodeTypeChange(event.target.value)}
              >
                <option value="">普通节点</option>
                {nodeTypes.map((nodeType) => (
                  <option key={nodeType.id} value={nodeType.id}>
                    {nodeType.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="stacked-control">
              <span>画布主题</span>
              <select
                value={themeId}
                onChange={(event) => onThemeChange(event.target.value)}
              >
                {themes.map((theme) => (
                  <option key={theme.id} value={theme.id}>
                    {theme.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="style-summary">
              <div className="inspector-section-heading">
                <span>样式摘要</span>
                <button type="button" onClick={onManageNodeTypes}>
                  管理类型
                </button>
              </div>
              {selectedNodeType ? (
                <dl>
                  <div>
                    <dt>形状</dt>
                    <dd>{selectedNodeType.shape}</dd>
                  </div>
                  <div>
                    <dt>背景</dt>
                    <dd>
                      <i style={{ background: selectedNodeType.backgroundColor }} />
                      {selectedNodeType.backgroundColor}
                    </dd>
                  </div>
                  <div>
                    <dt>边框</dt>
                    <dd>
                      <i style={{ background: selectedNodeType.borderColor }} />
                      {selectedNodeType.borderColor}
                    </dd>
                  </div>
                  <div>
                    <dt>字体</dt>
                    <dd>
                      {selectedNodeType.fontSize}px
                      {selectedNodeType.bold ? ' / 加粗' : ''}
                    </dd>
                  </div>
                </dl>
              ) : (
                <p>当前使用主题中的默认节点样式。</p>
              )}
            </div>
          </div>
        ) : null}

        {activeTab === 'remark' ? (
          <RemarkPanel
            selectedNode={selectedNode}
            mode={remarkMode}
            onModeChange={onRemarkModeChange}
            onRemarkChange={onRemarkChange}
            embedded
          />
        ) : null}

        {activeTab === 'info' ? (
          <div className="inspector-section inspector-info">
            <dl>
              <div>
                <dt>节点 ID</dt>
                <dd>{selectedNode.id}</dd>
              </div>
              <div>
                <dt>节点类型</dt>
                <dd>{selectedNodeType?.name ?? '普通节点'}</dd>
              </div>
              <div>
                <dt>子节点数量</dt>
                <dd>{selectedNode.children.length}</dd>
              </div>
              <div>
                <dt>选中状态</dt>
                <dd>
                  {selectedCount > 1 ? `批量选中 ${selectedCount} 个节点` : '主选中节点'}
                </dd>
              </div>
            </dl>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
