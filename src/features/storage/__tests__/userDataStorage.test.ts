import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  LEGACY_STORAGE_KEYS,
  USER_DATA_COMMANDS,
  USER_DATA_PATHS,
  createSamplePlugin,
  ensureUserDataDirs,
  getUserDataDir,
  installPluginToUserDir,
  isDesktopRuntime,
  loadPluginRegistry,
  loadRecentFiles,
  loadUserNodeTypes,
  loadUserTemplates,
  migrateLegacyLocalStorageToUserData,
  openPluginDir,
  openPluginDevDir,
  openPluginManifestDir,
  scanInstalledPluginManifests,
  readUserJson,
  reloadPluginsFromDisk,
  resolveUserDataPath,
  savePluginRegistry,
  saveRecentFiles,
  saveUserNodeTypes,
  saveUserTemplates,
  setUserDataStorageInvokerForTests,
  uninstallPluginFromUserDir,
  writeUserJson,
} from '../userDataStorage';
import type { MindmapNodeType } from '../../mindmap/types';
import type { MindmapTemplate } from '../../mindmap/templates';
import {
  installPlugin,
  setPluginEnabled,
  uninstallPlugin,
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

const nodeType: MindmapNodeType = {
  id: 'task',
  name: '任务',
  icon: '✅',
  shape: 'rounded',
  backgroundColor: '#fff',
  borderColor: '#000',
  textColor: '#111',
  fontSize: 16,
  bold: false,
  defaultText: '任务',
  defaultRemark: '',
};

const template: MindmapTemplate = {
  id: 'template-1',
  name: '模板',
  category: '测试',
  description: '',
  createTime: '2026-06-27T00:00:00.000Z',
  rootNode: { id: 'root', text: '根节点', remark: '', children: [] },
  nodeTypes: [],
  themeId: 'default-blue',
  thumbnail: '根节点',
};

const plugin: PluginManifest = {
  manifestVersion: 1,
  pluginId: 'test.plugin',
  name: '测试插件',
  version: '1.0.0',
  author: 'Tester',
  description: '',
  pluginType: 'tool',
  category: 'tool',
  capabilities: ['tools'],
  enabled: true,
  installedAt: '2026-06-27T00:00:00.000Z',
};

function installWindow(desktop = false) {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: new MemoryStorage(),
      ...(desktop ? { __TAURI_INTERNALS__: {} } : {}),
    },
  });
}

describe('userDataStorage web fallback', () => {
  beforeEach(() => installWindow(false));

  afterEach(() => {
    setUserDataStorageInvokerForTests(null);
    Reflect.deleteProperty(globalThis, 'window');
    Reflect.deleteProperty(globalThis, 'isTauri');
  });

  it('keeps the existing localStorage keys for user assets', async () => {
    await saveUserNodeTypes([nodeType]);
    await saveUserTemplates([template]);
    await savePluginRegistry([plugin]);
    await saveRecentFiles(['C:/maps/example.lmind']);

    expect(window.localStorage.getItem(LEGACY_STORAGE_KEYS.nodeTypes)).not.toBeNull();
    expect(window.localStorage.getItem(LEGACY_STORAGE_KEYS.templates)).not.toBeNull();
    expect(window.localStorage.getItem(LEGACY_STORAGE_KEYS.plugins)).not.toBeNull();
    await expect(loadUserNodeTypes()).resolves.toEqual([nodeType]);
    await expect(loadUserTemplates()).resolves.toEqual([template]);
    await expect(loadPluginRegistry()).resolves.toEqual([plugin]);
    await expect(loadRecentFiles()).resolves.toEqual(['C:/maps/example.lmind']);
  });

  it('returns the browser storage label without invoking Tauri', async () => {
    await expect(getUserDataDir()).resolves.toBe('浏览器本地存储');
    await expect(ensureUserDataDirs()).resolves.toBe('浏览器本地存储');
  });

  it('recognizes the Tauri v2 runtime marker', () => {
    (globalThis as typeof globalThis & { isTauri?: boolean }).isTauri = true;

    expect(isDesktopRuntime()).toBe(true);

    Reflect.deleteProperty(globalThis, 'isTauri');
  });
});

