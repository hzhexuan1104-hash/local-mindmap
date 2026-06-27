import type { ReactNode } from 'react';

export type ResourceView =
  | 'templates'
  | 'node-types'
  | 'search'
  | 'plugins'
  | 'settings'
  | 'performance';

type LeftResourcePanelProps = {
  activeView: ResourceView | null;
  title: string;
  children: ReactNode;
  onViewChange: (view: ResourceView | null) => void;
};

const resourceItems: Array<{
  id: Exclude<ResourceView, 'performance'>;
  icon: string;
  label: string;
}> = [
  { id: 'templates', icon: '▤', label: '文件 / 模板' },
  { id: 'node-types', icon: '◇', label: '节点类型' },
  { id: 'search', icon: '⌕', label: '查找' },
  { id: 'plugins', icon: '⬡', label: '插件' },
  { id: 'settings', icon: '⚙', label: '设置' },
];

export function LeftResourcePanel({
  activeView,
  title,
  children,
  onViewChange,
}: LeftResourcePanelProps) {
  return (
    <div className={activeView ? 'left-resource-area' : 'left-resource-area is-collapsed'}>
      <aside className="resource-rail" aria-label="资源导航">
        {resourceItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className={activeView === item.id ? 'is-active' : undefined}
            aria-label={item.label}
            title={item.label}
            onClick={() =>
              onViewChange(activeView === item.id ? null : item.id)
            }
          >
            <span className="resource-icon" aria-hidden="true">
              {item.icon}
            </span>
            <span>{item.label.replace('文件 / ', '')}</span>
          </button>
        ))}
      </aside>

      {activeView ? (
        <aside className="resource-panel" aria-label={title}>
          <header className="resource-panel-header">
            <div>
              <span>资源</span>
              <h2>{title}</h2>
            </div>
            <button
              type="button"
              className="panel-collapse-action"
              onClick={() => onViewChange(null)}
              aria-label="收起左侧面板"
              title="收起左侧面板"
            >
              ‹
            </button>
          </header>
          <div className="resource-panel-content">{children}</div>
        </aside>
      ) : null}
    </div>
  );
}
