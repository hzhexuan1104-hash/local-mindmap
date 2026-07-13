import { readUserJson, USER_DATA_PATHS, writeUserJson } from '../storage/userDataStorage';
import { normalizeCommandHistory, normalizeFavoriteCommandIds } from './commandHistory';
import type { CommandUsage } from './commandTypes';

export type CommandPaletteSettings = {
  shortcutEnabled: boolean;
  showRecentCommands: boolean;
  showRecentFiles: boolean;
  showNodeResults: boolean;
  showPluginCommands: boolean;
  closeAfterExecute: boolean;
  recentCommands: CommandUsage[];
  favoriteCommandIds: string[];
};

export const DEFAULT_COMMAND_PALETTE_SETTINGS: CommandPaletteSettings = {
  shortcutEnabled: true,
  showRecentCommands: true,
  showRecentFiles: true,
  showNodeResults: true,
  showPluginCommands: true,
  closeAfterExecute: true,
  recentCommands: [],
  favoriteCommandIds: [],
};

export function normalizeCommandPaletteSettings(value: unknown): CommandPaletteSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ...DEFAULT_COMMAND_PALETTE_SETTINGS };
  }
  const item = value as Partial<CommandPaletteSettings>;
  const boolean = <K extends keyof CommandPaletteSettings>(key: K) =>
    typeof item[key] === 'boolean'
      ? (item[key] as boolean)
      : (DEFAULT_COMMAND_PALETTE_SETTINGS[key] as boolean);
  return {
    shortcutEnabled: boolean('shortcutEnabled'),
    showRecentCommands: boolean('showRecentCommands'),
    showRecentFiles: boolean('showRecentFiles'),
    showNodeResults: boolean('showNodeResults'),
    showPluginCommands: boolean('showPluginCommands'),
    closeAfterExecute: boolean('closeAfterExecute'),
    recentCommands: normalizeCommandHistory(item.recentCommands),
    favoriteCommandIds: normalizeFavoriteCommandIds(item.favoriteCommandIds),
  };
}

export async function loadCommandPaletteSettings() {
  return normalizeCommandPaletteSettings(
    await readUserJson(USER_DATA_PATHS.commandPaletteSettings, DEFAULT_COMMAND_PALETTE_SETTINGS),
  );
}

export async function saveCommandPaletteSettings(settings: CommandPaletteSettings) {
  await writeUserJson(USER_DATA_PATHS.commandPaletteSettings, normalizeCommandPaletteSettings(settings));
}
