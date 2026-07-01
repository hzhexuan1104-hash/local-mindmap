import type { MindmapNodeType } from '../mindmap/types';
import type { MindmapTemplate } from '../mindmap/templates';
import type { PluginManifest } from '../mindmap/plugins';

export const USER_DATA_COMMANDS = {
  getUserDataDir: 'get_user_data_dir',
  ensureUserDataDirs: 'ensure_user_data_dirs',
  readUserJson: 'read_user_json',
  writeUserJson: 'write_user_json',
  readUserText: 'read_user_text',
  listUserFiles: 'list_user_files',
  installPluginToUserDir: 'install_plugin_to_user_dir',
  uninstallPluginFromUserDir: 'uninstall_plugin_from_user_dir',
  openUserDataDir: 'open_user_data_dir',
  openPluginDir: 'open_plugin_dir',
  openPluginDevDir: 'open_plugin_dev_dir',
  createSamplePlugin: 'create_sample_plugin',
  createSampleScriptPlugin: 'create_sample_script_plugin',
  createSampleBatchScriptPlugin: 'create_sample_batch_script_plugin',
  createSampleWorkflowPlugin: 'create_sample_workflow_plugin',
  openSampleScriptPluginDir: 'open_sample_script_plugin_dir',
  openPluginManifestDir: 'open_plugin_manifest_dir',
  scanInstalledPluginManifests: 'scan_installed_plugin_manifests',
  reloadPluginsFromDisk: 'reload_plugins_from_disk',
} as const;

export const USER_DATA_PATHS = {
  nodeTypes: 'node-types/custom-node-types.json',
  nodeTypePacks: 'node-types/packs',
  templates: 'templates/custom-templates.json',
  templatePacks: 'templates/packs',
  pluginRegistry: 'plugins/plugin-registry.json',
  pluginSettings: 'config/plugin-settings.json',
  installedPlugins: 'plugins/installed',
  pluginDev: 'plugins/dev',
  appSettings: 'config/app-settings.json',
  recentFiles: 'config/recent-files.json',
  userPreferences: 'config/user-preferences.json',
  migrationFlag: 'config/migration-state.json',
  backups: 'backups',
} as const;

export type InstalledPluginScanEntry = {
  pluginIdHint: string;
  manifestPath: string;
  manifest: unknown | null;
  error?: string;
};

export type PluginDiskSnapshot = {
  registry: unknown;
  installedManifests: InstalledPluginScanEntry[];
};

export type SamplePluginCreationResult = {
  created: boolean;
  directoryPath: string;
  manifestPath: string;
  readmePath: string;
  mainPath?: string;
};

export type PluginInstallAsset = {
  relativePath: string;
  sourcePath?: string | null;
  text?: string;
};

const LEGACY_MIGRATION_FLAG_PATH = 'config/migration-v1.6.json';

export const LEGACY_STORAGE_KEYS = {
  nodeTypes: 'local-mindmap.node-types.v1',
  templates: 'local-mindmap.templates.v1',
  plugins: 'local-mindmap.plugins.v1',
  appSettings: 'local-mindmap.app-settings.v1',
  recentFiles: 'local-mindmap.recent-files.v1',
  userPreferences: 'local-mindmap.user-preferences.v1',
} as const;

const WEB_PATH_STORAGE_PREFIX = 'local-mindmap.user-data.v1:';
const WEB_PATH_INDEX_KEY = 'local-mindmap.user-data.paths.v1';

type UserDataCommandInvoker = <T>(
  command: string,
  args?: Record<string, unknown>,
) => Promise<T>;

let commandInvokerOverride: UserDataCommandInvoker | null = null;

async function defaultCommandInvoker<T>(
  command: string,
  args?: Record<string, unknown>,
) {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(command, args);
}

async function invokeUserDataCommand<T>(
  command: string,
  args?: Record<string, unknown>,
) {
  const invoker = commandInvokerOverride ?? defaultCommandInvoker;
  return invoker<T>(command, args);
}

export function setUserDataStorageInvokerForTests(
  invoker: UserDataCommandInvoker | null,
) {
  commandInvokerOverride = invoker;
}

