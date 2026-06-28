import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  installPluginToUserDir,
  savePluginRegistry,
  USER_DATA_PATHS,
  writeUserJson,
} from '../../storage/userDataStorage';
import {
  getPluginMenuGroups,
  loadPluginRegistry,
  validatePluginManifest,
  type PluginManifest,
} from '../../mindmap/plugins';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() {
    return this.values.size;
  }
  clear() {
    this.values.clear();
  }
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  key(index: number) {
    return Array.from(this.values.keys())[index] ?? null;
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const rawPlugin = {
  manifestVersion: 1,
  pluginId: 'test.reload.menu',
  name: '重载测试插件',
  version: '1.0.0',
  pluginType: 'import-export',
  capabilities: ['export'],
  enabled: true,
  contributions: {
    menus: [
      {
        id: 'export',
        label: '首次标签',
        location: 'plugins',
        command: 'builtin.exportText',
        when: 'always',
      },
    ],
  },
};

describe('plugin reload from installed manifests', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { localStorage: new MemoryStorage() },
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'window');
  });

  it('refreshes menu contributions from installed manifest.json', async () => {
    const plugin = validatePluginManifest(rawPlugin).manifest as PluginManifest;
    await savePluginRegistry([plugin]);
    await installPluginToUserDir(plugin);

    const firstLoad = await loadPluginRegistry();
    expect(
      getPluginMenuGroups(firstLoad, {
        hasMindmap: true,
        hasSelectedNode: false,
      }).find((group) => group.pluginId === plugin.pluginId)?.items[0]?.label,
    ).toBe('首次标签');

    await writeUserJson(
      `${USER_DATA_PATHS.installedPlugins}/${plugin.pluginId}/manifest.json`,
      {
        ...rawPlugin,
        contributions: {
          menus: [
            {
              ...rawPlugin.contributions.menus[0],
              label: '重载后的标签',
            },
          ],
        },
      },
    );

    const reloaded = await loadPluginRegistry();
    expect(
      getPluginMenuGroups(reloaded, {
        hasMindmap: true,
        hasSelectedNode: false,
      }).find((group) => group.pluginId === plugin.pluginId)?.items[0]?.label,
    ).toBe('重载后的标签');
  });

  it('keeps a registry entry visible but suppresses menus when manifest is missing', async () => {
    const plugin = validatePluginManifest(rawPlugin).manifest as PluginManifest;
    await savePluginRegistry([plugin]);

    const reloaded = await loadPluginRegistry();
    const restoredPlugin = reloaded.find(
      (item) => item.pluginId === plugin.pluginId,
    );

    expect(restoredPlugin).toMatchObject({
      enabled: true,
      manifestValid: false,
      contributions: undefined,
    });
    expect(
      getPluginMenuGroups(reloaded, {
        hasMindmap: true,
        hasSelectedNode: true,
      }).some((group) => group.pluginId === plugin.pluginId),
    ).toBe(false);
  });
});
