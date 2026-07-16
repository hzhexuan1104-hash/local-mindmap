import { useEffect, useRef, useState } from 'react';
import { MarkdownPreview } from './MarkdownPreview';
import { RemarkPreviewDialog } from './remarkPreview';
import {
  getRemarkEditorValue,
  shouldPersistRemarkEditorValue,
  shouldShowVirtualRemarkTemplate,
} from './remarkTemplate';
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
  activeMatch?: SearchMatch | null;
  isVirtualTemplateDismissed?: boolean;
  onDismissVirtualTemplate?: () => void;
};

export function RemarkPanel({
  selectedNode,
  mode,
  onModeChange,
  onRemarkChange,
  onCollapse,
  embedded = false,
  activeMatch = null,
  isVirtualTemplateDismissed = false,
  onDismissVirtualTemplate,
}: RemarkPanelProps) {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const remarkMatch =
    activeMatch?.field === 'remark' && activeMatch.nodeId === selectedNode.id
      ? activeMatch
      : null;
  const contextStart = remarkMatch
    ? Math.max(0, remarkMatch.start - 24)
    : 0;
  const contextEnd = remarkMatch
    ? Math.min(selectedNode.remark.length, remarkMatch.end + 24)
    : 0;
  const isVirtualTemplateVisible = shouldShowVirtualRemarkTemplate(
    selectedNode.remark,
    isVirtualTemplateDismissed,
  );
  const editorValue = getRemarkEditorValue(
    selectedNode.remark,
    isVirtualTemplateVisible,
  );

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

  return (
    <>
      <section
        className={embedded ? 'remark-panel is-embedded' : 'remark-panel'}
        aria-labelledby="remark-panel-title"
      >
        <div className="remark-panel-header">
          {!embedded ? (
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
          ) : null}

          <div className="remark-panel-actions">
            <button
              type="button"
              className="secondary-action"
              onClick={() => setIsPreviewOpen(true)}
            >
              放大预览
            </button>
            <div className="remark-mode-switch" aria-label="备注显示模式">
              <button
                type="button"
                className={`mode-button${mode === 'edit' ? ' is-active' : ''}`}
                onClick={() => onModeChange('edit')}
              >
                编辑模式
              </button>
              <button
                type="button"
                className={`mode-button${mode === 'preview' ? ' is-active' : ''}`}
                onClick={() => onModeChange('preview')}
              >
                预览模式
              </button>
            </div>
          </div>

          <h2 id="remark-panel-title">{selectedNode.text}</h2>
        </div>

        {mode === 'edit' ? (
          <div className="remark-edit-layout">
            {remarkMatch ? (
              <div className="remark-search-context" role="status">
                <span>{contextStart > 0 ? '…' : ''}</span>
                {selectedNode.remark.slice(contextStart, remarkMatch.start)}
                <mark>
                  {selectedNode.remark.slice(remarkMatch.start, remarkMatch.end)}
                </mark>
                {selectedNode.remark.slice(remarkMatch.end, contextEnd)}
                <span>{contextEnd < selectedNode.remark.length ? '…' : ''}</span>
              </div>
            ) : null}
            <textarea
              ref={editorRef}
              className={
                isVirtualTemplateVisible
                  ? 'remark-editor is-virtual-template'
                  : 'remark-editor'
              }
              value={editorValue}
              onChange={(event) => {
                const nextRemark = event.target.value;
                if (isVirtualTemplateVisible) {
                  onDismissVirtualTemplate?.();
                }
                if (
                  shouldPersistRemarkEditorValue(
                    nextRemark,
                    isVirtualTemplateVisible,
                  )
                ) {
                  onRemarkChange(nextRemark);
                }
              }}
              aria-label={`${selectedNode.text} 的 Markdown 备注`}
              title={
                isVirtualTemplateVisible
                  ? '示例内容不会保存；修改或删除后才会写入备注。'
                  : undefined
              }
            />
          </div>
        ) : (
          <MarkdownPreview content={selectedNode.remark} />
        )}
      </section>

      {isPreviewOpen ? (
        <RemarkPreviewDialog
          title={selectedNode.text}
          content={selectedNode.remark}
          onClose={() => setIsPreviewOpen(false)}
        />
      ) : null}
    </>
  );
}
