import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { MarkdownPreview } from './MarkdownPreview';
import type { MindmapNode } from './types';

type RemarkPreviewDialogProps = {
  title: string;
  content: string;
  onClose: () => void;
  nodeId?: string;
  siblings?: MindmapNode[];
  onNavigate?: (nodeId: string) => void;
};

export function RemarkPreviewDialog({
  title,
  content,
  onClose,
  nodeId,
  siblings = [],
  onNavigate,
}: RemarkPreviewDialogProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const index = siblings.findIndex((node) => node.id === nodeId);
  const previous = siblings[index - 1];
  const next = index >= 0 ? siblings[index + 1] : undefined;

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [nodeId]);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const root = document.getElementById('root');
    const wasInert = root?.inert ?? false;
    if (root) root.inert = true;
    dialogRef.current?.querySelector<HTMLButtonElement>('[data-preview-close]')?.focus();
    window.dispatchEvent(new Event('mindmap:close-transient-ui'));
    return () => {
      if (root) root.inert = wasInert;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.isComposing) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      onClose();
    };

    window.addEventListener('keydown', handleEscape, true);
    return () => window.removeEventListener('keydown', handleEscape, true);
  }, [onClose]);

  const dialog = (
    <div className="remark-preview-backdrop" role="presentation">
      <section
        ref={dialogRef}
        className="remark-preview-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="remark-preview-title"
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key !== 'Tab') return;
          const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], [tabindex="0"]'));
          const first = buttons[0];
          const last = buttons[buttons.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault(); last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault(); first?.focus();
          }
        }}
      >
        <header className="remark-preview-dialog-header">
          <div>
            <p className="eyebrow">节点内容</p>
            <h2 id="remark-preview-title">{title}</h2>
          </div>
          <button type="button" data-preview-close className="secondary-action" onClick={onClose}>
            关闭
          </button>
        </header>
        <div ref={bodyRef} className="remark-preview-dialog-body">
          <p className="remark-preview-section-label">备注内容</p>
          <MarkdownPreview key={nodeId} content={content} />
        </div>
        <nav className="remark-preview-navigation" aria-label="同级节点备注切换">
          <button type="button" className="secondary-action" disabled={!previous || !onNavigate} onClick={() => previous && onNavigate?.(previous.id)} aria-label="上一个同级节点备注">‹ 上一个</button>
          <span>{index >= 0 ? `${index + 1} / ${siblings.length}` : '当前节点'}</span>
          <button type="button" className="secondary-action" disabled={!next || !onNavigate} onClick={() => next && onNavigate?.(next.id)} aria-label="下一个同级节点备注">下一个 ›</button>
        </nav>
      </section>
    </div>
  );
  return typeof document === 'undefined' ? dialog : createPortal(dialog, document.body);
}