function getStorage() {
  return typeof window !== 'undefined' ? window.localStorage : null;
}

function readWebPathIndex() {
  const storage = getStorage();
  if (!storage) {
    return [] as string[];
  }

  try {
    const value: unknown = JSON.parse(storage.getItem(WEB_PATH_INDEX_KEY) ?? '[]');
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

function rememberWebPath(relativePath: string) {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  const paths = Array.from(new Set([...readWebPathIndex(), relativePath])).sort();
  storage.setItem(WEB_PATH_INDEX_KEY, JSON.stringify(paths));
}

function webStorageKeyForPath(relativePath: string) {
  return `${WEB_PATH_STORAGE_PREFIX}${relativePath}`;
}

function readWebJson<T>(
  relativePath: string,
  defaultValue: T,
  webStorageKey?: string,
) {
  const storage = getStorage();
  const rawValue =
    storage?.getItem(webStorageKey ?? webStorageKeyForPath(relativePath)) ?? null;
  if (!rawValue) {
    return defaultValue;
  }

  try {
    return JSON.parse(rawValue) as T;
  } catch {
    return defaultValue;
  }
}

function writeWebJson<T>(
  relativePath: string,
  value: T,
  webStorageKey?: string,
) {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  storage.setItem(
    webStorageKey ?? webStorageKeyForPath(relativePath),
    JSON.stringify(value),
  );
  rememberWebPath(relativePath);
}

export function isDesktopRuntime() {
  if (typeof window === 'undefined') {
    return false;
  }

  const runtimeGlobal = globalThis as typeof globalThis & {
    isTauri?: boolean;
  };
  const runtimeWindow = window as Window & {
    __TAURI__?: unknown;
    __TAURI_INTERNALS__?: unknown;
  };

  return Boolean(
    runtimeGlobal.isTauri ||
      runtimeWindow.__TAURI__ ||
      runtimeWindow.__TAURI_INTERNALS__,
  );
}

export async function getUserDataDir() {
  if (!isDesktopRuntime()) {
    return '浏览器本地存储';
  }

  return invokeUserDataCommand<string>(USER_DATA_COMMANDS.getUserDataDir);
}

export function resolveUserDataPath(root: string, path: string) {
  if (!root || root === '浏览器本地存储') {
    return path;
  }
  if (/^(?:[A-Za-z]:[\\/]|\/)/.test(path)) {
    return path;
  }
  return `${root.replace(/[\\/]$/, '')}/${path.replace(/^[\\/]+/, '')}`;
}

export async function ensureUserDataDirs() {
  if (!isDesktopRuntime()) {
    return '浏览器本地存储';
  }

  return invokeUserDataCommand<string>(USER_DATA_COMMANDS.ensureUserDataDirs);
}

export async function readUserJson<T>(
  relativePath: string,
  defaultValue: T,
  webStorageKey?: string,
): Promise<T> {
  if (isDesktopRuntime()) {
    return invokeUserDataCommand<T>(USER_DATA_COMMANDS.readUserJson, {
      relativePath,
      defaultValue,
    });
  }

  return readWebJson(relativePath, defaultValue, webStorageKey);
}

export async function writeUserJson<T>(
  relativePath: string,
  value: T,
  webStorageKey?: string,
) {
  if (isDesktopRuntime()) {
    await invokeUserDataCommand<void>(USER_DATA_COMMANDS.writeUserJson, {
      relativePath,
      value,
    });
    return;
  }

  writeWebJson(relativePath, value, webStorageKey);
}

export async function readUserText(relativePath: string): Promise<string> {
  if (isDesktopRuntime()) {
    return invokeUserDataCommand<string>(USER_DATA_COMMANDS.readUserText, {
      relativePath,
    });
  }

  const storage = getStorage();
  const value = storage?.getItem(webStorageKeyForPath(relativePath));
  if (value === null || value === undefined) {
    throw new Error(`用户目录文件不存在：${relativePath}`);
  }
  return value;
}

function writeWebText(relativePath: string, value: string) {
  const storage = getStorage();
  if (!storage) {
    return;
  }
  storage.setItem(webStorageKeyForPath(relativePath), value);
  rememberWebPath(relativePath);
}

export function isDirectUserJsonFile(
  relativePath: string,
  relativeDir: string,
) {
  const prefix = `${relativeDir.replace(/\/+$/, '')}/`;
  if (!relativePath.startsWith(prefix)) {
    return false;
  }

  const fileName = relativePath.slice(prefix.length);
  return (
    fileName.length > 0 &&
    !fileName.includes('/') &&
    fileName.toLowerCase().endsWith('.json')
  );
}

export async function listUserFiles(relativeDir: string) {
  if (isDesktopRuntime()) {
    return invokeUserDataCommand<string[]>(USER_DATA_COMMANDS.listUserFiles, {
      relativeDir,
    });
  }

  return readWebPathIndex().filter((path) =>
    isDirectUserJsonFile(path, relativeDir),
  );
}

export async function loadUserNodeTypes() {
  const desktop = isDesktopRuntime();
  console.info('[user-data][node-types] load custom file', {
    desktop,
    path: USER_DATA_PATHS.nodeTypes,
  });

  try {
    const nodeTypes = await readUserJson<MindmapNodeType[]>(
      USER_DATA_PATHS.nodeTypes,
      [],
      LEGACY_STORAGE_KEYS.nodeTypes,
    );
    console.info('[user-data][node-types] custom file loaded', {
      desktop,
      count: Array.isArray(nodeTypes) ? nodeTypes.length : 0,
      names: Array.isArray(nodeTypes)
        ? nodeTypes.map((nodeType) => nodeType?.name).filter(Boolean)
        : [],
    });
    return nodeTypes;
  } catch (error) {
    console.error('[user-data][node-types] custom file read failed', {
      desktop,
      path: USER_DATA_PATHS.nodeTypes,
      error,
    });
    throw error;
  }
}

export async function saveUserNodeTypes(nodeTypes: MindmapNodeType[]) {
  return writeUserJson(
    USER_DATA_PATHS.nodeTypes,
    nodeTypes,
    LEGACY_STORAGE_KEYS.nodeTypes,
  );
}

export async function loadUserTemplates() {
  const desktop = isDesktopRuntime();
  console.info('[user-data][templates] load custom file', {
    desktop,
    path: USER_DATA_PATHS.templates,
  });

  try {
    const templates = await readUserJson<MindmapTemplate[]>(
      USER_DATA_PATHS.templates,
      [],
      LEGACY_STORAGE_KEYS.templates,
    );
    console.info('[user-data][templates] custom file loaded', {
      desktop,
      count: Array.isArray(templates) ? templates.length : 0,
      names: Array.isArray(templates)
        ? templates.map((template) => template?.name).filter(Boolean)
        : [],
    });
    return templates;
  } catch (error) {
    console.error('[user-data][templates] custom file read failed', {
      desktop,
      path: USER_DATA_PATHS.templates,
      error,
    });
    throw error;
  }
}

export async function saveUserTemplates(templates: MindmapTemplate[]) {
  return writeUserJson(
    USER_DATA_PATHS.templates,
    templates,
    LEGACY_STORAGE_KEYS.templates,
  );
}

export async function loadPluginRegistry() {
  return readUserJson<PluginManifest[]>(
    USER_DATA_PATHS.pluginRegistry,
    [],
    LEGACY_STORAGE_KEYS.plugins,
  );
}

export async function savePluginRegistry(plugins: PluginManifest[]) {
  return writeUserJson(
    USER_DATA_PATHS.pluginRegistry,
    plugins,
    LEGACY_STORAGE_KEYS.plugins,
  );
}

export async function loadRecentFiles() {
  return readUserJson<string[]>(
    USER_DATA_PATHS.recentFiles,
    [],
    LEGACY_STORAGE_KEYS.recentFiles,
  );
}

export async function saveRecentFiles(recentFiles: string[]) {
  return writeUserJson(
    USER_DATA_PATHS.recentFiles,
    recentFiles,
    LEGACY_STORAGE_KEYS.recentFiles,
  );
}

export async function installPluginToUserDir(
  manifest: PluginManifest,
  overwrite = false,
  assets: PluginInstallAsset[] = [],
  sourceManifestPath?: string | null,
) {
  try {
    if (isDesktopRuntime()) {
      await invokeUserDataCommand<void>(
        USER_DATA_COMMANDS.installPluginToUserDir,
        {
          pluginId: manifest.pluginId,
          manifest,
          overwrite,
          assets,
          sourceManifestPath,
        },
      );
      return;
    }

    await writeUserJson(
      `${USER_DATA_PATHS.installedPlugins}/${manifest.pluginId}/manifest.json`,
      manifest,
    );
    for (const asset of assets) {
      if (typeof asset.text !== 'string') {
        throw new Error(`脚本入口文件不存在：${asset.relativePath}。`);
      }
      writeWebText(
        `${USER_DATA_PATHS.installedPlugins}/${manifest.pluginId}/${asset.relativePath}`,
        asset.text,
      );
    }
  } catch (error) {
    const detail =
      typeof error === 'string'
        ? error
        : error instanceof Error && error.message
          ? error.message
          : String(error);
    throw new Error(`插件写入用户目录失败：${detail}`);
  }
}

export async function uninstallPluginFromUserDir(pluginId: string) {
  if (isDesktopRuntime()) {
    await invokeUserDataCommand<void>(
      USER_DATA_COMMANDS.uninstallPluginFromUserDir,
      { pluginId },
    );
    return;
  }

  const storage = getStorage();
  const path = `${USER_DATA_PATHS.installedPlugins}/${pluginId}/manifest.json`;
  storage?.removeItem(webStorageKeyForPath(path));
  const nextPaths = readWebPathIndex().filter((item) => item !== path);
  storage?.setItem(WEB_PATH_INDEX_KEY, JSON.stringify(nextPaths));
}

export async function openUserDataDir() {
  if (!isDesktopRuntime()) {
    return false;
  }

  await invokeUserDataCommand<void>(USER_DATA_COMMANDS.openUserDataDir);
  return true;
}

export async function openPluginDir() {
  if (!isDesktopRuntime()) {
    return false;
  }

  await invokeUserDataCommand<void>(USER_DATA_COMMANDS.openPluginDir);
  return true;
}

export async function openPluginDevDir() {
  if (!isDesktopRuntime()) {
    return false;
  }

  await invokeUserDataCommand<void>(USER_DATA_COMMANDS.openPluginDevDir);
  return true;
}

export async function createSamplePlugin() {
  if (!isDesktopRuntime()) {
    return null;
  }

  return invokeUserDataCommand<SamplePluginCreationResult>(
    USER_DATA_COMMANDS.createSamplePlugin,
  );
}

export async function createSampleScriptPlugin() {
  if (!isDesktopRuntime()) {
    return null;
  }

  return invokeUserDataCommand<SamplePluginCreationResult>(
    USER_DATA_COMMANDS.createSampleScriptPlugin,
  );
}

export async function createSampleBatchScriptPlugin() {
  if (!isDesktopRuntime()) {
    return null;
  }

  return invokeUserDataCommand<SamplePluginCreationResult>(
    USER_DATA_COMMANDS.createSampleBatchScriptPlugin,
  );
}

export async function createSampleWorkflowPlugin() {
  if (!isDesktopRuntime()) {
    return null;
  }

  return invokeUserDataCommand<SamplePluginCreationResult>(
    USER_DATA_COMMANDS.createSampleWorkflowPlugin,
  );
}

export async function openSampleScriptPluginDir() {
  if (!isDesktopRuntime()) {
    return false;
  }

  await invokeUserDataCommand<void>(USER_DATA_COMMANDS.openSampleScriptPluginDir);
  return true;
}

export async function openPluginManifestDir(pluginId: string) {
  if (!isDesktopRuntime()) {
    return false;
  }

  await invokeUserDataCommand<void>(USER_DATA_COMMANDS.openPluginManifestDir, {
    pluginId,
  });
  return true;
}

export async function scanInstalledPluginManifests(
  expectedPluginIds: string[] = [],
): Promise<
  InstalledPluginScanEntry[]
> {
  if (isDesktopRuntime()) {
    return invokeUserDataCommand<InstalledPluginScanEntry[]>(
      USER_DATA_COMMANDS.scanInstalledPluginManifests,
      { pluginIds: expectedPluginIds },
    );
  }

  const prefix = `${USER_DATA_PATHS.installedPlugins}/`;
  const entries = readWebPathIndex()
    .filter(
      (path) => path.startsWith(prefix) && path.endsWith('/manifest.json'),
    )
    .map((manifestPath) => {
      const pluginIdHint =
        manifestPath.slice(prefix.length).split('/')[0] ?? 'unknown-plugin';
      const rawValue = getStorage()?.getItem(webStorageKeyForPath(manifestPath));
      if (!rawValue) {
        return {
          pluginIdHint,
          manifestPath,
          manifest: null,
          error: 'manifest.json 缺失。',
        };
      }
      try {
        return {
          pluginIdHint,
          manifestPath,
          manifest: JSON.parse(rawValue) as unknown,
        };
      } catch (error) {
        return {
          pluginIdHint,
          manifestPath,
          manifest: null,
          error: `manifest JSON 损坏：${
            error instanceof Error ? error.message : String(error)
          }`,
        };
      }
    });
  const scannedIds = new Set(entries.map((entry) => entry.pluginIdHint));
  for (const pluginId of expectedPluginIds) {
    if (!scannedIds.has(pluginId)) {
      entries.push({
        pluginIdHint: pluginId,
        manifestPath: `${prefix}${pluginId}/manifest.json`,
        manifest: null,
        error: 'manifest.json 缺失。',
      });
    }
  }
  return entries;
}

export async function reloadPluginsFromDisk(): Promise<PluginDiskSnapshot> {
  if (isDesktopRuntime()) {
    return invokeUserDataCommand<PluginDiskSnapshot>(
      USER_DATA_COMMANDS.reloadPluginsFromDisk,
    );
  }

  const registry = await loadPluginRegistry();
  const pluginIds = Array.isArray(registry)
    ? registry
        .map((plugin) => plugin?.pluginId)
        .filter((pluginId): pluginId is string => typeof pluginId === 'string')
    : [];
  return {
    registry,
    installedManifests: await scanInstalledPluginManifests(pluginIds),
  };
}

export type UserDataMigrationResult = {
  attempted: boolean;
  migrated: boolean;
  migratedKeys: string[];
  backupPath?: string;
  error?: string;
};

export type UserDataMigrationState = {
  completed: true;
  nodeTypesMigrated: true;
  templatesMigrated: true;
  pluginsMigrated: true;
  appSettingsMigrated: true;
  recentFilesMigrated: true;
  userPreferencesMigrated: true;
  migratedAt: string;
  migratedKeys: string[];
  backupPath?: string;
};

const migrationTargets: Array<{
  sourceKey: string;
  relativePath: string;
}> = [
  {
    sourceKey: LEGACY_STORAGE_KEYS.nodeTypes,
    relativePath: USER_DATA_PATHS.nodeTypes,
  },
  {
    sourceKey: LEGACY_STORAGE_KEYS.templates,
    relativePath: USER_DATA_PATHS.templates,
  },
  {
    sourceKey: LEGACY_STORAGE_KEYS.plugins,
    relativePath: USER_DATA_PATHS.pluginRegistry,
  },
  {
    sourceKey: LEGACY_STORAGE_KEYS.appSettings,
    relativePath: USER_DATA_PATHS.appSettings,
  },
  {
    sourceKey: LEGACY_STORAGE_KEYS.recentFiles,
    relativePath: USER_DATA_PATHS.recentFiles,
  },
  {
    sourceKey: LEGACY_STORAGE_KEYS.userPreferences,
    relativePath: USER_DATA_PATHS.userPreferences,
  },
];

function createCompletedMigrationState(
  migratedAt: string,
  migratedKeys: string[],
  backupPath?: string,
): UserDataMigrationState {
  return {
    completed: true,
    nodeTypesMigrated: true,
    templatesMigrated: true,
    pluginsMigrated: true,
    appSettingsMigrated: true,
    recentFilesMigrated: true,
    userPreferencesMigrated: true,
    migratedAt,
    migratedKeys,
    ...(backupPath ? { backupPath } : {}),
  };
}

export async function migrateLegacyLocalStorageToUserData(): Promise<UserDataMigrationResult> {
  if (!isDesktopRuntime()) {
    return { attempted: false, migrated: false, migratedKeys: [] };
  }

  try {
    await ensureUserDataDirs();
    const migrationState = await readUserJson<UserDataMigrationState | null>(
      USER_DATA_PATHS.migrationFlag,
      null,
    );
    if (migrationState !== null) {
      return { attempted: false, migrated: false, migratedKeys: [] };
    }

    const legacyMigrationState = await readUserJson<{
      completed?: boolean;
      migratedAt?: string;
      migratedKeys?: string[];
      backupPath?: string;
    } | null>(LEGACY_MIGRATION_FLAG_PATH, null);
    if (legacyMigrationState?.completed) {
      await writeUserJson(
        USER_DATA_PATHS.migrationFlag,
        createCompletedMigrationState(
          legacyMigrationState.migratedAt ?? new Date().toISOString(),
          legacyMigrationState.migratedKeys ?? [],
          legacyMigrationState.backupPath,
        ),
      );
      return { attempted: false, migrated: false, migratedKeys: [] };
    }

    const storage = getStorage();
    if (!storage) {
      return { attempted: false, migrated: false, migratedKeys: [] };
    }

    const indexedPackTargets = readWebPathIndex()
      .filter(
        (path) =>
          isDirectUserJsonFile(path, USER_DATA_PATHS.nodeTypePacks) ||
          isDirectUserJsonFile(path, USER_DATA_PATHS.templatePacks),
      )
      .map((relativePath) => ({
        sourceKey: webStorageKeyForPath(relativePath),
        relativePath,
      }));
    const legacyEntries = [...migrationTargets, ...indexedPackTargets]
      .map((target) => ({
        ...target,
        rawValue: storage.getItem(target.sourceKey),
      }))
      .filter(
        (entry): entry is typeof entry & { rawValue: string } =>
          entry.rawValue !== null,
      );
    const migratedAt = new Date().toISOString();

    if (legacyEntries.length === 0) {
      await writeUserJson(
        USER_DATA_PATHS.migrationFlag,
        createCompletedMigrationState(migratedAt, []),
      );
      return { attempted: true, migrated: false, migratedKeys: [] };
    }

    const backupPath = `${USER_DATA_PATHS.backups}/local-storage-v1.6-${migratedAt.replace(/[:.]/g, '-')}.json`;
    await writeUserJson(backupPath, {
      createdAt: migratedAt,
      source: 'localStorage',
      entries: Object.fromEntries(
        legacyEntries.map((entry) => [entry.sourceKey, entry.rawValue]),
      ),
    });

    const migratedKeys: string[] = [];
    const missingMarker = { __localMindmapMissing: true };

    for (const entry of legacyEntries) {
      const existingValue = await readUserJson<unknown>(
        entry.relativePath,
        missingMarker,
      );
      if (
        typeof existingValue === 'object' &&
        existingValue !== null &&
        '__localMindmapMissing' in existingValue
      ) {
        try {
          await writeUserJson(entry.relativePath, JSON.parse(entry.rawValue));
          migratedKeys.push(entry.sourceKey);
        } catch (error) {
          if (!(error instanceof SyntaxError)) {
            throw error;
          }
        }
      }
    }

    await writeUserJson(
      USER_DATA_PATHS.migrationFlag,
      createCompletedMigrationState(migratedAt, migratedKeys, backupPath),
    );

    return {
      attempted: true,
      migrated: migratedKeys.length > 0,
      migratedKeys,
      backupPath,
    };
  } catch (error) {
    return {
      attempted: true,
      migrated: false,
      migratedKeys: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
