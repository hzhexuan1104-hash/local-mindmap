import type { MenuItemDefinition } from './menuTypes';

export type RecentMenuEntry = { id: string; name: string; missing?: boolean; execute: () => void };
export type PluginCommandGroup = {
  pluginId: string;
  pluginName: string;
  items: Array<{ id: string; label: string; disabled?: boolean; disabledReason?: string; execute: () => void }>;
};

export function buildRecentFilesMenu(entries: RecentMenuEntry[], onShowAll: () => void): MenuItemDefinition[] {
  return [
    ...(entries.length
      ? entries.slice(0, 5).map((entry) => ({
          id: `recent.${entry.id}`,
          label: entry.missing ? `${entry.name}（文件已移动或删除）` : entry.name,
          danger: entry.missing,
          execute: entry.execute,
        }))
      : [{ id: 'recent.empty', label: '暂无最近文件', disabled: true }]),
    { id: 'recent.all', label: '查看全部最近文件', separatorBefore: true, execute: onShowAll },
  ];
}

export function buildPluginCommandMenu(groups: PluginCommandGroup[]): MenuItemDefinition[] {
  return groups
    .slice()
    .sort((left, right) => left.pluginName.localeCompare(right.pluginName, 'zh-CN'))
    .map((group) => ({
      id: `plugin.${group.pluginId}`,
      label: group.pluginName,
      children: group.items.map((item) => ({
        id: `plugin.${group.pluginId}.${item.id}`,
        label: item.label,
        disabled: item.disabled,
        disabledReason: item.disabledReason,
        execute: item.execute,
      })),
    }));
}
