import type { MindmapNode } from './types';
import { MarkdownPreview } from './MarkdownPreview';
import { RemarkPreviewDialog } from './remarkPreview';
import { useState } from 'react';

type RemarkMode = 'edit' | 'preview';

type RemarkPanelProps = {
  selectedNode: MindmapNode;
  mode: RemarkMode;
  onModeChange: (mode: RemarkMode) => void;
  onRemarkChange: (remark: string) => void;
  onCollapse: () => void;
};

export function RemarkPanel({
  selectedNode,
  mode,
  onModeChange,
  onRemarkChange,
  onCollapse,
}: RemarkPanelProps) {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  return (
    <>
      <aside className="remark-panel" aria-labelledby="remark-panel-title">
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
              ›
            </button>
          </div>
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
            <textarea
              className="remark-editor"
              value={selectedNode.remark}
              onChange={(event) => onRemarkChange(event.target.value)}
              aria-label={`${selectedNode.text} 的 Markdown 备注`}
            />
            <div className="remark-live-preview">
              <div className="remark-live-preview-title">实时预览</div>
              <MarkdownPreview content={selectedNode.remark} />
            </div>
          </div>
        ) : (
          <MarkdownPreview content={selectedNode.remark} />
        )}
      </aside>

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
