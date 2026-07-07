import { useEffect, useState } from 'react';
import { RemarkPanel } from '../../features/mindmap/RemarkPanel';
import { NODE_TYPE_SHAPES } from '../../features/mindmap/nodeTypes';
import { getEffectiveNodeStyle } from '../../features/mindmap/nodeStyles';
import type { SearchMatch } from '../../features/mindmap/searchReplace';
import type {
  MindmapNode,
  MindmapNodeStyle,
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
  activeRemarkMatch: SearchMatch | null;
  onChildNodeTypeChange: (nodeTypeId: string) => void;
  onSelectedNodeTypeChange: (nodeTypeId: string) => void;
  onNodeStyleChange: (style: MindmapNodeStyle) => void;
  onSaveStyleAsNodeType: (name: string) => void;
  onApplyStyleToNodeType: () => void;
  onResetNodeStyle: () => void;
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
  activeRemarkMatch,
  onChildNodeTypeChange,
  onSelectedNodeTypeChange,
  onNodeStyleChange,
  onSaveStyleAsNodeType,
  onApplyStyleToNodeType,
  onResetNodeStyle,
  onThemeChange,
  onRemarkModeChange,
  onRemarkChange,
  onManageNodeTypes,
  onCollapse,
}: RightInspectorPanelProps) {
  const [activeTab, setActiveTab] = useState<InspectorTab>('style');
  const [nodeTypeName, setNodeTypeName] = useState('');
  const selectedNodeType =
    nodeTypes.find((nodeType) => nodeType.id === selectedNode.nodeTypeId) ?? null;
  const effectiveStyle = getEffectiveNodeStyle(selectedNode, selectedNodeType);

  useEffect(() => {
    if (activeRemarkMatch?.nodeId === selectedNode.id) {
      setActiveTab('remark');
    }
  }, [
    activeRemarkMatch?.end,
    activeRemarkMatch?.nodeId,
    activeRemarkMatch?.start,
    selectedNode.id,
  ]);

  useEffect(() => {
    setNodeTypeName(
      selectedNode.text.trim() ? `${selectedNode.text.trim()}样式` : '节点样式',
    );
  }, [selectedNode.id, selectedNode.text]);

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
            <section className="inspector-control-group">
              <h3>当前画布</h3>
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
            </section>

            <section className="inspector-control-group">
              <h3>节点类型</h3>
              <p className="control-help">节点类型是全局样式模板；下方节点样式只影响当前节点。</p>
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
                <span>
                  新建子节点默认类型
                  <i
                    className="tooltip-dot"
                    title="使用快捷键或按钮新建子节点时，默认应用的节点类型。"
                    aria-label="使用快捷键或按钮新建子节点时，默认应用的节点类型。"
                  >
                    ?
                  </i>
                </span>
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
            </section>

            <section className="inspector-control-group">
              <h3>节点样式</h3>
              <div className="aligned-form node-style-form">
                <label>
                  <span>形状</span>
                  <select
                    value={effectiveStyle.shape}
                    onChange={(event) =>
                      onNodeStyleChange({
                        shape: event.target.value as MindmapNodeStyle['shape'],
                      })
                    }
                  >
                    {NODE_TYPE_SHAPES.map((shape) => (
                      <option key={shape.value} value={shape.value}>
                        {shape.label.replace(`${shape.value} `, '')}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>背景色</span>
                  <input
                    type="color"
                    value={effectiveStyle.backgroundColor}
                    onChange={(event) =>
                      onNodeStyleChange({ backgroundColor: event.target.value })
                    }
                  />
                </label>
                <label>
                  <span>边框色</span>
                  <input
                    type="color"
                    value={effectiveStyle.borderColor}
                    onChange={(event) =>
                      onNodeStyleChange({ borderColor: event.target.value })
                    }
                  />
                </label>
                <label>
                  <span>文本色</span>
                  <input
                    type="color"
                    value={effectiveStyle.textColor}
                    onChange={(event) =>
                      onNodeStyleChange({ textColor: event.target.value })
                    }
                  />
                </label>
                <label>
                  <span>字号</span>
                  <input
                    type="number"
                    min={12}
                    max={28}
                    value={effectiveStyle.fontSize}
                    onChange={(event) =>
                      onNodeStyleChange({ fontSize: Number(event.target.value) })
                    }
                  />
                </label>
                <label>
                  <span>加粗</span>
                  <input
                    type="checkbox"
                    checked={effectiveStyle.bold}
                    onChange={(event) =>
                      onNodeStyleChange({ bold: event.target.checked })
                    }
                  />
                </label>
              </div>
              <div className="node-style-actions">
                <input
                  type="text"
                  value={nodeTypeName}
                  aria-label="节点类型名称"
                  onChange={(event) => setNodeTypeName(event.target.value)}
                />
                <button
                  type="button"
                  className="primary-action"
                  onClick={() => onSaveStyleAsNodeType(nodeTypeName)}
                >
                  保存为节点类型
                </button>
                <button
                  type="button"
                  className="secondary-action"
                  disabled={!selectedNodeType}
                  onClick={onApplyStyleToNodeType}
                >
                  应用到当前节点类型
                </button>
                <button
                  type="button"
                  className="ghost-action"
                  onClick={onResetNodeStyle}
                >
                  重置为节点类型默认样式
                </button>
              </div>
            </section>

            <section className="style-summary inspector-control-group">
              <div className="inspector-section-heading">
                <h3>全局样式模板</h3>
                <button
                  type="button"
                  className="ghost-action"
                  onClick={onManageNodeTypes}
                  title="打开节点类型面板，管理全局样式模板。"
                >
                  管理全局节点类型
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
            </section>
          </div>
        ) : null}

        {activeTab === 'remark' ? (
          <RemarkPanel
            selectedNode={selectedNode}
            mode={remarkMode}
            onModeChange={onRemarkModeChange}
            onRemarkChange={onRemarkChange}
            activeMatch={activeRemarkMatch}
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
