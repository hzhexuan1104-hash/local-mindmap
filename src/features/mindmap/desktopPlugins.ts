import { selectLocalFile } from './fileUtils';
import {
  DESKTOP_PLUGIN_COMMANDS,
  invokeTauriDesktopCommand,
  type PluginCapability,
} from './plugins';

export type NativeDesktopPluginManifest = {
  manifestVersion: number;
  pluginId: string;
  name: string;
  version: string;
  author: string;
  description: string;
  pluginType: 'native';
  platform?: string;
  arch?: string;
  entry: string;
  capabilities: PluginCapability[];
  enabled: boolean;
  abi?: {
    version: number;
    exports: Record<string, string>;
  };
};

export type DesktopPluginManifestError = {
  pluginId?: string;
  manifestPath: string;
  message: string;
};

export type DesktopPluginListResult = {
  pluginDir: string;
  plugins: NativeDesktopPluginManifest[];
  invalidPlugins: DesktopPluginManifestError[];
  isAvailable?: boolean;
};

const NATIVE_PLUGIN_CAPABILITIES: PluginCapability[] = [
  'exportText',
  'themePack',
  'iconPack',
  'nodeTypePack',
  'toolPanel',
];

const FORBIDDEN_NATIVE_MANIFEST_FIELDS = [
  'code',
  'script',
  'eval',
  'function',
  'remoteUrl',
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asString = (value: unknown, fallback = '') =>
  typeof value === 'string' ? value : fallback;

const isPluginCapability = (value: unknown): value is PluginCapability =>
  typeof value === 'string' &&
  NATIVE_PLUGIN_CAPABILITIES.includes(value as PluginCapability);

const isSafePluginId = (pluginId: string) =>
  /^[A-Za-z0-9._-]+$/.test(pluginId);

export function isTauriDesktopRuntime() {
  if (typeof window === 'undefined') {
    return false;
  }

  const runtimeWindow = window as Window & {
    __TAURI__?: unknown;
    __TAURI_INTERNALS__?: unknown;
  };

  return Boolean(runtimeWindow.__TAURI__ || runtimeWindow.__TAURI_INTERNALS__);
}

function normalizeNativeAbi(value: unknown): NativeDesktopPluginManifest['abi'] {
  if (!isRecord(value) || !isRecord(value.exports)) {
    return undefined;
  }

  const version = Number(value.version);
  const exports = Object.fromEntries(
    Object.entries(value.exports).filter(
      (entry): entry is [string, string] =>
        typeof entry[0] === 'string' && typeof entry[1] === 'string',
    ),
  );

  if (!Number.isInteger(version) || version <= 0) {
    return undefined;
  }

  return { version, exports };
}

export function normalizeNativeDesktopPluginManifest(
  value: unknown,
): NativeDesktopPluginManifest | null {
  if (!isRecord(value)) {
    return null;
  }

  if (FORBIDDEN_NATIVE_MANIFEST_FIELDS.some((field) => field in value)) {
    return null;
  }

  const manifestVersion = Number(value.manifestVersion);
  const pluginId = asString(value.pluginId).trim();
  const name = asString(value.name).trim();
  const version = asString(value.version).trim();
  const entry = asString(value.entry).trim();

  if (
    !Number.isInteger(manifestVersion) ||
    manifestVersion <= 0 ||
    !pluginId ||
    !isSafePluginId(pluginId) ||
    !name ||
    !version ||
    value.pluginType !== 'native' ||
    !entry
  ) {
    return null;
  }

  if (value.capabilities !== undefined && !Array.isArray(value.capabilities)) {
    return null;
  }

  const rawCapabilities = Array.isArray(value.capabilities)
    ? value.capabilities
    : [];

  if (!rawCapabilities.every(isPluginCapability)) {
    return null;
  }

  return {
    manifestVersion,
    pluginId,
    name,
    version,
    author: asString(value.author).trim(),
    description: asString(value.description).trim(),
    pluginType: 'native',
    platform: asString(value.platform).trim() || undefined,
    arch: asString(value.arch).trim() || undefined,
    entry,
    capabilities: rawCapabilities,
    enabled: typeof value.enabled === 'boolean' ? value.enabled : false,
    abi: normalizeNativeAbi(value.abi),
  };
}

const DESKTOP_PLUGIN_UNAVAILABLE_ERROR = '桌面插件仅在桌面端可用';

export async function getDesktopPluginDir() {
  if (!isTauriDesktopRuntime()) {
    return '';
  }

  return invokeTauriDesktopCommand<string>(
    DESKTOP_PLUGIN_COMMANDS.getDesktopPluginDir,
  );
}

export async function listDesktopPlugins() {
  if (!isTauriDesktopRuntime()) {
    return {
      pluginDir: '',
      plugins: [],
      invalidPlugins: [],
      isAvailable: false,
    };
  }

  return invokeTauriDesktopCommand<DesktopPluginListResult>(
    DESKTOP_PLUGIN_COMMANDS.listDesktopPlugins,
  );
}

export async function readLocalNativeManifestText() {
  const file = await selectLocalFile('.json,application/json');

  if (!file) {
    return null;
  }

  return file.text();
}

export async function installDesktopPluginManifest(
  rawManifest: string,
  overwrite: boolean,
) {
  if (!isTauriDesktopRuntime()) {
    throw new Error(DESKTOP_PLUGIN_UNAVAILABLE_ERROR);
  }

  return invokeTauriDesktopCommand<NativeDesktopPluginManifest>(
    DESKTOP_PLUGIN_COMMANDS.installDesktopPluginManifest,
    { rawManifest, overwrite },
  );
}

export async function setDesktopPluginEnabled(
  pluginId: string,
  enabled: boolean,
) {
  if (!isTauriDesktopRuntime()) {
    throw new Error(DESKTOP_PLUGIN_UNAVAILABLE_ERROR);
  }

  return invokeTauriDesktopCommand<NativeDesktopPluginManifest>(
    DESKTOP_PLUGIN_COMMANDS.setDesktopPluginEnabled,
    { pluginId, enabled },
  );
}

export async function uninstallDesktopPlugin(pluginId: string) {
  if (!isTauriDesktopRuntime()) {
    throw new Error(DESKTOP_PLUGIN_UNAVAILABLE_ERROR);
  }

  return invokeTauriDesktopCommand<void>(
    DESKTOP_PLUGIN_COMMANDS.uninstallDesktopPlugin,
    { pluginId },
  );
}
