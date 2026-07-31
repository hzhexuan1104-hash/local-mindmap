import { useEffect, useState } from 'react';
import { RemarkPanel } from '../../features/mindmap/RemarkPanel';
import {
  NODE_TYPE_ICONS,
  NODE_TYPE_SHAPES,
} from '../../features/mindmap/nodeTypes';
import { getEffectiveNodeStyle } from '../../features/mindmap/nodeStyles';
import type { SearchMatch } from '../../features/mindmap/searchReplace';
import type {
  MindmapNode,
  MindmapNodeStyle,
  MindmapNodeType,
} from '../../features/mindmap/types';

type InspectorTab = 'style' | 'remark';

const INHERIT_NODE_TYPE_ICON = '__inherit-node-type-icon__';
const CLEAR_NODE_ICON = '__clear-node-icon__';

type NodeIconOption = {
  value: string;
  label: string;
};

export type RemarkFocusRequest = {
  id: number;
  nodeId: string;
};

type RightInspectorPanelProps = {
  selectedNode: MindmapNode;
  nodeTypes: MindmapNodeType[];
  nodeIcons?: ReadonlyArray<NodeIconOption>;
  remarkMode: 'edit' | 'preview';
  activeRemarkMatch: SearchMatch | null;
  remarkFocusRequest?: RemarkFocusRequest | null;
  onNodeStyleChange: (style: MindmapNodeStyle) => void;
  onNodeIconChange: (icon: string | undefined) => void;
  onSaveStyleAsNodeType: (name: string) => void;
  onResetNodeStyle: () => void;
  onRemarkModeChange: (mode: 'edit' | 'preview') => void;
  onRemarkChange: (remark: string) => void;
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
  nodeTypes,
  nodeIcons = NODE_TYPE_ICONS,
  remarkMode,
  activeRemarkMatch,
  remarkFocusRequest = null,
  onNodeStyleChange,
  onNodeIconChange,
  onSaveStyleAsNodeType,
  onResetNodeStyle,
  onRemarkModeChange,
  onRemarkChange,
  onCollapse,
}: RightInspectorPanelProps) {
  const [activeTab, setActiveTab] = useState<InspectorTab>('style');
  const [nodeTypeName, setNodeTypeName] = useState('');
  const selectedNodeType =
    nodeTypes.find((nodeType) => nodeType.id === selectedNode.nodeTypeId) ?? null;
  const effectiveStyle = getEffectiveNodeStyle(selectedNode, selectedNodeType);
  const selectedIcon = selectedNode.style?.icon;
  const selectedIconValue =
    selectedIcon === undefined
      ? INHERIT_NODE_TYPE_ICON
      : selectedIcon === ''
        ? CLEAR_NODE_ICON
        : selectedIcon;
  const iconOptions =
    selectedIcon && !nodeIcons.some((icon) => icon.value === selectedIcon)
      ? [
          { value: selectedIcon, label: `${selectedIcon} 当前图标` },
          ...nodeIcons,
        ]
      : nodeIcons;

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

  const shouldFocusRemark = remarkFocusRequest?.nodeId === selectedNode.id;

  useEffect(() => {
    if (shouldFocusRemark) {
      setActiveTab('remark');
    }
  }, [remarkFocusRequest?.id, shouldFocusRemark]);

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
          ] as const
        ).map(([tab, label]) => (
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
          >
            {label}
          </button>
        ))}
      </div>

      <div className="inspector-content">
        {activeTab === 'style' ? (
          <div className="inspector-section">
            <section className="inspector-control-group">
              <h3>当前节点样式</h3>
              <p className="control-help">下方样式默认只影响当前节点。</p>
              <div className="aligned-form node-style-form">
                <label>
                  <span>当前节点图标</span>
                  <select
                    aria-label="当前节点图标"
                    value={selectedIconValue}
                    onChange={(event) => {
                      const { value } = event.target;
                      onNodeIconChange(
                        value === INHERIT_NODE_TYPE_ICON
                          ? undefined
                          : value === CLEAR_NODE_ICON
                            ? ''
                            : value,
                      );
                    }}
                  >
                    <option value={INHERIT_NODE_TYPE_ICON}>
                      {selectedNodeType?.icon
                        ? `沿用节点类型默认（${selectedNodeType.icon}）`
                        : '沿用节点类型默认（无）'}
                    </option>
                    <option value={CLEAR_NODE_ICON}>无图标</option>
                    {iconOptions.map((icon) => (
                      <option key={icon.value} value={icon.value}>
                        {icon.label}
                      </option>
                    ))}
                  </select>
                </label>
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
                  className="ghost-action"
                  onClick={onResetNodeStyle}
                >
                  重置为节点类型默认样式
                </button>
              </div>
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
            focusRequestId={
              shouldFocusRemark ? remarkFocusRequest?.id : undefined
            }
            embedded
          />
        ) : null}
      </div>
    </aside>
  );
}
