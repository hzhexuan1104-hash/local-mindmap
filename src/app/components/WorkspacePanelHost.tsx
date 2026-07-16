import type { ReactNode } from 'react';

export type WorkspacePanelId =
  | 'templates'
  | 'node-types'
  | 'search'
  | 'outline'
  | 'settings'
  | 'performance';

type WorkspacePanelHostProps = {
  id: WorkspacePanelId;
  title: string;
  children: ReactNode;
  onClose: () => void;
};

/** A single, on-demand left workspace surface. It deliberately has no navigation rail. */
export function WorkspacePanelHost({
  id,
  title,
  children,
  onClose,
}: WorkspacePanelHostProps) {
  return (
    <aside className="workspace-panel" aria-label={title} data-workspace-panel={id}>
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
  );
}
