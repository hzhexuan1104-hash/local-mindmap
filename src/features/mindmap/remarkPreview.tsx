import { MarkdownPreview } from './MarkdownPreview';

type RemarkPreviewDialogProps = {
  title: string;
  content: string;
  onClose: () => void;
};

export function RemarkPreviewDialog({
  title,
  content,
  onClose,
}: RemarkPreviewDialogProps) {
  return (
    <div className="remark-preview-backdrop" role="presentation">
      <section
        className="remark-preview-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="remark-preview-title"
      >
        <header className="remark-preview-dialog-header">
          <div>
            <p className="eyebrow">Markdown Preview</p>
            <h2 id="remark-preview-title">{title}</h2>
          </div>
          <button type="button" className="secondary-action" onClick={onClose}>
            关闭
          </button>
        </header>
        <div className="remark-preview-dialog-body">
          <MarkdownPreview content={content} />
        </div>
      </section>
    </div>
  );
}
