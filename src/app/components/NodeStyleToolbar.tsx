import { useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import {
  DEFAULT_NODE_STYLE,
  getEffectiveNodeIcon,
  getEffectiveNodeStyle,
  type EffectiveNodeStyle,
} from '../../features/mindmap/nodeStyles';
import { NODE_TYPE_ICONS } from '../../features/mindmap/nodeTypes';
import type { MindmapNode, MindmapNodeStyle, MindmapNodeType } from '../../features/mindmap/types';

const CLEAR_NODE_ICON = '__clear-node-icon__';
const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28] as const;
const COLOR_FIELDS = [
  { key: 'backgroundColor', label: '背景色', caption: '填充' },
  { key: 'borderColor', label: '边框色', caption: '边框' },
  { key: 'textColor', label: '文字色', caption: '文字' },
] as const;
type ColorField = (typeof COLOR_FIELDS)[number];

const COLOR_PRESETS = [
  ['白色', '#FFFFFF'], ['雾灰', '#E2E8F0'], ['浅蓝', '#DBEAFE'], ['浅青', '#CCFBF1'],
  ['浅绿', '#DCFCE7'], ['浅黄', '#FEF3C7'], ['浅粉', '#FCE7F3'], ['浅紫', '#EDE9FE'],
  ['墨黑', '#172033'], ['石灰', '#64748B'], ['海蓝', '#2563EB'], ['深青', '#0F766E'],
  ['松绿', '#15803D'], ['琥珀', '#B45309'], ['玫红', '#BE185D'], ['鸢紫', '#6D28D9'],
] as const;

type NodeIconOption = { value: string; label: string };

type NodeStyleToolbarProps = {
  selectedNode: MindmapNode | null;
  selectedNodeCount: number;
  isRoot: boolean;
  nodeTypes: MindmapNodeType[];
  nodeIcons?: ReadonlyArray<NodeIconOption>;
  onNodeStyleChange: (style: MindmapNodeStyle) => void;
  onNodeIconChange: (icon: string | null) => void;
  onResetNodeStyle: () => void;
  embedded?: boolean;
};

function ColorFieldIcon({ field }: { field: ColorField['key'] }) {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {field === 'backgroundColor' && <path d="M5 2.3 10.5 7.8 6.5 11.8a1 1 0 0 1-1.4 0L2.7 9.4a1 1 0 0 1 0-1.4l4.2-4.2M3 8h7M12.3 8.7c.6 1 1.7 2.2 1.7 3a1.7 1.7 0 0 1-3.4 0c0-.8 1.1-2 1.7-3Z" />}
      {field === 'borderColor' && <rect x="3" y="3" width="10" height="10" rx="1.5" />}
      {field === 'textColor' && <path d="m3.5 12 4.5-8 4.5 8M5.2 9h5.6" />}
    </svg>
  );
}

