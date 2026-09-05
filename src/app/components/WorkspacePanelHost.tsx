import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';

export type WorkspacePanelId =
  | 'templates'
  | 'node-manager'
  | 'outline'
  | 'settings'
  | 'performance';

type WorkspacePanelHostProps = {
  id: WorkspacePanelId;
  title: string;
  children: ReactNode;
  onClose: () => void;
};

/** One modal host for all workspace panels so no work surface permanently narrows the canvas. */
export function WorkspacePanelHost({
  id,
  title,
  children,
  onClose,
}: WorkspacePanelHostProps) {
  const panelRef = useRef<HTMLElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    restoreFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const frame = window.requestAnimationFrame(() => {
      panelRef.current?.focus({ preventScroll: true });
    });
    return () => {
      window.cancelAnimationFrame(frame);
      restoreFocusRef.current?.focus({ preventScroll: true });
    };
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape' && !(event.nativeEvent as { isComposing?: boolean }).isComposing) {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(
      'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
    ) ?? []).filter((element) => !element.hasAttribute('hidden'));
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      className="workspace-overlay-backdrop"
      role="presentation"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
    <aside
      ref={panelRef}
      className="workspace-panel"
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
      aria-label={title}
      data-workspace-panel={id}
      onKeyDown={handleKeyDown}
    >
      <header className="workspace-panel-header">
        <div>
          <span>工作面板</span>
          <h2>{title}</h2>
        </div>
        <button
          type="button"
          className="panel-collapse-action"
          onClick={onClose}
          aria-label={`关闭${title}`}
          title={`关闭${title}`}
        >
          ×
        </button>
      </header>
      <div className="workspace-panel-content">{children}</div>
    </aside>
    </div>
  );
}
