import type { PluginManifest } from '../mindmap/plugins';

export const PLUGIN_COMMAND_IDS = [
  'builtin.openPluginManager',
  'builtin.reloadPlugins',
  'builtin.openPluginDirectory',
  'builtin.exportText',
  'builtin.exportJson',
  'builtin.applyTheme',
  'builtin.insertNodeType',
  'builtin.applyTemplate',
  'plugin.runScript',
] as const;

export type PluginCommandId = (typeof PLUGIN_COMMAND_IDS)[number];

export type PluginCommandHandlers = Partial<
  Record<PluginCommandId, () => void | Promise<void>>
>;

export function isPluginCommandId(value: string): value is PluginCommandId {
  return PLUGIN_COMMAND_IDS.includes(value as PluginCommandId);
}

export async function executePluginCommand(options: {
  commandId: string;
  pluginId?: string;
  plugins: PluginManifest[];
  handlers: PluginCommandHandlers;
}) {
  const { commandId, pluginId, plugins, handlers } = options;
  if (!isPluginCommandId(commandId)) {
    throw new Error(`插件命令不存在：${commandId}`);
  }

  if (pluginId) {
    const plugin = plugins.find((item) => item.pluginId === pluginId);
    if (!plugin?.enabled) {
      throw new Error(`插件已禁用：${pluginId}`);
    }
    if (plugin.manifestValid === false) {
      throw new Error(`插件 manifest 无效：${pluginId}`);
    }
  }

  const handler = handlers[commandId];
  if (!handler) {
    throw new Error(`插件命令暂未实现：${commandId}`);
  }

  await handler();
}
