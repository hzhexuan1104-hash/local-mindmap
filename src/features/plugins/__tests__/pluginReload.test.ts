import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  installPluginToUserDir,
  savePluginRegistry,
  USER_DATA_PATHS,
  uninstallPluginFromUserDir,
  writeUserJson,
} from '../../storage/userDataStorage';
import {
  getPluginExporters,
  getPersistablePluginRegistry,
  getPluginMenuGroups,
  installPlugin,
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
    exporters: [
      {
        id: 'exportText',
        label: '导出 TXT',
        handler: 'builtin.exportText',
      },
    ],
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

  it('restores trusted state from registry instead of the installed manifest', async () => {
    const plugin = validatePluginManifest({
      manifestVersion: 1,
      pluginId: 'test.reload.trusted-script',
      name: 'Trusted script',
      version: '1.0.0',
      pluginType: 'script',
      capabilities: ['script'],
      entry: 'main.js',
      permissions: ['script', 'node:write'],
    }).manifest as PluginManifest;
    await installPluginToUserDir(plugin, false, [{
      relativePath: 'main.js',
      text: 'async function run() { return []; }',
    }]);
    await savePluginRegistry([{ ...plugin, trusted: true }]);

    await expect(loadPluginRegistry()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          pluginId: plugin.pluginId,
          trusted: true,
          manifestValid: true,
        }),
      ]),
    );
  });

  it('restores action-workflow trust from registry', async () => {
    const plugin = validatePluginManifest({
      manifestVersion: 1,
      pluginId: 'test.reload.trusted-workflow',
      name: 'Trusted workflow',
      version: '1.0.0',
      pluginType: 'action-workflow',
      capabilities: ['workflow'],
      permissions: ['node:write'],
      workflow: {
        name: 'Add child',
        description: '',
        actions: [{
          type: 'addChildNode',
          parentId: '$selectedNode.id',
          node: { text: 'Child' },
        }],
      },
    }).manifest as PluginManifest;
    await installPluginToUserDir(plugin);
    await savePluginRegistry([{ ...plugin, trusted: true }]);

    await expect(loadPluginRegistry()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          pluginId: plugin.pluginId,
          trusted: true,
          manifestValid: true,
        }),
      ]),
    );
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
      source: 'manifest-missing',
      manifestError: 'manifest.json 缺失。',
    });
    expect(restoredPlugin?.contributions).toBeUndefined();
    expect(
      getPluginMenuGroups(reloaded, {
        hasMindmap: true,
        hasSelectedNode: true,
      }).some((group) => group.pluginId === plugin.pluginId),
    ).toBe(false);
    expect(getPersistablePluginRegistry(reloaded)).toContainEqual(
      expect.objectContaining({
        pluginId: plugin.pluginId,
        source: 'manifest-missing',
        manifestValid: false,
      }),
    );
  });

  it('re-reads disk after deletion, disables contributions, and recovers after overwrite', async () => {
    const plugin = validatePluginManifest(rawPlugin).manifest as PluginManifest;
    await savePluginRegistry([plugin]);
    await installPluginToUserDir(plugin);

    const installed = await loadPluginRegistry();
    const installedPlugin = installed.find(
      (item) => item.pluginId === plugin.pluginId,
    );
    expect(installedPlugin).toMatchObject({
      manifestValid: true,
      source: 'external',
    });
    expect(installedPlugin?.contributions?.exporters).toHaveLength(1);
    expect(
      getPluginMenuGroups(installed, {
        hasMindmap: true,
        hasSelectedNode: true,
      }).some((group) => group.pluginId === plugin.pluginId),
    ).toBe(true);

    const manifestPath = `${USER_DATA_PATHS.installedPlugins}/${plugin.pluginId}/manifest.json`;
    window.localStorage.removeItem(
      `local-mindmap.user-data.v1:${manifestPath}`,
    );

    const missing = await loadPluginRegistry();
    const missingPlugin = missing.find(
      (item) => item.pluginId === plugin.pluginId,
    );
    expect(missingPlugin).toMatchObject({
      enabled: true,
      manifestValid: false,
      source: 'manifest-missing',
      manifestError: 'manifest.json 缺失。',
    });
    expect(missingPlugin?.contributions).toBeUndefined();
    expect(missingPlugin?.validationErrors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ message: 'manifest.json 缺失。' }),
      ]),
    );
    expect(missingPlugin?.contributions?.exporters ?? []).toHaveLength(0);
    expect(getPluginExporters(missing)).toHaveLength(1);
    expect(
      getPluginMenuGroups(missing, {
        hasMindmap: true,
        hasSelectedNode: true,
      }).some((group) => group.pluginId === plugin.pluginId),
    ).toBe(false);

    await installPlugin(missing, plugin, true);
    const restored = await loadPluginRegistry();
    expect(
      restored.find((item) => item.pluginId === plugin.pluginId),
    ).toMatchObject({
      manifestValid: true,
      source: 'external',
    });
    expect(
      restored.find((item) => item.pluginId === plugin.pluginId)?.contributions
        ?.exporters,
    ).toHaveLength(1);
  });

  it('shows an installed manifest without registry as a repairable orphan', async () => {
    const plugin = validatePluginManifest(rawPlugin).manifest as PluginManifest;
    await installPluginToUserDir(plugin);

    const reloaded = await loadPluginRegistry();
    const orphan = reloaded.find((item) => item.pluginId === plugin.pluginId);

    expect(orphan).toMatchObject({
      source: 'registry-missing',
      manifestValid: true,
      enabled: false,
    });
    expect(orphan?.validationWarnings).toContain(
      'plugin-registry.json 记录缺失。',
    );
    expect(
      getPluginMenuGroups(reloaded, {
        hasMindmap: true,
        hasSelectedNode: true,
      }),
    ).not.toContainEqual(
      expect.objectContaining({ pluginId: plugin.pluginId }),
    );
  });

  it('shows damaged manifest diagnostics, suppresses contributions, and can be cleaned', async () => {
    const plugin = validatePluginManifest(rawPlugin).manifest as PluginManifest;
    await savePluginRegistry([plugin]);
    await installPluginToUserDir(plugin);
    const manifestPath = `${USER_DATA_PATHS.installedPlugins}/${plugin.pluginId}/manifest.json`;
    window.localStorage.setItem(
      `local-mindmap.user-data.v1:${manifestPath}`,
      '{ broken',
    );

    const damagedLoad = await loadPluginRegistry();
    expect(
      damagedLoad.find((item) => item.pluginId === plugin.pluginId),
    ).toMatchObject({
      source: 'manifest-damaged',
      manifestValid: false,
    });
    expect(
      getPluginMenuGroups(damagedLoad, {
        hasMindmap: true,
        hasSelectedNode: true,
      }),
    ).not.toContainEqual(
      expect.objectContaining({ pluginId: plugin.pluginId }),
    );

    await uninstallPluginFromUserDir(plugin.pluginId);
    await savePluginRegistry([]);
    const cleanedLoad = await loadPluginRegistry();
    expect(
      cleanedLoad.some((item) => item.pluginId === plugin.pluginId),
    ).toBe(false);
  });
});
