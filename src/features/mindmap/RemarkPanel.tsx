import { useEffect, useRef, useState } from 'react';
import { MarkdownPreview } from './MarkdownPreview';
import { RemarkPreviewDialog } from './remarkPreview';
import type { SearchMatch } from './searchReplace';
import type { MindmapNode } from './types';

type RemarkMode = 'edit' | 'preview';

type RemarkPanelProps = {
  selectedNode: MindmapNode;
  mode: RemarkMode;
  onModeChange: (mode: RemarkMode) => void;
  onRemarkChange: (remark: string) => void;
  onCollapse?: () => void;
  embedded?: boolean;
  embeddedTitle?: string;
  activeMatch?: SearchMatch | null;
  focusRequestId?: number;
  siblings?: MindmapNode[];
  onNavigate?: (nodeId: string) => void;
};

type RemarkActionIconName = 'edit' | 'preview' | 'expand' | 'collapse';

function RemarkActionIcon({ name }: { name: RemarkActionIconName }) {
  if (name === 'edit') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m4 16.5-.8 4.3 4.3-.8L18.4 9.1 14.9 5.6 4 16.5Z" />
        <path d="m13.8 6.7 3.5 3.5" />
      </svg>
    );
  }

  if (name === 'preview') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M2.5 12s3.3-5.5 9.5-5.5S21.5 12 21.5 12 18.2 17.5 12 17.5 2.5 12 2.5 12Z" />
        <circle cx="12" cy="12" r="2.5" />
      </svg>
    );
  }

  if (name === 'collapse') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m14.5 5.5-6.5 6.5 6.5 6.5" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="5.5" />
      <path d="m15 15 5 5" />
    </svg>
  );
}

export function RemarkPanel({
  selectedNode,
  mode,
  onModeChange,
  onRemarkChange,
  onCollapse,
  embedded = false,
  embeddedTitle,
  activeMatch = null,
  focusRequestId,
  siblings,
  onNavigate,
}: RemarkPanelProps) {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const remarkMatch =
    activeMatch?.field === 'remark' && activeMatch.nodeId === selectedNode.id
      ? activeMatch
      : null;
  const panelTitle = embeddedTitle?.trim() || selectedNode.text.trim() || '未命名节点';

  useEffect(() => {
    if (!remarkMatch || mode !== 'edit') {
      return;
    }

    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    editor.focus();
    editor.setSelectionRange(remarkMatch.start, remarkMatch.end);
  }, [
    remarkMatch?.end,
    remarkMatch?.start,
    mode,
    selectedNode.id,
  ]);

  useEffect(() => {
    if (!focusRequestId || mode !== 'edit') {
      return;
    }

    const focusFrame = window.requestAnimationFrame(() => {
      const editor = editorRef.current;
      if (!editor || editor.disabled) {
        return;
      }

      editor.focus();
      const cursorPosition = editor.value.length;
      editor.setSelectionRange(cursorPosition, cursorPosition);
    });

    return () => window.cancelAnimationFrame(focusFrame);
  }, [focusRequestId, mode, selectedNode.id]);

  return (
    <>
      <section
        className={embedded ? 'remark-panel is-embedded' : 'remark-panel'}
        aria-label="备注"
      >
        {!embedded ? (
          <div className="remark-panel-header">
            <div className="remark-header-top">
              <p className="eyebrow">Remark</p>
              <button
                type="button"
                className="remark-collapse-button secondary-action"
                onClick={onCollapse}
                aria-label="收起备注面板"
                title="收起备注"
              >
                &rsaquo;
              </button>
            </div>
          </div>
        ) : null}

        <header className="remark-section-header">
          {embedded ? (
            <h2 className="remark-node-title" title={panelTitle}>
              {panelTitle}
            </h2>
          ) : <span>备注</span>}
          <div className="remark-inline-actions" role="toolbar" aria-label="备注工具">
            <button
              type="button"
              className={`remark-inline-action${mode === 'edit' ? ' is-active' : ''}`}
              onClick={() => onModeChange('edit')}
              aria-label="编辑备注"
              aria-pressed={mode === 'edit'}
              title="编辑备注"
            >
              <RemarkActionIcon name="edit" />
              <span className="sr-only">编辑备注</span>
            </button>
            <button
              type="button"
              className={`remark-inline-action${mode === 'preview' ? ' is-active' : ''}`}
              onClick={() => onModeChange('preview')}
              aria-label="预览备注"
              aria-pressed={mode === 'preview'}
              title="预览备注"
            >
              <RemarkActionIcon name="preview" />
              <span className="sr-only">预览备注</span>
            </button>
            <span className="remark-inline-action-divider" aria-hidden="true" />
            <button
              type="button"
              className="remark-inline-action"
              onClick={() => setIsPreviewOpen(true)}
              aria-label="放大备注"
              title="放大备注"
            >
              <RemarkActionIcon name="expand" />
              <span className="sr-only">放大备注</span>
            </button>
            {embedded && onCollapse ? (
              <>
                <span className="remark-inline-action-divider" aria-hidden="true" />
                <button
                  type="button"
                  className="remark-inline-action"
                  onClick={onCollapse}
                  aria-label="隐藏备注面板"
                  title="隐藏备注面板"
                >
                  <RemarkActionIcon name="collapse" />
                  <span className="sr-only">隐藏备注面板</span>
                </button>
              </>
            ) : null}
          </div>
        </header>

        <div className={`remark-content-frame is-${mode}`}>
          {mode === 'edit' ? (
            <div className="remark-edit-layout">
              <textarea
                ref={editorRef}
                className="remark-editor"
                value={selectedNode.remark}
                data-search-match-active={remarkMatch ? 'true' : undefined}
                onChange={(event) => onRemarkChange(event.target.value)}
                aria-label="Markdown 备注"
              />
            </div>
          ) : (
            <MarkdownPreview content={selectedNode.remark} />
          )}
        </div>
      </section>

      {isPreviewOpen ? (
        <RemarkPreviewDialog
          title={selectedNode.text}
          content={selectedNode.remark}
          nodeId={selectedNode.id}
          siblings={siblings}
          onNavigate={onNavigate}
          onClose={() => setIsPreviewOpen(false)}
        />
      ) : null}
    </>
  );
}
