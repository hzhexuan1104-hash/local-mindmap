import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { MarkdownPreview } from '../mindmap/MarkdownPreview';

export function FeedbackDialog({ title, content, markdown, children, onClose }: {
  title: string; content?: string; markdown?: boolean; children?: ReactNode; onClose: () => void;
}) {
  const ref = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const root = document.getElementById('root');
    const inert = root?.inert ?? false;
    if (root) root.inert = true;
    ref.current?.querySelector('button')?.focus();
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.isComposing) { event.preventDefault(); event.stopImmediatePropagation(); closeRef.current(); }
    };
    window.addEventListener('keydown', escape, true);
    return () => { if (root) root.inert = inert; window.removeEventListener('keydown', escape, true); previous?.focus(); };
  }, []);
  const dialog = <div className="remark-preview-backdrop" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={ref} className="remark-preview-dialog feedback-dialog" role="dialog" aria-modal="true" aria-label={title} onKeyDown={(event) => {
      event.stopPropagation();
      if (event.key !== 'Tab') return;
      const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]')).filter((item) => item.getClientRects().length > 0);
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}>
      <header className="remark-preview-dialog-header"><h2>{title}</h2><button type="button" className="secondary-action" onClick={onClose}>关闭</button></header>
      <div className="remark-preview-dialog-body">{markdown ? <MarkdownPreview content={content ?? ''} allowRemoteImages={false} /> : content ? <p style={{ whiteSpace: 'pre-wrap' }}>{content}</p> : null}{children}</div>
    </section>
  </div>;
  return typeof document === 'undefined' ? dialog : createPortal(dialog, document.body);
}
