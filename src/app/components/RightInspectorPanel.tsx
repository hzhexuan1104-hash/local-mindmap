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
  editableNodeTypeIds?: string[];
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

export function normalizeHexColorInput(value: string) {
  const normalized = value.trim().toUpperCase();
  if (/^#[0-9A-F]{6}$/.test(normalized)) {
    return normalized;
  }
  if (/^[0-9A-F]{6}$/.test(normalized)) {
    return `#${normalized}`;
  }
  return null;
}

function ColorControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value.toUpperCase());
  const [error, setError] = useState('');

  useEffect(() => {
    setDraft(value.toUpperCase());
    setError('');
  }, [value]);

  const updateFromHex = (nextValue: string) => {
    setDraft(nextValue);
    const normalized = normalizeHexColorInput(nextValue);
    if (!normalized) {
      setError('请输入 #RRGGBB 格式');
      return;
    }

    setError('');
    onChange(normalized);
  };

  return (
    <div className="color-control">
      <span className="color-control-label">{label}</span>
      <label
        className="color-swatch-button"
        title={`选择${label}`}
        style={{ backgroundColor: value }}
      >
        <span className="sr-only">选择{label}</span>
        <input
          type="color"
          value={value}
          aria-label={`选择${label}`}
          onChange={(event) => {
            const nextValue = event.target.value.toUpperCase();
            setDraft(nextValue);
            setError('');
            onChange(nextValue);
          }}
        />
      </label>
      <input
        className={error ? 'hex-color-input is-invalid' : 'hex-color-input'}
        type="text"
        value={draft}
        aria-label={`${label} Hex 值`}
        spellCheck={false}
        onChange={(event) => updateFromHex(event.target.value)}
        onBlur={() => {
          if (error) {
            setDraft(value.toUpperCase());
            setError('');
          }
        }}
      />
      {error ? <span className="field-error">{error}</span> : null}
    </div>
  );
}

export function RightInspectorPanel({
  selectedNode,
  selectedCount,
  nodeTypes,
  editableNodeTypeIds,
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
  const canApplyToSelectedNodeType = Boolean(
    selectedNodeType &&
      (!editableNodeTypeIds ||
        editableNodeTypeIds.includes(selectedNodeType.id)),
  );
  const applyNodeTypeTooltip = !selectedNodeType
    ? '当前节点未绑定有效节点类型'
    : !canApplyToSelectedNodeType
      ? '插件或文件内置节点类型不能在此处直接修改'
      : '更新当前节点类型的全局样式';

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
              <div className="inspector-section-heading">
                <h3>类型</h3>
                <button
                  type="button"
                  className="ghost-action"
                  onClick={onManageNodeTypes}
                  title="打开节点类型面板，管理全局样式模板。"
                >
                  管理全局节点类型
                </button>
              </div>
              <p className="control-help">节点类型是全局样式模板，可被多个节点复用。</p>
              <label className="stacked-control">
                <span>
                  当前节点类型
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
              <h3>当前节点样式</h3>
              <p className="control-help">下方样式默认只影响当前节点。</p>
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
                <ColorControl
                  label="背景色"
                  value={effectiveStyle.backgroundColor}
                  onChange={(backgroundColor) =>
                    onNodeStyleChange({ backgroundColor })
                  }
                />
                <ColorControl
                  label="边框色"
                  value={effectiveStyle.borderColor}
                  onChange={(borderColor) =>
                    onNodeStyleChange({ borderColor })
                  }
                />
                <ColorControl
                  label="文本色"
                  value={effectiveStyle.textColor}
                  onChange={(textColor) => onNodeStyleChange({ textColor })}
                />
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
                  disabled={!canApplyToSelectedNodeType}
                  title={applyNodeTypeTooltip}
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
