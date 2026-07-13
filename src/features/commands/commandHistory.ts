import type { CommandUsage } from './commandTypes';

export const MAX_RECENT_COMMANDS = 20;

export function normalizeCommandHistory(value: unknown): CommandUsage[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is CommandUsage => {
      if (!item || typeof item !== 'object') return false;
      const candidate = item as Partial<CommandUsage>;
      return (
        typeof candidate.commandId === 'string' &&
        candidate.commandId.length > 0 &&
        typeof candidate.lastUsedAt === 'string' &&
        typeof candidate.useCount === 'number' &&
        Number.isFinite(candidate.useCount)
      );
    })
    .slice(0, MAX_RECENT_COMMANDS);
}

export function recordCommandUsage(
  history: CommandUsage[],
  commandId: string,
  now = new Date().toISOString(),
) {
  const previous = history.find((item) => item.commandId === commandId);
  return [
    {
      commandId,
      lastUsedAt: now,
      useCount: (previous?.useCount ?? 0) + 1,
    },
    ...history.filter((item) => item.commandId !== commandId),
  ].slice(0, MAX_RECENT_COMMANDS);
}

export function normalizeFavoriteCommandIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(value.filter((item): item is string => typeof item === 'string' && item.length > 0)),
  );
}

export function toggleFavoriteCommand(favorites: string[], commandId: string) {
  return favorites.includes(commandId)
    ? favorites.filter((id) => id !== commandId)
    : [...favorites, commandId];
}
