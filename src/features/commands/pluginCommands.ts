import { getPluginMenus, getPluginWritePermissions, type PluginManifest } from '../mindmap/plugins';
import type { CommandDefinition, CommandRiskLevel } from './commandTypes';

function commandIdPart(value: string) {
  return value.replace(/[^A-Za-z0-9._-]+/g, '-');
}

function getRiskLevel(plugin: PluginManifest): CommandRiskLevel {
  if (plugin.pluginType === 'external-command') return 'critical';
  if (plugin.pluginType === 'script') return getPluginWritePermissions(plugin).length ? 'high' : 'medium';
  if (plugin.pluginType === 'action-workflow') return getPluginWritePermissions(plugin).length ? 'medium' : 'low';
  return 'low';
}

export function createPluginCommands(
  plugins: PluginManifest[],
  runtime: { isScriptRunnerEnabled: boolean; isExternalRunnerEnabled: boolean },
  executePlugin: (commandId: string, pluginId: string, menuId: string) => void | Promise<void>,
): CommandDefinition[] {
  const seen = new Set<string>();
  return getPluginMenus(plugins).flatMap(({ plugin, menu }) => {
    const id = `plugin.${commandIdPart(plugin.pluginId)}.${commandIdPart(menu.id)}`;
    if (id.startsWith('builtin.') || seen.has(id)) {
      console.warn(`[command-registry] duplicate plugin command rejected: ${id}`);
      return [];
    }
    seen.add(id);
    const disabledReason = () => {
      if (plugin.pluginType === 'script' && !runtime.isScriptRunnerEnabled) return '脚本插件运行器尚未启用';
      if (plugin.pluginType === 'external-command' && !runtime.isExternalRunnerEnabled) return '外部命令插件运行器尚未启用';
      return undefined;
    };
    return [{
      id,
      title: menu.label,
      description: `${plugin.name}${plugin.trusted ? '' : ' · 未信任，执行时仍会确认'}${plugin.pluginType === 'external-command' ? ' · 外部命令' : ''}`,
      category: 'plugin',
      keywords: [plugin.name, plugin.pluginId, menu.label, plugin.pluginType],
      source: 'plugin',
      pluginId: plugin.pluginId,
      pluginName: plugin.name,
      riskLevel: getRiskLevel(plugin),
      disabledReason,
      execute: () => executePlugin(menu.command, plugin.pluginId, menu.id),
    } satisfies CommandDefinition];
  });
}
