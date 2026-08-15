import { useEffect, useState } from 'react';
import { RemarkPanel } from '../../features/mindmap/RemarkPanel';
import { NODE_TYPE_ICONS, NODE_TYPE_SHAPES } from '../../features/mindmap/nodeTypes';
import { getEffectiveNodeStyle } from '../../features/mindmap/nodeStyles';
import type { SearchMatch } from '../../features/mindmap/searchReplace';
import type { MindmapNode, MindmapNodeStyle, MindmapNodeType } from '../../features/mindmap/types';

type InspectorTab = 'style' | 'remark';

const INHERIT_NODE_TYPE_ICON = '__inherit-node-type-icon__';
const CLEAR_NODE_ICON = '__clear-node-icon__';

type NodeIconOption = { value: string; label: string };

export type RemarkFocusRequest = { id: number; nodeId: string };

type RightInspectorPanelProps = {
  selectedNode: MindmapNode;
  selectedNodeCount?: number;
  isRoot?: boolean;
  nodeTypes: MindmapNodeType[];
  nodeIcons?: ReadonlyArray<NodeIconOption>;
  remarkMode: 'edit' | 'preview';
  activeRemarkMatch: SearchMatch | null;
  remarkFocusRequest?: RemarkFocusRequest | null;
  onNodeStyleChange: (style: MindmapNodeStyle) => void;
  onNodeIconChange: (icon: string | undefined) => void;
  onResetNodeStyle: () => void;
  onRemarkModeChange: (mode: 'edit' | 'preview') => void;
  onRemarkChange: (remark: string) => void;
  onCollapse: () => void;
};