function NodeColorControls({
  effectiveStyle,
  disabled,
  onChange,
}: {
  effectiveStyle: EffectiveNodeStyle;
  disabled: boolean;
  onChange: (style: MindmapNodeStyle) => void;
}) {
  const id = useId();
  const groupRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<{
    field: ColorField;
    anchor: HTMLButtonElement;
  } | null>(null);
  const active = disabled ? null : open;
  const value = active ? effectiveStyle[active.field.key].toUpperCase() : '';

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!active || !panel) return;
    const { anchor } = active;
    const scrollArea = anchor.closest('.node-quick-toolbar-scroll') ?? anchor.closest('.node-style-toolbar-controls');
    const position = () => {
      const rect = anchor.getBoundingClientRect();
      const row = scrollArea?.getBoundingClientRect();
      if (rect.right <= (row?.left ?? 0) || rect.left >= (row?.right ?? window.innerWidth)) {
        setOpen(null);
        return;
      }
      const gap = 8;
      const group = groupRef.current?.getBoundingClientRect() ?? rect;
      const centeredLeft = group.left + (group.width - panel.offsetWidth) / 2;
      const left = Math.max(gap, Math.min(centeredLeft, window.innerWidth - panel.offsetWidth - gap));
      const top = Math.min(rect.bottom + gap, window.innerHeight - panel.offsetHeight - gap);
      panel.style.left = `${left}px`;
      panel.style.top = `${Math.max(gap, top)}px`;
    };
    const dismissOutside = (event: Event) => {
      if (event.target instanceof Node && !groupRef.current?.contains(event.target) && !panel.contains(event.target)) {
        setOpen(null);
      }
    };
    const close = () => setOpen(null);

    position();
    (panel.querySelector<HTMLButtonElement>('.node-color-preset[aria-pressed="true"]')
      ?? panel.querySelector<HTMLButtonElement>('.node-color-preset'))?.focus({ preventScroll: true });
    document.addEventListener('pointerdown', dismissOutside, true);
    document.addEventListener('focusin', dismissOutside);
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    window.addEventListener('mindmap:close-transient-ui', close);
    return () => {
      document.removeEventListener('pointerdown', dismissOutside, true);
      document.removeEventListener('focusin', dismissOutside);
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
      window.removeEventListener('mindmap:close-transient-ui', close);
    };
  }, [active]);

  const closeAndRestoreFocus = () => {
    setOpen(null);
    active?.anchor.focus({ preventScroll: true });
  };

  return (
    <div ref={groupRef} className="node-style-toolbar-colors" role="group" aria-label="节点颜色">
      {COLOR_FIELDS.map((field) => {
        const expanded = active?.field === field;
        return (
          <button
            key={field.key}
            className="node-style-toolbar-color"
            type="button"
            title={field.label}
            aria-label={field.label}
            aria-haspopup="dialog"
            aria-expanded={expanded}
            aria-controls={expanded ? id : undefined}
            disabled={disabled}
            style={{ '--node-style-color': effectiveStyle[field.key] } as CSSProperties}
            onClick={(event) => setOpen(expanded ? null : { field, anchor: event.currentTarget })}
          >
            <span className="node-style-toolbar-color-icon" aria-hidden="true"><ColorFieldIcon field={field.key} /></span>
            <span>{field.caption}</span>
          </button>
        );
      })}
      {active && createPortal(
        <div
          id={id}
          ref={panelRef}
          className="node-color-panel"
          role="dialog"
          aria-labelledby={`${id}-title`}
          onKeyDown={(event) => {
            const target = event.target;
            if (event.key === 'Escape' || (event.key === 'Tab' && (
              event.shiftKey ? target === panelRef.current?.querySelector('button') : target instanceof HTMLInputElement
            ))) {
              event.preventDefault();
              event.stopPropagation();
              closeAndRestoreFocus();
            }
          }}
        >
          <div className="node-color-panel-header">
            <span className="node-color-panel-heading" id={`${id}-title`}>
              <ColorFieldIcon field={active.field.key} />{active.field.label}
            </span>
            <span className="node-color-current" aria-label={`当前颜色 ${value}`}>
              <span style={{ backgroundColor: effectiveStyle[active.field.key] }} aria-hidden="true" />
              <code>{value}</code>
            </span>
          </div>
          <div className="node-color-presets" role="group" aria-label="常用颜色">
            {COLOR_PRESETS.map(([name, color]) => (
              <button
                key={color}
                className="node-color-preset"
                type="button"
                aria-pressed={value === color}
                aria-label={`${name} ${color}`}
                title={`${name} ${color}`}
                style={{ '--node-style-color': color } as CSSProperties}
                onClick={() => {
                  onChange({ [active.field.key]: color });
                  closeAndRestoreFocus();
                }}
              >
                {value === color && <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="m4 8 2.6 2.6L12 5.2" /></svg>}
              </button>
            ))}
          </div>
          <label className="node-color-custom">
            <span className="node-color-custom-icon" aria-hidden="true" />
            自定义颜色
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="m6 4 4 4-4 4" /></svg>
            <input
              type="color"
              aria-label={`自定义${active.field.label}`}
              value={/^#[\da-f]{6}$/i.test(value) ? value : '#000000'}
              onChange={(event) => onChange({ [active.field.key]: event.target.value.toUpperCase() })}
            />
          </label>
        </div>,
        document.body,
      )}
    </div>
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
  const effectiveIcon = selectedNode
    ? getEffectiveNodeIcon(selectedNode, selectedNodeType)
    : '';
  const selectedIconValue = effectiveIcon || CLEAR_NODE_ICON;
  const iconOptions = effectiveIcon && !nodeIcons.some((icon) => icon.value === effectiveIcon)
    ? [{ value: effectiveIcon, label: `${effectiveIcon} 当前图标` }, ...nodeIcons]
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
            onNodeIconChange(value === CLEAR_NODE_ICON ? null : value);
          }}
        >
          <option value={CLEAR_NODE_ICON}>无图标</option>
          {iconOptions.map((icon) => <option key={icon.value} value={icon.value}>{icon.label}</option>)}
        </select>

        <NodeColorControls key={selectedNode?.id} effectiveStyle={effectiveStyle} disabled={disabled} onChange={onNodeStyleChange} />

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
