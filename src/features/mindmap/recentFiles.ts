import {
  LEGACY_STORAGE_KEYS,
  readUserJson,
  USER_DATA_PATHS,
  writeUserJson,
} from '../storage/userDataStorage';

export type RecentFileEntry = {
  path: string;
  name: string;
  lastOpenedAt?: string;
  lastSavedAt?: string;
};

function fileNameFromPath(path: string) {
  return path.split(/[\\/]/).pop() || path;
}

export function normalizeRecentFiles(value: unknown): RecentFileEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item): RecentFileEntry | null => {
      if (typeof item === 'string' && item) {
        return { path: item, name: fileNameFromPath(item) };
      }
      if (
        typeof item === 'object' &&
        item !== null &&
        'path' in item &&
        typeof item.path === 'string' &&
        item.path
      ) {
        const entry = item as Partial<RecentFileEntry>;
        return {
          path: item.path,
          name:
            typeof entry.name === 'string' && entry.name
              ? entry.name
              : fileNameFromPath(item.path),
          ...(typeof entry.lastOpenedAt === 'string'
            ? { lastOpenedAt: entry.lastOpenedAt }
            : {}),
          ...(typeof entry.lastSavedAt === 'string'
            ? { lastSavedAt: entry.lastSavedAt }
            : {}),
        };
      }
      return null;
    })
    .filter((entry): entry is RecentFileEntry => Boolean(entry));
}

export async function loadRecentFileEntries() {
  return normalizeRecentFiles(
    await readUserJson<unknown>(
      USER_DATA_PATHS.recentFiles,
      [],
      LEGACY_STORAGE_KEYS.recentFiles,
    ),
  );
}

export async function updateRecentFile(
  current: RecentFileEntry[],
  path: string,
  action: 'open' | 'save',
  now = new Date().toISOString(),
) {
  const previous = current.find((entry) => entry.path === path);
  const nextEntry: RecentFileEntry = {
    path,
    name: fileNameFromPath(path),
    ...(previous?.lastOpenedAt
      ? { lastOpenedAt: previous.lastOpenedAt }
      : {}),
    ...(previous?.lastSavedAt ? { lastSavedAt: previous.lastSavedAt } : {}),
    ...(action === 'open' ? { lastOpenedAt: now } : { lastSavedAt: now }),
  };
  const next = [
    nextEntry,
    ...current.filter((entry) => entry.path !== path),
  ].slice(0, 20);
  await writeUserJson(
    USER_DATA_PATHS.recentFiles,
    next,
    LEGACY_STORAGE_KEYS.recentFiles,
  );
  return next;
}
