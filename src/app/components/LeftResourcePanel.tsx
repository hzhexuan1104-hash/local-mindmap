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
  tooltip: string;
  group: '资源' | '工具' | '扩展' | '设置';
}> = [
  {
    id: 'templates',
    icon: '▦',
    label: '模板库',
    tooltip: '模板库：浏览、预览和应用思维导图模板',
    group: '资源',
  },
  {
    id: 'node-types',
    icon: '◒',
    label: '节点类型',
    tooltip: '节点类型：管理全局样式模板',
    group: '工具',
  },
  {
    id: 'search',
    icon: '⌕',
    label: '查找',
    tooltip: '查找：搜索和替换节点标题、备注',
    group: '工具',
  },
  {
    id: 'plugins',
    icon: '🧩',
    label: '插件',
    tooltip: '插件：打开插件管理、中心、工作台和诊断',
    group: '扩展',
  },
  {
    id: 'settings',
    icon: '⚙',
    label: '系统设置',
    tooltip: '系统设置：界面、编辑、文件和插件设置',
    group: '设置',
  },
];

const resourceGroups: Array<{ label: string; items: typeof resourceItems }> = [
  { label: '资源', items: resourceItems.filter((item) => item.group === '资源') },
  { label: '工具', items: resourceItems.filter((item) => item.group === '工具') },
  { label: '扩展', items: resourceItems.filter((item) => item.group === '扩展') },
  { label: '设置', items: resourceItems.filter((item) => item.group === '设置') },
];

export function LeftResourcePanel({
  activeView,
  title,
  children,
  onViewChange,
}: LeftResourcePanelProps) {
  return (
    <div className={activeView ? 'left-resource-area' : 'left-resource-area is-collapsed'}>
      <aside className="resource-rail" aria-label="工作区面板导航">
        {resourceGroups.map((group) => (
          <div className="resource-rail-group" key={group.label}>
            <span className="resource-rail-group-label">{group.label}</span>
            {group.items.map((item) => (
              <button
                key={item.id}
                type="button"
                className={activeView === item.id ? 'is-active' : undefined}
                aria-label={item.tooltip}
                title={item.tooltip}
                onClick={() =>
                  onViewChange(activeView === item.id ? null : item.id)
                }
              >
                <span className="resource-icon" aria-hidden="true">
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        ))}
      </aside>

      {activeView ? (
        <aside className="resource-panel" aria-label={title}>
          <header className="resource-panel-header">
            <div>
              <span>工作区面板</span>
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
