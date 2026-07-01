import type { PluginManifest } from '../mindmap/plugins';

export type PluginLogLevel = 'info' | 'warning' | 'error';

export type PluginLogEvent =
  | 'import-success'
  | 'import-failure'
  | 'reload-success'
  | 'reload-failure'
  | 'enabled'
  | 'disabled'
  | 'uninstalled'
  | 'manifest-missing'
  | 'manifest-damaged'
  | 'command-invalid'
  | 'script-plugin-imported'
  | 'script-runner-disabled'
  | 'script-execution-started'
  | 'script-execution-succeeded'
  | 'script-execution-failed'
  | 'script-action-validation-failed'
  | 'script-action-applied'
  | 'script-trust-requested'
  | 'script-trust-granted'
  | 'script-trust-revoked'
  | 'script-runner-setting-saved'
  | 'script-context-built'
  | 'script-action-batch-validated'
  | 'script-undo-batch-created'
  | 'script-context-menu-invoked';

export type PluginLogEntry = {
  id: string;
  timestamp: string;
  level: PluginLogLevel;
  event: PluginLogEvent;
  pluginId?: string;
  message: string;
};

export const MAX_PLUGIN_LOGS = 100;

let nextPluginLogId = 1;

export function createPluginLog(
  entry: Omit<PluginLogEntry, 'id' | 'timestamp'> & { timestamp?: string },
): PluginLogEntry {
  return {
    ...entry,
    id: `plugin-log-${nextPluginLogId++}`,
    timestamp: entry.timestamp ?? new Date().toISOString(),
  };
}

export function appendPluginLog(
  logs: PluginLogEntry[],
  entry: PluginLogEntry,
) {
  return [entry, ...logs].slice(0, MAX_PLUGIN_LOGS);
}

export function clearPluginLogs(): PluginLogEntry[] {
  return [];
}

export function createPluginDiagnosticLogs(
  plugins: PluginManifest[],
): PluginLogEntry[] {
  return plugins.flatMap((plugin) => {
    const entries: PluginLogEntry[] = [];
    if (plugin.source === 'manifest-missing') {
      entries.push(
        createPluginLog({
          level: 'error',
          event: 'manifest-missing',
          pluginId: plugin.pluginId,
          message: plugin.manifestError ?? 'manifest.json 缺失。',
        }),
      );
    } else if (plugin.source === 'manifest-damaged') {
      entries.push(
        createPluginLog({
          level: 'error',
          event: 'manifest-damaged',
          pluginId: plugin.pluginId,
          message: plugin.manifestError ?? 'manifest.json 损坏。',
        }),
      );
    }

    for (const menu of plugin.contributions?.menus ?? []) {
      if (!menu.valid) {
        entries.push(
          createPluginLog({
            level: 'warning',
            event: 'command-invalid',
            pluginId: plugin.pluginId,
            message: `菜单 ${menu.id} 无效：${menu.invalidReason ?? '未知原因'}`,
          }),
        );
      }
    }
    return entries;
  });
}
