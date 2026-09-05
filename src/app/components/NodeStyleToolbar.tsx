import type { CSSProperties } from 'react';
import { DEFAULT_NODE_STYLE, getEffectiveNodeStyle } from '../../features/mindmap/nodeStyles';
import { NODE_TYPE_ICONS, NODE_TYPE_SHAPES } from '../../features/mindmap/nodeTypes';
import type { MindmapNode, MindmapNodeStyle, MindmapNodeType } from '../../features/mindmap/types';

const INHERIT_NODE_TYPE_ICON = '__inherit-node-type-icon__';
const CLEAR_NODE_ICON = '__clear-node-icon__';
const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28] as const;

type NodeIconOption = { value: string; label: string };

type NodeStyleToolbarProps = {
  selectedNode: MindmapNode | null;
  selectedNodeCount: number;
  isRoot: boolean;
  nodeTypes: MindmapNodeType[];
  nodeIcons?: ReadonlyArray<NodeIconOption>;
  onNodeStyleChange: (style: MindmapNodeStyle) => void;
  onNodeIconChange: (icon: string | undefined) => void;
  onResetNodeStyle: () => void;
  embedded?: boolean;
};

function ColorControl({
  label,
  symbol,
  value,
  disabled,
  onChange,
}: {
  label: string;
  symbol: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label
      className={`node-style-toolbar-color${disabled ? ' is-disabled' : ''}`}
      title={label}
      style={{ '--node-style-color': value } as CSSProperties}
    >
      <span aria-hidden="true">{symbol}</span>
      <span className="sr-only">{label}</span>
      <input
        type="color"
        value={value}
        aria-label={label}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value.toUpperCase())}
      />
    </label>
  );
}

export function NodeStyleToolbar({
  selectedNode,
  selectedNodeCount,
  isRoot,
  nodeTypes,
  nodeIcons = NODE_TYPE_ICONS,
  onNodeStyleChange,
  onNodeIconChange,
  onResetNodeStyle,
  embedded = false,
}: NodeStyleToolbarProps) {
  const disabled = !selectedNode;
  const selectedNodeType = selectedNode
    ? nodeTypes.find((nodeType) => nodeType.id === selectedNode.nodeTypeId) ?? null
    : null;
  const effectiveStyle = selectedNode
    ? getEffectiveNodeStyle(selectedNode, selectedNodeType, isRoot)
    : DEFAULT_NODE_STYLE;
  const selectedIcon = selectedNode?.style?.icon;
  const selectedIconValue = selectedIcon === undefined
    ? INHERIT_NODE_TYPE_ICON
    : selectedIcon === '' ? CLEAR_NODE_ICON : selectedIcon;
  const iconOptions = selectedIcon && !nodeIcons.some((icon) => icon.value === selectedIcon)
    ? [{ value: selectedIcon, label: `${selectedIcon} 当前图标` }, ...nodeIcons]
    : nodeIcons;
  const fontSizeOptions = FONT_SIZES.includes(effectiveStyle.fontSize as (typeof FONT_SIZES)[number])
    ? FONT_SIZES
    : [...FONT_SIZES, effectiveStyle.fontSize].sort((left, right) => left - right);

  return (
    <section
      className={`node-style-toolbar${embedded ? ' is-embedded' : ''}`}
      aria-label="节点样式快速工具区"
      onPointerDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
    >
      <div className="node-style-toolbar-controls">
        <select
          className="node-style-toolbar-icon-select"
          aria-label="节点图标"
          title="节点图标"
          disabled={disabled}
          value={selectedIconValue}
          onChange={(event) => {
            const value = event.target.value;
            onNodeIconChange(value === INHERIT_NODE_TYPE_ICON ? undefined : value === CLEAR_NODE_ICON ? '' : value);
          }}
        >
          <option value={INHERIT_NODE_TYPE_ICON}>{selectedNodeType?.icon ? `类型 ${selectedNodeType.icon}` : '沿用类型'}</option>
          <option value={CLEAR_NODE_ICON}>无图标</option>
          {iconOptions.map((icon) => <option key={icon.value} value={icon.value}>{icon.label}</option>)}
        </select>

        <select
          aria-label="节点形状"
          title="节点形状"
          disabled={disabled}
          value={effectiveStyle.shape}
          onChange={(event) => onNodeStyleChange({ shape: event.target.value as MindmapNodeStyle['shape'] })}
        >
          {NODE_TYPE_SHAPES.map((shape) => <option key={shape.value} value={shape.value}>{shape.label.replace(`${shape.value} `, '')}</option>)}
        </select>

        <div className="node-style-toolbar-colors" role="group" aria-label="节点颜色">
          <ColorControl label="背景色" symbol="●" value={effectiveStyle.backgroundColor} disabled={disabled} onChange={(backgroundColor) => onNodeStyleChange({ backgroundColor })} />
          <ColorControl label="边框色" symbol="□" value={effectiveStyle.borderColor} disabled={disabled} onChange={(borderColor) => onNodeStyleChange({ borderColor })} />
          <ColorControl label="文字色" symbol="A" value={effectiveStyle.textColor} disabled={disabled} onChange={(textColor) => onNodeStyleChange({ textColor })} />
        </div>

        <select
          aria-label="字号"
          title="字号"
          disabled={disabled}
          value={effectiveStyle.fontSize}
          onChange={(event) => onNodeStyleChange({ fontSize: Number(event.target.value) })}
        >
          {fontSizeOptions.map((fontSize) => <option key={fontSize} value={fontSize}>{fontSize}px</option>)}
        </select>

        <button
          type="button"
          className={`node-style-toolbar-button${effectiveStyle.bold ? ' is-active' : ''}`}
          title="加粗"
          aria-label="加粗"
          aria-pressed={effectiveStyle.bold}
          disabled={disabled}
          onClick={() => onNodeStyleChange({ bold: !effectiveStyle.bold })}
        >
          <strong aria-hidden="true">B</strong>
        </button>
        <button
          type="button"
          className="node-style-toolbar-button"
          title="重置为节点类型默认样式"
          aria-label="重置为节点类型默认样式"
          disabled={disabled}
          onClick={onResetNodeStyle}
        >
          <span aria-hidden="true">↺</span>
        </button>
      </div>
      <span className="sr-only">
        {disabled ? '未选中节点，样式工具不可用' : selectedNodeCount > 1 ? `将应用到 ${selectedNodeCount} 个节点` : '应用到当前节点'}
      </span>
    </section>
  );
}