export function normalizeHexColorInput(value: string) {
  const normalized = value.trim().toUpperCase();
  if (/^#[0-9A-F]{6}$/.test(normalized)) return normalized;
  if (/^[0-9A-F]{6}$/.test(normalized)) return `#${normalized}`;
  return null;
}

function ColorButton({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="inspector-style-color-swatch color-swatch-button" title={label} style={{ backgroundColor: value }}>
      <span className="sr-only">{label}</span>
      <input type="color" value={value} aria-label={label} onChange={(event) => onChange(event.target.value.toUpperCase())} />
    </label>
  );
}

export function RightInspectorPanel({
  selectedNode,
  selectedNodeCount = 1,
  isRoot = false,
  nodeTypes,
  nodeIcons = NODE_TYPE_ICONS,
  remarkMode,
  activeRemarkMatch,
  remarkFocusRequest = null,
  onNodeStyleChange,
  onNodeIconChange,
  onResetNodeStyle,
  onRemarkModeChange,
  onRemarkChange,
  onCollapse,
}: RightInspectorPanelProps) {
  const [activeTab, setActiveTab] = useState<InspectorTab>('style');
  const selectedNodeType = nodeTypes.find((nodeType) => nodeType.id === selectedNode.nodeTypeId) ?? null;
  const effectiveStyle = getEffectiveNodeStyle(selectedNode, selectedNodeType, isRoot);
  const selectedIcon = selectedNode.style?.icon;
  const selectedIconValue = selectedIcon === undefined
    ? INHERIT_NODE_TYPE_ICON
    : selectedIcon === '' ? CLEAR_NODE_ICON : selectedIcon;
  const iconOptions = selectedIcon && !nodeIcons.some((icon) => icon.value === selectedIcon)
    ? [{ value: selectedIcon, label: `${selectedIcon} 当前图标` }, ...nodeIcons]
    : nodeIcons;
  const shouldFocusRemark = remarkFocusRequest?.nodeId === selectedNode.id;

  useEffect(() => {
    if (activeRemarkMatch?.nodeId === selectedNode.id || shouldFocusRemark) setActiveTab('remark');
  }, [activeRemarkMatch?.end, activeRemarkMatch?.nodeId, activeRemarkMatch?.start, remarkFocusRequest?.id, selectedNode.id, shouldFocusRemark]);

  return (
    <aside className="inspector-panel" aria-label="节点检查器">
      <header className="inspector-header">
        <div>
          <span>当前节点</span>
          <h2 title={selectedNode.text}>{selectedNode.text}</h2>
        </div>
        <button type="button" className="panel-collapse-action" onClick={onCollapse} aria-label="收起右侧面板" title="收起右侧面板">‹</button>
      </header>

      <div className="inspector-tabs" role="tablist" aria-label="属性面板">
        {([['style', '样式'], ['remark', '备注']] as const).map(([tab, label]) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            className={activeTab === tab ? 'is-active' : undefined}
            onClick={() => setActiveTab(tab)}
            onKeyDown={(event) => {
              if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
              event.preventDefault();
              setActiveTab(tab === 'style' ? 'remark' : 'style');
            }}
          >{label}</button>
        ))}
      </div>

      <div className="inspector-content">
        {activeTab === 'style' ? (
          <section className="inspector-section inspector-style-tools">
            <div className="inspector-style-heading">
              <h3>节点样式</h3>
              <span>{selectedNodeCount > 1 ? `应用到 ${selectedNodeCount} 个节点` : '应用到当前节点'}</span>
            </div>
            <div className="inspector-style-form" aria-label="节点样式工具">
              <div className="inspector-style-field-grid">
                <label className="inspector-style-field">
                  <span>节点图标</span>
                <select
                  aria-label="节点图标"
                  value={selectedIconValue}
                  onChange={(event) => {
                    const value = event.target.value;
                    onNodeIconChange(value === INHERIT_NODE_TYPE_ICON ? undefined : value === CLEAR_NODE_ICON ? '' : value);
                  }}
                >
                  <option value={INHERIT_NODE_TYPE_ICON}>{selectedNodeType?.icon ? `沿用类型（${selectedNodeType.icon}）` : '沿用类型（无）'}</option>
                  <option value={CLEAR_NODE_ICON}>无图标</option>
                  {iconOptions.map((icon) => <option key={icon.value} value={icon.value}>{icon.label}</option>)}
                </select>
              </label>
                <label className="inspector-style-field">
                  <span>节点形状</span>
                  <select value={effectiveStyle.shape} aria-label="节点形状" onChange={(event) => onNodeStyleChange({ shape: event.target.value as MindmapNodeStyle['shape'] })}>
                    {NODE_TYPE_SHAPES.map((shape) => <option key={shape.value} value={shape.value}>{shape.label.replace(`${shape.value} `, '')}</option>)}
                  </select>
                </label>
              </div>

              <div className="inspector-style-appearance">
                <div className="inspector-style-color-group" role="group" aria-label="节点颜色">
                  <span className="inspector-style-sub-label">颜色</span>
                  <div className="inspector-style-color-swatches">
                    <ColorButton label="背景色" value={effectiveStyle.backgroundColor} onChange={(backgroundColor) => onNodeStyleChange({ backgroundColor })} />
                    <ColorButton label="边框色" value={effectiveStyle.borderColor} onChange={(borderColor) => onNodeStyleChange({ borderColor })} />
                    <ColorButton label="文字色" value={effectiveStyle.textColor} onChange={(textColor) => onNodeStyleChange({ textColor })} />
                  </div>
                </div>
                <div className="inspector-style-text-tools">
                  <label className="inspector-style-number-field">
                    <span>字号</span>
                    <input type="number" min={12} max={28} value={effectiveStyle.fontSize} aria-label="字号" onChange={(event) => onNodeStyleChange({ fontSize: Number(event.target.value) })} />
                  </label>
                  <button type="button" className={`inspector-style-compact-action${effectiveStyle.bold ? ' is-active' : ''}`} title="加粗" aria-label="加粗" aria-pressed={effectiveStyle.bold} onClick={() => onNodeStyleChange({ bold: !effectiveStyle.bold })}>
                    <strong aria-hidden="true">B</strong>
                    <span>加粗</span>
                  </button>
                </div>
              </div>

              <button type="button" className="inspector-style-reset" title="重置为类型默认样式" onClick={onResetNodeStyle}>
                <span aria-hidden="true">↺</span>
                重置为类型默认样式
              </button>
            </div>
          </section>
        ) : null}
        {activeTab === 'remark' ? (
          <RemarkPanel
            selectedNode={selectedNode}
            mode={remarkMode}
            onModeChange={onRemarkModeChange}
            onRemarkChange={onRemarkChange}
            activeMatch={activeRemarkMatch}
            focusRequestId={shouldFocusRemark ? remarkFocusRequest?.id : undefined}
            embedded
          />
        ) : null}
      </div>
    </aside>
  );
}
