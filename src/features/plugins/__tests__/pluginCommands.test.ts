import { describe, expect, it, vi } from 'vitest';
import {
  executePluginCommand,
  PLUGIN_COMMAND_IDS,
} from '../pluginCommands';
import type { PluginManifest } from '../../mindmap/plugins';

const plugin: PluginManifest = {
  manifestVersion: 1,
  pluginId: 'test.menu.plugin',
  name: '菜单插件',
  version: '1.0.0',
  author: 'Tester',
  description: '',
  pluginType: 'import-export',
  category: 'import-export',
  capabilities: ['export'],
  enabled: true,
  installedAt: '2026-06-28T00:00:00.000Z',
};

describe('plugin command registry', () => {
  it('publishes the fixed safe command whitelist', () => {
    expect(PLUGIN_COMMAND_IDS).toEqual([
      'builtin.openPluginManager',
      'builtin.reloadPlugins',
      'builtin.openPluginDirectory',
      'builtin.exportText',
      'builtin.exportJson',
      'builtin.applyTheme',
      'builtin.insertNodeType',
      'builtin.applyTemplate',
    ]);
  });

  it('triggers builtin.exportText through a plugin command', async () => {
    const exportText = vi.fn();

    await executePluginCommand({
      commandId: 'builtin.exportText',
      pluginId: plugin.pluginId,
      plugins: [plugin],
      handlers: { 'builtin.exportText': exportText },
    });

    expect(exportText).toHaveBeenCalledOnce();
  });

  it('rejects unknown commands with the required error', async () => {
    await expect(
      executePluginCommand({
        commandId: 'builtin.unknown',
        pluginId: plugin.pluginId,
        plugins: [plugin],
        handlers: {},
      }),
    ).rejects.toThrow('插件命令不存在：builtin.unknown');
  });

  it('does not execute menu commands after the plugin is disabled', async () => {
    const exportText = vi.fn();

    await expect(
      executePluginCommand({
        commandId: 'builtin.exportText',
        pluginId: plugin.pluginId,
        plugins: [{ ...plugin, enabled: false }],
        handlers: { 'builtin.exportText': exportText },
      }),
    ).rejects.toThrow(`插件已禁用：${plugin.pluginId}`);
    expect(exportText).not.toHaveBeenCalled();
  });
});
