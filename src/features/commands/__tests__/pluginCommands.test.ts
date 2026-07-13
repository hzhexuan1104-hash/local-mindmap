import { describe, expect, it, vi } from 'vitest';
import type { PluginManifest } from '../../mindmap/plugins';
import { createPluginCommands } from '../pluginCommands';

const plugin = (overrides: Partial<PluginManifest> = {}): PluginManifest => ({
  manifestVersion: 1,
  pluginId: 'demo.script',
  name: 'Demo Script',
  version: '1.0.0',
  author: 'Local',
  description: 'demo',
  pluginType: 'script',
  category: 'tool',
  capabilities: ['script'],
  permissions: ['node:write'],
  enabled: true,
  installedAt: '2026-01-01',
  manifestValid: true,
  trusted: false,
  contributions: {
    menus: [{ id: 'run', label: '运行 Demo', location: 'plugins', command: 'plugin.runScript', when: 'always', valid: true }],
  },
  ...overrides,
});

describe('plugin command adapter', () => {
  it('uses stable ids, shows risk and delegates to the existing runner entry', async () => {
    const execute = vi.fn();
    const commands = createPluginCommands([plugin()], { isScriptRunnerEnabled: true, isExternalRunnerEnabled: false }, execute);
    expect(commands[0]).toMatchObject({
      id: 'plugin.demo.script.run',
      pluginId: 'demo.script',
      riskLevel: 'high',
    });
    await commands[0].execute({} as never);
    expect(execute).toHaveBeenCalledWith('plugin.runScript', 'demo.script', 'run');
  });

  it('removes disabled plugins and reports runner-disabled commands', () => {
    expect(createPluginCommands([plugin({ enabled: false })], { isScriptRunnerEnabled: true, isExternalRunnerEnabled: true }, vi.fn())).toEqual([]);
    const command = createPluginCommands([plugin()], { isScriptRunnerEnabled: false, isExternalRunnerEnabled: true }, vi.fn())[0];
    expect(command.disabledReason?.({} as never)).toContain('尚未启用');
  });
});
