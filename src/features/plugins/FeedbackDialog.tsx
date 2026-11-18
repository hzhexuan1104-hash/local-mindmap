import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { MarkdownPreview } from '../mindmap/MarkdownPreview';
import type { ScriptShowMessageAction } from './pluginScriptActions';

const messageLabels = { info: '信息', warning: '提醒', error: '错误' };

export function FeedbackDialog({ title, subtitle, content, markdown, messages, wide, children, onClose }: {
  title: string;
  subtitle?: string;
  content?: string;
  markdown?: boolean;
  messages?: ScriptShowMessageAction[];
  wide?: boolean;
  children?: ReactNode;
  onClose: () => void;
}) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const subtitleId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const root = document.getElementById('root');
    const inert = root?.inert ?? false;
    if (root) root.inert = true;
    closeButton.current?.focus();
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.isComposing) { event.preventDefault(); event.stopImmediatePropagation(); closeRef.current(); }
    };
    window.addEventListener('keydown', escape, true);
    return () => { if (root) root.inert = inert; window.removeEventListener('keydown', escape, true); previous?.focus(); };
  }, []);
  const variant = messages ? 'compact' : markdown || wide ? 'wide' : children ? 'regular' : 'compact';
  const dialog = <div className="remark-preview-backdrop feedback-backdrop" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className={`feedback-dialog feedback-dialog--${variant}`} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={subtitle ? subtitleId : undefined} onKeyDown={(event) => {
      event.stopPropagation();
      if (event.key !== 'Tab') return;
      const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button, input, select, textarea, a[href], summary, [tabindex]'))
        .filter((item) => item.tabIndex >= 0 && !item.matches(':disabled') && item.getClientRects().length > 0);
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}>
      <header className="feedback-dialog-header">
        <div className="feedback-dialog-heading">
          <h2 id={titleId}>{title}</h2>
          {subtitle ? <p id={subtitleId}>{subtitle}</p> : null}
        </div>
        {!messages ? (
          <button ref={closeButton} type="button" className="feedback-dialog-close" aria-label="关闭" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
          </button>
        ) : null}
      </header>
      <div className="feedback-dialog-body">
        {messages ? (
          <ul className="feedback-messages">
            {messages.map(({ level = 'info', message }, index) => (
              <li key={index} className={`feedback-message feedback-message--${level}`}>
                <span className="feedback-message-label">{messageLabels[level]}</span>
                <p>{message}</p>
              </li>
            ))}
          </ul>
        ) : markdown ? <MarkdownPreview content={content ?? ''} allowRemoteImages={false} /> : content ? <p className="feedback-dialog-text">{content}</p> : null}
        {children}
      </div>
      {messages ? (
        <footer className="feedback-dialog-footer">
          <button ref={closeButton} type="button" className="feedback-dialog-done" onClick={onClose}>关闭</button>
        </footer>
      ) : null}
    </section>
  </div>;
  return typeof document === 'undefined' ? dialog : createPortal(dialog, document.body);
}
