import type { MindmapNode } from './types';
import { MarkdownPreview } from './MarkdownPreview';

type RemarkMode = 'edit' | 'preview';

type RemarkPanelProps = {
  selectedNode: MindmapNode;
  mode: RemarkMode;
  onModeChange: (mode: RemarkMode) => void;
  onRemarkChange: (remark: string) => void;
};

export function RemarkPanel({
  selectedNode,
  mode,
  onModeChange,
  onRemarkChange,
}: RemarkPanelProps) {
  return (
    <aside className="remark-panel" aria-labelledby="remark-panel-title">
      <div className="remark-panel-header">
        <div className="remark-title-block">
          <p className="eyebrow">Remark</p>
          <h2 id="remark-panel-title">{selectedNode.text}</h2>
        </div>
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
  );
}
