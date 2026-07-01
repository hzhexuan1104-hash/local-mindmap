import {
  readUserJson,
  USER_DATA_PATHS,
  writeUserJson,
} from '../storage/userDataStorage';

export type PluginSettings = {
  scriptRunnerEnabled: boolean;
};

export const DEFAULT_PLUGIN_SETTINGS: PluginSettings = {
  scriptRunnerEnabled: false,
};

export function normalizePluginSettings(value: unknown): PluginSettings {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value) ||
    typeof (value as { scriptRunnerEnabled?: unknown }).scriptRunnerEnabled !==
      'boolean'
  ) {
    return { ...DEFAULT_PLUGIN_SETTINGS };
  }
  return {
    scriptRunnerEnabled: (
      value as { scriptRunnerEnabled: boolean }
    ).scriptRunnerEnabled,
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