describe('userDataStorage desktop commands', () => {
  it('resolves a copied installed manifest path to an absolute user-data path', () => {
    expect(
      resolveUserDataPath(
        'C:\\Users\\test\\AppData\\Roaming\\com.localmindmap.desktop',
        'plugins/installed/test.plugin/manifest.json',
      ),
    ).toBe(
      'C:\\Users\\test\\AppData\\Roaming\\com.localmindmap.desktop/plugins/installed/test.plugin/manifest.json',
    );
    expect(
      resolveUserDataPath(
        'C:\\Users\\test\\AppData\\Roaming\\com.localmindmap.desktop',
        'D:\\portable\\manifest.json',
      ),
    ).toBe('D:\\portable\\manifest.json');
  });

  beforeEach(() => installWindow(true));

  afterEach(() => {
    setUserDataStorageInvokerForTests(null);
    Reflect.deleteProperty(globalThis, 'window');
    Reflect.deleteProperty(globalThis, 'isTauri');
  });

  it('uses the expected Tauri command names and argument shapes', async () => {
    const calls: Array<{ command: string; args?: Record<string, unknown> }> = [];
    setUserDataStorageInvokerForTests(async (command, args) => {
      calls.push({ command, args });
      if (command === USER_DATA_COMMANDS.getUserDataDir) {
        return 'C:/Users/test/AppData/Local Mindmap' as never;
      }
      if (command === USER_DATA_COMMANDS.readUserJson) {
        return args?.defaultValue as never;
      }
      return undefined as never;
    });

    await getUserDataDir();
    await readUserJson('config/app-settings.json', { theme: 'default' });
    await writeUserJson('config/app-settings.json', { theme: 'dark' });

    expect(calls).toEqual([
      { command: USER_DATA_COMMANDS.getUserDataDir, args: undefined },
      {
        command: USER_DATA_COMMANDS.readUserJson,
        args: {
          relativePath: 'config/app-settings.json',
          defaultValue: { theme: 'default' },
        },
      },
      {
        command: USER_DATA_COMMANDS.writeUserJson,
        args: {
          relativePath: 'config/app-settings.json',
          value: { theme: 'dark' },
        },
      },
    ]);
  });

  it('passes supported user JSON paths to Tauri as relative paths', async () => {
    const relativePaths = [
      USER_DATA_PATHS.nodeTypes,
      USER_DATA_PATHS.templates,
      USER_DATA_PATHS.pluginRegistry,
      `${USER_DATA_PATHS.installedPlugins}/plugin-id/manifest.json`,
      USER_DATA_PATHS.recentFiles,
    ];
    const receivedPaths: string[] = [];
    setUserDataStorageInvokerForTests(async (command, args) => {
      expect(command).toBe(USER_DATA_COMMANDS.writeUserJson);
      receivedPaths.push(String(args?.relativePath));
      return undefined as never;
    });

    for (const relativePath of relativePaths) {
      await writeUserJson(relativePath, {});
    }

    expect(receivedPaths).toEqual(relativePaths);
    expect(receivedPaths.every((path) => !path.startsWith('/'))).toBe(true);
    expect(receivedPaths.every((path) => !path.startsWith('\\'))).toBe(true);
  });

  it('persists node types, templates, and plugin registry through desktop JSON commands', async () => {
    const files = new Map<string, unknown>();
    setUserDataStorageInvokerForTests(async (command, args) => {
      if (command === USER_DATA_COMMANDS.writeUserJson) {
        files.set(String(args?.relativePath), args?.value);
        return undefined as never;
      }
      if (command === USER_DATA_COMMANDS.readUserJson) {
        const path = String(args?.relativePath);
        return (files.has(path) ? files.get(path) : args?.defaultValue) as never;
      }
      throw new Error(`Unexpected command: ${command}`);
    });

    await saveUserNodeTypes([nodeType]);
    await saveUserTemplates([template]);
    await savePluginRegistry([plugin]);

    await expect(loadUserNodeTypes()).resolves.toEqual([nodeType]);
    await expect(loadUserTemplates()).resolves.toEqual([template]);
    await expect(loadPluginRegistry()).resolves.toEqual([plugin]);
    expect(files.get(USER_DATA_PATHS.nodeTypes)).toEqual([nodeType]);
    expect(files.get(USER_DATA_PATHS.templates)).toEqual([template]);
    expect(files.get(USER_DATA_PATHS.pluginRegistry)).toEqual([plugin]);
  });

  it('treats empty desktop asset files as authoritative over legacy localStorage', async () => {
    window.localStorage.setItem(
      LEGACY_STORAGE_KEYS.nodeTypes,
      JSON.stringify([nodeType]),
    );
    window.localStorage.setItem(
      LEGACY_STORAGE_KEYS.templates,
      JSON.stringify([template]),
    );
    window.localStorage.setItem(
      LEGACY_STORAGE_KEYS.plugins,
      JSON.stringify([plugin]),
    );
    const files = new Map<string, unknown>([
      [USER_DATA_PATHS.nodeTypes, []],
      [USER_DATA_PATHS.templates, []],
      [USER_DATA_PATHS.pluginRegistry, []],
    ]);

    setUserDataStorageInvokerForTests(async (command, args) => {
      if (command === USER_DATA_COMMANDS.readUserJson) {
        const path = String(args?.relativePath);
        return (files.has(path) ? files.get(path) : args?.defaultValue) as never;
      }
      throw new Error(`Unexpected command: ${command}`);
    });

    await expect(loadUserNodeTypes()).resolves.toEqual([]);
    await expect(loadUserTemplates()).resolves.toEqual([]);
    await expect(loadPluginRegistry()).resolves.toEqual([]);
  });

  it('does not fall back to localStorage when a desktop read fails', async () => {
    window.localStorage.setItem(
      LEGACY_STORAGE_KEYS.nodeTypes,
      JSON.stringify([nodeType]),
    );
    setUserDataStorageInvokerForTests(async () => {
      throw new Error('desktop read failed');
    });

    await expect(loadUserNodeTypes()).rejects.toThrow('desktop read failed');
  });

  it('installs and uninstalls a plugin manifest through the desktop user directory commands', async () => {
    const calls: Array<{ command: string; args?: Record<string, unknown> }> = [];
    setUserDataStorageInvokerForTests(async (command, args) => {
      calls.push({ command, args });
      return undefined as never;
    });

    await installPluginToUserDir(plugin);
    await uninstallPluginFromUserDir(plugin.pluginId);

    expect(calls).toEqual([
      {
        command: USER_DATA_COMMANDS.installPluginToUserDir,
        args: {
          pluginId: plugin.pluginId,
          manifest: plugin,
          overwrite: false,
          assets: [],
          sourceManifestPath: undefined,
        },
      },
      {
        command: USER_DATA_COMMANDS.uninstallPluginFromUserDir,
        args: { pluginId: plugin.pluginId },
      },
    ]);
  });

  it('opens the plugins user directory through the dedicated desktop command', async () => {
    const calls: string[] = [];
    setUserDataStorageInvokerForTests(async (command) => {
      calls.push(command);
      return undefined as never;
    });

    await expect(openPluginDir()).resolves.toBe(true);
    expect(calls).toEqual([USER_DATA_COMMANDS.openPluginDir]);
  });

  it('opens the development directory and creates the bundled sample plugin', async () => {
    const calls: string[] = [];
    setUserDataStorageInvokerForTests(async (command) => {
      calls.push(command);
      if (command === USER_DATA_COMMANDS.createSamplePlugin) {
        return {
          created: true,
          directoryPath: 'C:/data/plugins/dev/sample-json-plugin',
          manifestPath:
            'C:/data/plugins/dev/sample-json-plugin/manifest.json',
          readmePath: 'C:/data/plugins/dev/sample-json-plugin/README.md',
        } as never;
      }
      return undefined as never;
    });

    await expect(openPluginDevDir()).resolves.toBe(true);
    await expect(createSamplePlugin()).resolves.toMatchObject({
      created: true,
      manifestPath: expect.stringContaining(
        'plugins/dev/sample-json-plugin/manifest.json',
      ),
    });
    expect(calls).toEqual([
      USER_DATA_COMMANDS.openPluginDevDir,
      USER_DATA_COMMANDS.createSamplePlugin,
    ]);
  });

  it('scans installed manifests and opens a specific manifest directory', async () => {
    const calls: Array<{ command: string; args?: Record<string, unknown> }> = [];
    setUserDataStorageInvokerForTests(async (command, args) => {
      calls.push({ command, args });
      if (command === USER_DATA_COMMANDS.scanInstalledPluginManifests) {
        return [
          {
            pluginIdHint: 'test.plugin',
            manifestPath: 'plugins/installed/test.plugin/manifest.json',
            manifest: plugin,
          },
        ] as never;
      }
      return undefined as never;
    });

    await expect(scanInstalledPluginManifests()).resolves.toHaveLength(1);
    await expect(openPluginManifestDir('test.plugin')).resolves.toBe(true);
    expect(calls).toEqual([
      {
        command: USER_DATA_COMMANDS.scanInstalledPluginManifests,
        args: { pluginIds: [] },
      },
      {
        command: USER_DATA_COMMANDS.openPluginManifestDir,
        args: { pluginId: 'test.plugin' },
      },
    ]);
  });

  it('reloads registry and installed manifests in one desktop disk snapshot', async () => {
    setUserDataStorageInvokerForTests(async (command) => {
      expect(command).toBe(USER_DATA_COMMANDS.reloadPluginsFromDisk);
      return {
        registry: [plugin],
        installedManifests: [
          {
            pluginIdHint: plugin.pluginId,
            manifestPath: `plugins/installed/${plugin.pluginId}/manifest.json`,
            manifest: null,
            error: 'manifest.json 缺失。',
          },
        ],
      } as never;
    });

    await expect(reloadPluginsFromDisk()).resolves.toMatchObject({
      registry: [plugin],
      installedManifests: [
        {
          pluginIdHint: plugin.pluginId,
          manifest: null,
          error: 'manifest.json 缺失。',
        },
      ],
    });
  });

  it('exposes the concrete desktop write error', async () => {
    setUserDataStorageInvokerForTests(async () => {
      throw 'access denied';
    });

    await expect(installPluginToUserDir(plugin)).rejects.toThrow(
      '插件写入用户目录失败：access denied',
    );
  });

  it('persists the complete plugin lifecycle in registry and installed paths', async () => {
    const files = new Map<string, unknown>();
    setUserDataStorageInvokerForTests(async (command, args) => {
      if (command === USER_DATA_COMMANDS.installPluginToUserDir) {
        const manifest = args?.manifest as PluginManifest;
        files.set(
          `${USER_DATA_PATHS.installedPlugins}/${manifest.pluginId}/manifest.json`,
          manifest,
        );
        const registry =
          (files.get(USER_DATA_PATHS.pluginRegistry) as PluginManifest[] | undefined) ??
          [];
        files.set(USER_DATA_PATHS.pluginRegistry, [
          ...registry.filter(
            (pluginEntry) => pluginEntry.pluginId !== manifest.pluginId,
          ),
          manifest,
        ]);
        return undefined as never;
      }
      if (command === USER_DATA_COMMANDS.uninstallPluginFromUserDir) {
        const pluginId = String(args?.pluginId);
        files.delete(
          `${USER_DATA_PATHS.installedPlugins}/${pluginId}/manifest.json`,
        );
        return undefined as never;
      }
      if (command === USER_DATA_COMMANDS.writeUserJson) {
        files.set(String(args?.relativePath), args?.value);
        return undefined as never;
      }
      if (command === USER_DATA_COMMANDS.readUserJson) {
        const path = String(args?.relativePath);
        return (files.get(path) ?? args?.defaultValue) as never;
      }
      throw new Error(`Unexpected command: ${command}`);
    });

    const validation = validatePluginManifest({
      manifestVersion: 1,
      pluginId: 'localmindmap.test.persistence.theme',
      name: '持久化测试主题插件',
      version: '1.0.0',
      author: 'Local Mindmap Test',
      description: 'Persistence test.',
      pluginType: 'theme-pack',
      capabilities: ['themes'],
      enabled: true,
    });
    const installed = await installPlugin(
      [],
      validation.manifest as PluginManifest,
    );
    const installedPath = `${USER_DATA_PATHS.installedPlugins}/localmindmap.test.persistence.theme/manifest.json`;

    expect(Date.parse(installed.manifest.installedAt)).toBeGreaterThan(
      Date.now() - 10_000,
    );
    expect(files.get(installedPath)).toEqual(installed.manifest);
    expect(files.get(USER_DATA_PATHS.pluginRegistry)).toEqual(installed.plugins);

    const disabled = setPluginEnabled(
      installed.plugins,
      installed.manifest.pluginId,
      false,
    );
    await savePluginRegistry(disabled);
    await expect(loadPluginRegistry()).resolves.toMatchObject([
      { pluginId: installed.manifest.pluginId, enabled: false },
    ]);

    await uninstallPluginFromUserDir(installed.manifest.pluginId);
    const afterUninstall = uninstallPlugin(
      disabled,
      installed.manifest.pluginId,
    );
    await savePluginRegistry(afterUninstall);
    await expect(loadPluginRegistry()).resolves.toEqual([]);
    expect(files.has(installedPath)).toBe(false);
  });

  it('passes a preserved enabled state through overwrite installation', async () => {
    const calls: Array<{ command: string; args?: Record<string, unknown> }> = [];
    setUserDataStorageInvokerForTests(async (command, args) => {
      calls.push({ command, args });
      return undefined as never;
    });
    const original: PluginManifest = {
      ...plugin,
      name: '旧插件',
      version: '1.0.0',
      enabled: false,
      source: 'external',
    };
    const update: PluginManifest = {
      ...original,
      name: '新插件',
      version: '1.0.1',
      enabled: true,
    };

    const result = await installPlugin([original], update, true);

    expect(result.manifest).toMatchObject({
      name: '新插件',
      version: '1.0.1',
      enabled: false,
    });
    expect(calls).toContainEqual({
      command: USER_DATA_COMMANDS.installPluginToUserDir,
      args: {
        pluginId: original.pluginId,
        manifest: result.manifest,
        overwrite: true,
        assets: [],
        sourceManifestPath: undefined,
      },
    });
  });

  it('migrates legacy localStorage after creating a backup and keeps old data', async () => {
    window.localStorage.setItem(
      LEGACY_STORAGE_KEYS.nodeTypes,
      JSON.stringify([nodeType]),
    );
    window.localStorage.setItem(
      LEGACY_STORAGE_KEYS.templates,
      JSON.stringify([template]),
    );
    const files = new Map<string, unknown>();

    setUserDataStorageInvokerForTests(async (command, args) => {
      if (
        command === USER_DATA_COMMANDS.ensureUserDataDirs ||
        command === USER_DATA_COMMANDS.getUserDataDir
      ) {
        return 'C:/Users/test/AppData/Local Mindmap' as never;
      }
      if (command === USER_DATA_COMMANDS.readUserJson) {
        const path = String(args?.relativePath);
        return (files.has(path) ? files.get(path) : args?.defaultValue) as never;
      }
      if (command === USER_DATA_COMMANDS.writeUserJson) {
        files.set(String(args?.relativePath), args?.value);
        return undefined as never;
      }
      throw new Error(`Unexpected command: ${command}`);
    });

    const result = await migrateLegacyLocalStorageToUserData();

    expect(result.migrated).toBe(true);
    expect(result.migratedKeys).toEqual([
      LEGACY_STORAGE_KEYS.nodeTypes,
      LEGACY_STORAGE_KEYS.templates,
    ]);
    expect(files.get(USER_DATA_PATHS.nodeTypes)).toEqual([nodeType]);
    expect(files.get(USER_DATA_PATHS.templates)).toEqual([template]);
    expect(result.backupPath).toMatch(/^backups\/local-storage-v1\.6-/);
    expect(files.has(result.backupPath ?? '')).toBe(true);
    expect(files.get(USER_DATA_PATHS.migrationFlag)).toMatchObject({
      completed: true,
      nodeTypesMigrated: true,
      templatesMigrated: true,
      pluginsMigrated: true,
      recentFilesMigrated: true,
    });
    expect(window.localStorage.getItem(LEGACY_STORAGE_KEYS.nodeTypes)).not.toBeNull();
  });

  it('does not inspect or migrate legacy assets after the migration flag exists', async () => {
    window.localStorage.setItem(
      LEGACY_STORAGE_KEYS.nodeTypes,
      JSON.stringify([nodeType]),
    );
    window.localStorage.setItem(
      LEGACY_STORAGE_KEYS.templates,
      JSON.stringify([template]),
    );
    const legacyStorage = window.localStorage;
    let localStorageAccesses = 0;
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        localStorageAccesses += 1;
        return legacyStorage;
      },
    });
    const migrationState = {
      completed: true,
      nodeTypesMigrated: true,
      templatesMigrated: true,
      pluginsMigrated: true,
      appSettingsMigrated: true,
      recentFilesMigrated: true,
      userPreferencesMigrated: true,
      migratedAt: '2026-06-28T00:00:00.000Z',
      migratedKeys: [],
    };
    const files = new Map<string, unknown>([
      [USER_DATA_PATHS.migrationFlag, migrationState],
      [USER_DATA_PATHS.nodeTypes, []],
      [USER_DATA_PATHS.templates, []],
    ]);
    const writes: string[] = [];

    setUserDataStorageInvokerForTests(async (command, args) => {
      if (command === USER_DATA_COMMANDS.ensureUserDataDirs) {
        return 'C:/Users/test/AppData/Local Mindmap' as never;
      }
      if (command === USER_DATA_COMMANDS.readUserJson) {
        const path = String(args?.relativePath);
        return (files.has(path) ? files.get(path) : args?.defaultValue) as never;
      }
      if (command === USER_DATA_COMMANDS.writeUserJson) {
        writes.push(String(args?.relativePath));
        return undefined as never;
      }
      throw new Error(`Unexpected command: ${command}`);
    });

    await expect(migrateLegacyLocalStorageToUserData()).resolves.toEqual({
      attempted: false,
      migrated: false,
      migratedKeys: [],
    });
    await expect(loadUserNodeTypes()).resolves.toEqual([]);
    await expect(loadUserTemplates()).resolves.toEqual([]);
    expect(writes).toEqual([]);
    expect(localStorageAccesses).toBe(0);
  });

  it('converts the previous migration flag without rereading legacy assets', async () => {
    window.localStorage.setItem(
      LEGACY_STORAGE_KEYS.nodeTypes,
      JSON.stringify([nodeType]),
    );
    const files = new Map<string, unknown>([
      [
        'config/migration-v1.6.json',
        {
          completed: true,
          migratedAt: '2026-06-27T00:00:00.000Z',
          migratedKeys: [LEGACY_STORAGE_KEYS.nodeTypes],
        },
      ],
      [USER_DATA_PATHS.nodeTypes, []],
    ]);

    setUserDataStorageInvokerForTests(async (command, args) => {
      if (command === USER_DATA_COMMANDS.ensureUserDataDirs) {
        return 'C:/Users/test/AppData/Local Mindmap' as never;
      }
      if (command === USER_DATA_COMMANDS.readUserJson) {
        const path = String(args?.relativePath);
        return (files.has(path) ? files.get(path) : args?.defaultValue) as never;
      }
      if (command === USER_DATA_COMMANDS.writeUserJson) {
        files.set(String(args?.relativePath), args?.value);
        return undefined as never;
      }
      throw new Error(`Unexpected command: ${command}`);
    });

    await expect(migrateLegacyLocalStorageToUserData()).resolves.toEqual({
      attempted: false,
      migrated: false,
      migratedKeys: [],
    });
    expect(files.get(USER_DATA_PATHS.nodeTypes)).toEqual([]);
    expect(files.get(USER_DATA_PATHS.migrationFlag)).toMatchObject({
      completed: true,
      migratedAt: '2026-06-27T00:00:00.000Z',
      nodeTypesMigrated: true,
      templatesMigrated: true,
    });
  });

  it('runs first migration once and never overwrites existing empty arrays', async () => {
    window.localStorage.setItem(
      LEGACY_STORAGE_KEYS.nodeTypes,
      JSON.stringify([nodeType]),
    );
    window.localStorage.setItem(
      LEGACY_STORAGE_KEYS.templates,
      JSON.stringify([template]),
    );
    const files = new Map<string, unknown>([
      [USER_DATA_PATHS.nodeTypes, []],
      [USER_DATA_PATHS.templates, []],
    ]);

    setUserDataStorageInvokerForTests(async (command, args) => {
      if (command === USER_DATA_COMMANDS.ensureUserDataDirs) {
        return 'C:/Users/test/AppData/Local Mindmap' as never;
      }
      if (command === USER_DATA_COMMANDS.readUserJson) {
        const path = String(args?.relativePath);
        return (files.has(path) ? files.get(path) : args?.defaultValue) as never;
      }
      if (command === USER_DATA_COMMANDS.writeUserJson) {
        files.set(String(args?.relativePath), args?.value);
        return undefined as never;
      }
      throw new Error(`Unexpected command: ${command}`);
    });

    await expect(migrateLegacyLocalStorageToUserData()).resolves.toMatchObject({
      attempted: true,
      migrated: false,
      migratedKeys: [],
    });
    await expect(migrateLegacyLocalStorageToUserData()).resolves.toEqual({
      attempted: false,
      migrated: false,
      migratedKeys: [],
    });
    expect(files.get(USER_DATA_PATHS.nodeTypes)).toEqual([]);
    expect(files.get(USER_DATA_PATHS.templates)).toEqual([]);
  });

  it('migrates only direct indexed node type and template pack files', async () => {
    const nodeTypePackPath = `${USER_DATA_PATHS.nodeTypePacks}/shared.json`;
    const templatePackPath = `${USER_DATA_PATHS.templatePacks}/shared.json`;
    const nestedNodeTypePackPath =
      `${USER_DATA_PATHS.nodeTypePacks}/nested/legacy.json`;
    const backupTemplatePath =
      'templates/backup-manual-clean-2026/legacy.json';
    const pathStoragePrefix = 'local-mindmap.user-data.v1:';
    window.localStorage.setItem(
      'local-mindmap.user-data.paths.v1',
      JSON.stringify([
        nodeTypePackPath,
        templatePackPath,
        nestedNodeTypePackPath,
        backupTemplatePath,
      ]),
    );
    window.localStorage.setItem(
      `${pathStoragePrefix}${nodeTypePackPath}`,
      JSON.stringify({ kind: 'node-type-pack', nodeTypes: [nodeType] }),
    );
    window.localStorage.setItem(
      `${pathStoragePrefix}${templatePackPath}`,
      JSON.stringify({ kind: 'template-pack', templates: [template] }),
    );
    window.localStorage.setItem(
      `${pathStoragePrefix}${nestedNodeTypePackPath}`,
      JSON.stringify({ shouldNotMigrate: true }),
    );
    window.localStorage.setItem(
      `${pathStoragePrefix}${backupTemplatePath}`,
      JSON.stringify({ shouldNotMigrate: true }),
    );
    const files = new Map<string, unknown>();

    setUserDataStorageInvokerForTests(async (command, args) => {
      if (command === USER_DATA_COMMANDS.ensureUserDataDirs) {
        return 'C:/Users/test/AppData/Local Mindmap' as never;
      }
      if (command === USER_DATA_COMMANDS.readUserJson) {
        const path = String(args?.relativePath);
        return (files.has(path) ? files.get(path) : args?.defaultValue) as never;
      }
      if (command === USER_DATA_COMMANDS.writeUserJson) {
        files.set(String(args?.relativePath), args?.value);
        return undefined as never;
      }
      throw new Error(`Unexpected command: ${command}`);
    });

    await expect(migrateLegacyLocalStorageToUserData()).resolves.toMatchObject({
      attempted: true,
      migrated: true,
      migratedKeys: [
        `${pathStoragePrefix}${nodeTypePackPath}`,
        `${pathStoragePrefix}${templatePackPath}`,
      ],
    });
    expect(files.get(nodeTypePackPath)).toMatchObject({
      nodeTypes: [nodeType],
    });
    expect(files.get(templatePackPath)).toMatchObject({
      templates: [template],
    });
    expect(files.has(nestedNodeTypePackPath)).toBe(false);
    expect(files.has(backupTemplatePath)).toBe(false);
  });

  it('contains migration failures and leaves startup recoverable', async () => {
    window.localStorage.setItem(
      LEGACY_STORAGE_KEYS.nodeTypes,
      JSON.stringify([nodeType]),
    );
    setUserDataStorageInvokerForTests(async () => {
      throw new Error('disk unavailable');
    });

    await expect(migrateLegacyLocalStorageToUserData()).resolves.toMatchObject({
      attempted: true,
      migrated: false,
      error: 'disk unavailable',
    });
  });
});
