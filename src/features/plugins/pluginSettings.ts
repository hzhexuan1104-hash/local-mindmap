import {
  readUserJson,
  USER_DATA_PATHS,
  writeUserJson,
} from '../storage/userDataStorage';

export type PluginSettings = {
  scriptRunnerEnabled: boolean;
  externalRunnerEnabled: boolean;
  pythonPath: string;
};

export const DEFAULT_PLUGIN_SETTINGS: PluginSettings = {
  scriptRunnerEnabled: false,
  externalRunnerEnabled: false,
  pythonPath: 'python',
};

export function normalizePluginSettings(value: unknown): PluginSettings {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { ...DEFAULT_PLUGIN_SETTINGS };
  }
  const settings = value as {
    scriptRunnerEnabled?: unknown;
    externalRunnerEnabled?: unknown;
    pythonPath?: unknown;
  };
  return {
    scriptRunnerEnabled:
      typeof settings.scriptRunnerEnabled === 'boolean'
        ? settings.scriptRunnerEnabled
        : false,
    externalRunnerEnabled:
      typeof settings.externalRunnerEnabled === 'boolean'
        ? settings.externalRunnerEnabled
        : false,
    pythonPath:
      typeof settings.pythonPath === 'string' && settings.pythonPath.trim()
        ? settings.pythonPath.trim()
        : DEFAULT_PLUGIN_SETTINGS.pythonPath,
  };
}

export async function loadPluginSettings() {
  const value = await readUserJson<unknown>(
    USER_DATA_PATHS.pluginSettings,
    DEFAULT_PLUGIN_SETTINGS,
  );
  return normalizePluginSettings(value);
}

export async function savePluginSettings(settings: PluginSettings) {
  await writeUserJson(
    USER_DATA_PATHS.pluginSettings,
    normalizePluginSettings(settings),
  );
}
