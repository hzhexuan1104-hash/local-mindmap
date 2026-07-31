import { type CSSProperties, useEffect, useRef, useState } from 'react';
import {
  NODE_PRIORITY_VALUES,
  NODE_PROGRESS_VALUES,
} from '../../features/mindmap/nodeMarkers';
import type {
  MindmapNode,
  MindmapNodePriority,
  MindmapNodeProgress,
} from '../../features/mindmap/types';

type NodeQuickToolbarProps = {
  selectedNode: MindmapNode | null;
  hasSelection: boolean;
  onAddChild: () => void;
  onAddSibling: () => void;
  onAddParent: () => void;
  onOpenRemark: () => void;
  onSetPriority: (priority?: MindmapNodePriority) => void;
  onSetProgress: (progress?: MindmapNodeProgress) => void;
  onAddTag: (tag: string) => boolean;
  onRemoveTag: (tag: string) => void;
};

function ProgressIcon({ value }: { value: MindmapNodeProgress }) {
  return (
    <span
      className="quick-progress-icon"
      style={{ '--quick-progress': `${value}%` } as CSSProperties}
      aria-hidden="true"
    >
      {value === 100 ? '✓' : ''}
    </span>
  );
}

export function NodeQuickToolbar({
  selectedNode,
  hasSelection,
  onAddChild,
  onAddSibling,
  onAddParent,
  onOpenRemark,
  onSetPriority,
  onSetProgress,
  onAddTag,
  onRemoveTag,
}: NodeQuickToolbarProps) {
  const [isTagMenuOpen, setIsTagMenuOpen] = useState(false);
  const [tagDraft, setTagDraft] = useState('');
  const [isTagInputComposing, setIsTagInputComposing] = useState(false);
  const tagMenuRef = useRef<HTMLDivElement | null>(null);
  const tagInputRef = useRef<HTMLInputElement | null>(null);
  const tags = selectedNode?.tags ?? [];

  const closeTagMenu = () => {
    setIsTagMenuOpen(false);
    setTagDraft('');
    setIsTagInputComposing(false);
  };

  useEffect(() => {
    closeTagMenu();
  }, [selectedNode?.id]);

  useEffect(() => {
    if (!isTagMenuOpen) {
      return;
    }

    const focusFrame = window.requestAnimationFrame(() => tagInputRef.current?.focus());
    const handlePointerDown = (event: PointerEvent) => {
      if (!tagMenuRef.current?.contains(event.target as Node)) {
        closeTagMenu();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closeTagMenu();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isTagMenuOpen]);

  const addTag = () => {
    if (isTagInputComposing || !tagDraft.trim()) {
      return;
    }

    if (onAddTag(tagDraft)) {
      setTagDraft('');
    }
  };

  return (
    <section className="node-quick-toolbar" aria-label="节点快捷工具条">
      <div className="node-quick-toolbar-scroll">
        <div className="node-quick-toolbar-group" aria-label="主题结构">
          <span className="node-quick-toolbar-label">主题</span>
          <button type="button" disabled={!hasSelection} onClick={onAddChild} title="插入下级主题">
            <span aria-hidden="true">↳</span> 下级
          </button>
          <button type="button" disabled={!hasSelection} onClick={onAddSibling} title="插入同级主题">
            <span aria-hidden="true">↔</span> 同级
          </button>
          <button type="button" disabled={!hasSelection} onClick={onAddParent} title="插入上级主题">
            <span aria-hidden="true">↰</span> 上级
          </button>
        </div>

        <div className="node-quick-toolbar-group" aria-label="备注">
          <button
            type="button"
            disabled={!hasSelection}
            className={selectedNode?.remark.trim() ? 'has-value' : ''}
            onClick={onOpenRemark}
            title="在右侧备注面板中编辑"
          >
            <span aria-hidden="true">▤</span> 备注
          </button>
        </div>

        <div className="node-quick-toolbar-group" aria-label="优先级">
          <span className="node-quick-toolbar-label">优先级</span>
          <button
            type="button"
            className={!selectedNode?.priority ? 'is-selected' : ''}
            disabled={!hasSelection}
            onClick={() => onSetPriority()}
            title="清除优先级"
          >
            ∅
          </button>
          {NODE_PRIORITY_VALUES.map((priority) => (
            <button
              type="button"
              key={priority}
              className={
                selectedNode?.priority === priority
                  ? `is-selected priority-choice priority-choice--${priority}`
                  : `priority-choice priority-choice--${priority}`
              }
              disabled={!hasSelection}
              onClick={() => onSetPriority(priority)}
              title={`设置优先级 ${priority}`}
              aria-label={`设置优先级 ${priority}`}
            >
              {priority}
            </button>
          ))}
        </div>

        <div className="node-quick-toolbar-group" aria-label="完成度">
          <span className="node-quick-toolbar-label">完成度</span>
          <button
            type="button"
            className={selectedNode?.progress === undefined ? 'is-selected' : ''}
            disabled={!hasSelection}
            onClick={() => onSetProgress()}
            title="清除完成度"
          >
            ∅
          </button>
          {NODE_PROGRESS_VALUES.map((progress) => (
            <button
              type="button"
              key={progress}
              className={selectedNode?.progress === progress ? 'is-selected progress-choice' : 'progress-choice'}
              disabled={!hasSelection}
              onClick={() => onSetProgress(progress)}
              title={`设置完成度 ${progress}%`}
              aria-label={`设置完成度 ${progress}%`}
            >
              <ProgressIcon value={progress} />
              <span>{progress}%</span>
            </button>
          ))}
        </div>

        <div
          className="node-quick-toolbar-group node-tag-group"
          aria-label="标签"
          ref={tagMenuRef}
        >
          <button
            type="button"
            className="node-quick-toolbar-tag-trigger"
            disabled={!hasSelection}
            onClick={() => {
              if (isTagMenuOpen) {
                closeTagMenu();
              } else {
                setIsTagMenuOpen(true);
              }
            }}
            aria-expanded={isTagMenuOpen}
            aria-haspopup="dialog"
            title={tags.length ? `管理 ${tags.length} 个标签` : '添加标签'}
          >
            <span>标签</span>
            <span>{tags.length ? `${tags.length} 个` : '添加标签'}</span>
            <span aria-hidden="true">▾</span>
          </button>

          {isTagMenuOpen && selectedNode ? (
            <div className="node-tag-dropdown" role="dialog" aria-label="管理当前节点标签">
              <div className="node-tag-dropdown-heading">
                <strong>标签</strong>
                <span>{tags.length} 个</span>
              </div>
              <form
                className="node-tag-dropdown-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  addTag();
                }}
              >
                <input
                  ref={tagInputRef}
                  value={tagDraft}
                  maxLength={30}
                  placeholder="输入新标签…"
                  aria-label="输入新标签"
                  onCompositionStart={() => setIsTagInputComposing(true)}
                  onCompositionEnd={() => setIsTagInputComposing(false)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && event.nativeEvent.isComposing) {
                      event.preventDefault();
                    }
                  }}
                  onChange={(event) => setTagDraft(event.target.value)}
                />
                <button type="submit" disabled={!tagDraft.trim() || isTagInputComposing}>添加</button>
              </form>
              <div className="node-tag-dropdown-list" aria-label="已有标签">
                {tags.length ? (
                  tags.map((tag) => (
                    <div className="node-tag-dropdown-row" key={tag}>
                      <span title={tag}>{tag}</span>
                      <button
                        type="button"
                        onClick={() => onRemoveTag(tag)}
                        title={`删除标签：${tag}`}
                        aria-label={`删除标签：${tag}`}
                      >
                        ×
                      </button>
                    </div>
                  ))
                ) : (
                  <p>暂无标签</p>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
