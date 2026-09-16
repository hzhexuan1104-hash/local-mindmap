import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  deriveSelectedNodeTags,
  getNodeTagApplicationState,
  NODE_PRIORITY_VALUES,
  NODE_PROGRESS_VALUES,
} from '../../features/mindmap/nodeMarkers';
import { ChevronIcon } from './ChevronIcon';
import type {
  MindmapNode,
  MindmapNodePriority,
  MindmapNodeProgress,
} from '../../features/mindmap/types';

type SelectValue<T extends string | number> = T | 'none' | 'mixed';

type NodeQuickToolbarProps = {
  selectedNode: MindmapNode | null;
  selectedNodes: MindmapNode[];
  hasSelection: boolean;
  priorityValue: SelectValue<MindmapNodePriority>;
  progressValue: SelectValue<MindmapNodeProgress>;
  availableTags: string[];
  onAddChild: () => void;
  onAddSibling: () => void;
  onAddParent: () => void;
  onOpenRemark: () => void;
  onSetPriority: (priority?: MindmapNodePriority) => void;
  onSetProgress: (progress?: MindmapNodeProgress) => void;
  onAddTag: (tag: string) => boolean;
  onRemoveTag: (tag: string) => void;
  onToggleTag: (tag: string) => void;
  styleToolbar?: ReactNode;
};

const PRIORITY_OPTION_ICONS = ['🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '🟤', '⚪', '⚫'] as const;
const PROGRESS_OPTION_ICONS: Record<MindmapNodeProgress, string> = {
  0: '○',
  25: '◔',
  50: '◑',
  75: '◕',
  100: '●',
};

const priorityOptionLabel = (value: MindmapNodePriority) =>
  `${PRIORITY_OPTION_ICONS[value - 1]} ${value}`;

const progressOptionLabel = (value: MindmapNodeProgress) =>
  `${PROGRESS_OPTION_ICONS[value]} ${value}%`;

function stringifySelectValue(value: SelectValue<number>) {
  return String(value);
}

export function getTagDropdownPosition(input: {
  toolbarLeft: number;
  toolbarTop: number;
  toolbarWidth: number;
  triggerRight: number;
  triggerBottom: number;
  menuWidth: number;
}) {
  const horizontalPadding = 8;
  return {
    left: Math.max(
      horizontalPadding,
      Math.min(
        input.triggerRight - input.toolbarLeft - input.menuWidth,
        input.toolbarWidth - input.menuWidth - horizontalPadding,
      ),
    ),
    top: input.triggerBottom - input.toolbarTop + 8,
  };
}

export function NodeQuickToolbar({
  selectedNode,
  selectedNodes,
  hasSelection,
  priorityValue,
  progressValue,
  availableTags,
  onAddChild,
  onAddSibling,
  onAddParent,
  onOpenRemark,
  onSetPriority,
  onSetProgress,
  onAddTag,
  onRemoveTag,
  onToggleTag,
  styleToolbar,
}: NodeQuickToolbarProps) {
  const [isTagMenuOpen, setIsTagMenuOpen] = useState(false);
  const [tagDraft, setTagDraft] = useState('');
  const [isTagInputComposing, setIsTagInputComposing] = useState(false);
  const toolbarRef = useRef<HTMLElement | null>(null);
  const toolbarScrollRef = useRef<HTMLDivElement | null>(null);
  const tagTriggerRef = useRef<HTMLDivElement | null>(null);
  const tagDropdownRef = useRef<HTMLDivElement | null>(null);
  const tagInputRef = useRef<HTMLInputElement | null>(null);
  const [tagMenuPosition, setTagMenuPosition] = useState({ left: 0, top: 0 });
  const tags = useMemo(
    () => deriveSelectedNodeTags(selectedNodes),
    [selectedNodes],
  );
  const tagStates = useMemo(
    () => new Map(
      availableTags.map((tag) => [
        tag,
        getNodeTagApplicationState(selectedNodes, tag),
      ]),
    ),
    [availableTags, selectedNodes],
  );

  const closeTagMenu = () => {
    setIsTagMenuOpen(false);
    setTagDraft('');
    setIsTagInputComposing(false);
  };

  useEffect(() => {
    closeTagMenu();
  }, [selectedNode?.id]);

  useEffect(() => {
    const closeFromCanvas = () => closeTagMenu();
    window.addEventListener('mindmap:close-transient-ui', closeFromCanvas);
    return () => window.removeEventListener('mindmap:close-transient-ui', closeFromCanvas);
  }, []);

  useEffect(() => {
    if (!isTagMenuOpen) return;
    const focusFrame = window.requestAnimationFrame(() => tagInputRef.current?.focus());
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !tagTriggerRef.current?.contains(target) &&
        !tagDropdownRef.current?.contains(target)
      ) {
        closeTagMenu();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      closeTagMenu();
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isTagMenuOpen]);

  useLayoutEffect(() => {
    if (!isTagMenuOpen) return;

    const updateTagMenuPosition = () => {
      const toolbar = toolbarRef.current;
      const trigger = tagTriggerRef.current;
      const dropdown = tagDropdownRef.current;
      if (!toolbar || !trigger || !dropdown) return;

      const toolbarRect = toolbar.getBoundingClientRect();
      const triggerRect = trigger.getBoundingClientRect();
      const position = getTagDropdownPosition({
        toolbarLeft: toolbarRect.left,
        toolbarTop: toolbarRect.top,
        toolbarWidth: toolbarRect.width,
        triggerRight: triggerRect.right,
        triggerBottom: triggerRect.bottom,
        menuWidth: dropdown.offsetWidth,
      });

      setTagMenuPosition((current) =>
        current.left === position.left && current.top === position.top
          ? current
          : position,
      );
    };

    updateTagMenuPosition();
    window.addEventListener('resize', updateTagMenuPosition);
    const scrollContainer = toolbarScrollRef.current;
    scrollContainer?.addEventListener('scroll', updateTagMenuPosition);
    return () => {
      window.removeEventListener('resize', updateTagMenuPosition);
      scrollContainer?.removeEventListener('scroll', updateTagMenuPosition);
    };
  }, [isTagMenuOpen]);

  const addTag = () => {
    if (isTagInputComposing || !tagDraft.trim()) return;
    if (onAddTag(tagDraft)) setTagDraft('');
  };

  return (
    <section className="node-quick-toolbar" aria-label="节点快捷工具栏" ref={toolbarRef}>
      <div
        ref={toolbarScrollRef}
        className={`node-quick-toolbar-scroll${styleToolbar ? ' has-node-style-toolbar' : ''}`}
      >
        <div className="node-quick-toolbar-group node-quick-toolbar-structure-actions" aria-label="主题结构">
          <button type="button" className="node-quick-toolbar-structure-action" disabled={!hasSelection} onClick={onAddChild} title="插入下级主题"><span className="node-quick-action-symbol" aria-hidden="true">↳</span><span>下级</span></button>
          <button type="button" className="node-quick-toolbar-structure-action" disabled={!hasSelection} onClick={onAddSibling} title="插入同级主题"><span className="node-quick-action-symbol" aria-hidden="true">↔</span><span>同级</span></button>
          <button type="button" className="node-quick-toolbar-structure-action" disabled={!hasSelection} onClick={onAddParent} title="插入上级主题"><span className="node-quick-action-symbol" aria-hidden="true">↰</span><span>上级</span></button>
        </div>

        <div className="node-quick-toolbar-group" aria-label="备注">
          <button
            type="button"
            className="node-quick-toolbar-remark-action"
            disabled={!hasSelection}
            onClick={onOpenRemark}
            aria-label="打开备注编辑"
            title="打开备注"
          >
            <span className="node-quick-action-symbol" aria-hidden="true">▤</span>
            <span>备注</span>
          </button>
        </div>

        <div className="node-quick-toolbar-group" aria-label="优先级">
          <label className="node-quick-select node-quick-select-priority" title="优先级">
            <span className="node-quick-select-label">优先级</span>
            <select
              value={stringifySelectValue(priorityValue)}
              disabled={!hasSelection}
              aria-label="设置优先级"
              onChange={(event) => {
                const value = event.target.value;
                if (value === 'mixed') return;
                onSetPriority(value === 'none' ? undefined : Number(value) as MindmapNodePriority);
              }}
            >
              {priorityValue === 'mixed' ? <option value="mixed">混合</option> : null}
              <option value="none">⚑ 无</option>
              {NODE_PRIORITY_VALUES.map((priority) => (
                <option key={priority} value={priority}>{priorityOptionLabel(priority)}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="node-quick-toolbar-group" aria-label="完成度">
          <label className="node-quick-select node-quick-select-progress" title="完成度">
            <span className="node-quick-select-label">完成度</span>
            <select
              value={stringifySelectValue(progressValue)}
              disabled={!hasSelection}
              aria-label="设置完成度"
              onChange={(event) => {
                const value = event.target.value;
                if (value === 'mixed') return;
                onSetProgress(value === 'none' ? undefined : Number(value) as MindmapNodeProgress);
              }}
            >
              {progressValue === 'mixed' ? <option value="mixed">混合</option> : null}
              <option value="none">◔ 无</option>
              {NODE_PROGRESS_VALUES.map((progress) => (
                <option key={progress} value={progress}>{progressOptionLabel(progress)}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="node-quick-toolbar-group node-tag-group" aria-label="标签" ref={tagTriggerRef}>
          <button
            type="button"
            className="node-quick-toolbar-tag-trigger"
            disabled={!hasSelection}
            onClick={() => setIsTagMenuOpen((open) => !open)}
            aria-expanded={isTagMenuOpen}
            aria-haspopup="dialog"
            title={tags.length ? `管理 ${tags.length} 个标签` : '添加标签'}
          >
            <span>标签</span>
            <span>{tags.length ? `${tags.length} 个` : '添加'}</span>
            <ChevronIcon direction={isTagMenuOpen ? 'up' : 'down'} />
          </button>

        </div>
        {styleToolbar ? <div className="node-quick-toolbar-style-slot">{styleToolbar}</div> : null}
      </div>
      {isTagMenuOpen && selectedNode ? (
        <div
          ref={tagDropdownRef}
          className="node-tag-dropdown"
          style={tagMenuPosition}
          role="dialog"
          aria-label="管理当前节点标签"
        >
          <div className="node-tag-dropdown-heading"><strong>当前标签</strong><span>{tags.length} 个</span></div>
          <div className="node-tag-dropdown-list" aria-label="当前节点标签">
            {tags.length ? tags.map((tag) => (
              <div className="node-tag-dropdown-row" key={tag}>
                <span title={tag}>{tag}</span>
                {selectedNodes.length > 1 ? (
                  <small className={`node-tag-application-state is-${tagStates.get(tag)}`}>
                    {tagStates.get(tag) === 'all' ? '已应用' : '部分应用'}
                  </small>
                ) : null}
                <button
                  type="button"
                  className="node-tag-remove"
                  onClick={() => onRemoveTag(tag)}
                  title={`删除标签：${tag}`}
                  aria-label={`删除标签：${tag}`}
                >
                  ×
                </button>
              </div>
            )) : <p>暂无标签</p>}
          </div>
          <div className="node-tag-dropdown-heading node-tag-dropdown-subheading"><strong>可复用标签</strong></div>
          <div className="node-tag-suggestions" aria-label="可复用标签">
            {availableTags.length ? availableTags.map((tag) => {
              const state = tagStates.get(tag) ?? 'none';
              return (
                <button
                  key={tag}
                  type="button"
                  className={`node-tag-suggestion is-${state}`}
                  aria-pressed={state === 'all'}
                  title={state === 'all' ? `移除标签：${tag}` : `应用标签：${tag}`}
                  onClick={() => onToggleTag(tag)}
                >
                  <span>{tag}</span>
                  <small>{state === 'all' ? '✓ 已应用 · 点击移除' : state === 'partial' ? '◐ 部分应用 · 点击应用' : '点击应用'}</small>
                </button>
              );
            }) : <p>暂无可复用标签</p>}
          </div>
          <form className="node-tag-dropdown-form" onSubmit={(event) => { event.preventDefault(); addTag(); }}>
            <input
              ref={tagInputRef}
              value={tagDraft}
              maxLength={30}
              placeholder="输入标签名称"
              aria-label="输入标签名称"
              onCompositionStart={() => setIsTagInputComposing(true)}
              onCompositionEnd={() => setIsTagInputComposing(false)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && event.nativeEvent.isComposing) event.preventDefault();
              }}
              onChange={(event) => setTagDraft(event.target.value)}
            />
            <button type="submit" disabled={!tagDraft.trim() || isTagInputComposing} aria-label="添加新增标签">+</button>
          </form>
        </div>
      ) : null}
    </section>
  );
}
