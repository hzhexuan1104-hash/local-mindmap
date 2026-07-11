import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  AUTO_SAVE_INTERVAL_OPTIONS,
  DEFAULT_FILE_RELIABILITY_SETTINGS,
  createVersionSnapshot,
  deleteRecoveryDraft,
  deleteVersionSnapshot,
  getAutoSaveDelayMs,
  loadFileReliabilitySettings,
  loadRecoveryDrafts,
  loadVersionHistory,
  normalizeFileReliabilitySettings,
  previewVersionSnapshot,
  saveAutosaveDraft,
  saveFileReliabilitySettings,
} from '../fileReliability';
import {
  compareIsoDateTimesDesc,
  formatLocalDateTime,
  formatRelativeLocalTime,
} from '../timeFormat';
import {
  USER_DATA_COMMANDS,
  setUserDataStorageInvokerForTests,
} from '../../storage/userDataStorage';
import { serializeLmindDocument } from '../saveMindmap';
import type { MindmapNode } from '../types';

const rootNode: MindmapNode = {
  id: 'root',
  text: 'Root',
  remark: '',
  children: [
    {
      id: 'child',
      text: 'Child',
      remark: '',
      children: [],
    },
  ],
};

function installMemoryUserData() {
  const files = new Map<string, unknown>();
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { __TAURI_INTERNALS__: {} },
  });

  setUserDataStorageInvokerForTests(async (command, args) => {
    const relativePath = String(args?.relativePath ?? '');
    if (command === USER_DATA_COMMANDS.readUserJson) {
      return (files.has(relativePath) ? files.get(relativePath) : args?.defaultValue) as never;
    }
    if (command === USER_DATA_COMMANDS.writeUserJson) {
      files.set(relativePath, args?.value);
      return undefined as never;
    }
    if (command === USER_DATA_COMMANDS.readUserText) {
      const value = files.get(relativePath);
      if (value === undefined) {
        throw new Error(`missing ${relativePath}`);
      }
      return JSON.stringify(value) as never;
    }
    if (command === USER_DATA_COMMANDS.listUserFiles) {
      const relativeDir = String(args?.relativeDir ?? '').replace(/\/+$/, '');
      return Array.from(files.keys()).filter((path) =>
        path.startsWith(`${relativeDir}/`),
      ) as never;
    }
    if (command === USER_DATA_COMMANDS.deleteUserFile) {
      return files.delete(relativePath) as never;
    }
    throw new Error(`Unexpected command: ${command}`);
  });

  return files;
}

describe('file reliability settings', () => {
  afterEach(() => {
    setUserDataStorageInvokerForTests(null);
    Reflect.deleteProperty(globalThis, 'window');
  });

  it('falls back to defaults when settings are damaged', () => {
    expect(normalizeFileReliabilitySettings({ autoSaveIntervalMs: 123 })).toEqual(
      DEFAULT_FILE_RELIABILITY_SETTINGS,
    );
  });

  it('defaults autosave to 30 seconds and uses that value for scheduling', () => {
    expect(DEFAULT_FILE_RELIABILITY_SETTINGS.autoSaveIntervalMs).toBe(30_000);
    expect(getAutoSaveDelayMs(DEFAULT_FILE_RELIABILITY_SETTINGS)).toBe(30_000);
  });

  it('persists normalized settings', async () => {
    installMemoryUserData();
    await saveFileReliabilitySettings({
      autoSaveEnabled: false,
      autoSaveIntervalMs: 10_000,
      backupBeforeSaveEnabled: false,
      maxBackupsPerFile: 5,
    });

    await expect(loadFileReliabilitySettings()).resolves.toEqual({
      autoSaveEnabled: false,
      autoSaveIntervalMs: 10_000,
      backupBeforeSaveEnabled: false,
      maxBackupsPerFile: 5,
    });
  });

  it.each(AUTO_SAVE_INTERVAL_OPTIONS)(
    'persists and reloads the $label autosave interval in milliseconds',
    async ({ value }) => {
      installMemoryUserData();
      await saveFileReliabilitySettings({
        ...DEFAULT_FILE_RELIABILITY_SETTINGS,
        autoSaveIntervalMs: value,
      });

      await expect(loadFileReliabilitySettings()).resolves.toMatchObject({
        autoSaveIntervalMs: value,
      });
      expect(getAutoSaveDelayMs({ autoSaveIntervalMs: value })).toBe(value);
    },
  );

  it('keeps the selected interval while autosave is disabled', () => {
    const settings = normalizeFileReliabilitySettings({
      ...DEFAULT_FILE_RELIABILITY_SETTINGS,
      autoSaveEnabled: false,
      autoSaveIntervalMs: 300_000,
    });

    expect(settings).toMatchObject({
      autoSaveEnabled: false,
      autoSaveIntervalMs: 300_000,
    });
  });

  it('falls back to the 30-second scheduler delay for invalid intervals', () => {
    expect(getAutoSaveDelayMs({ autoSaveIntervalMs: 12_345 })).toBe(30_000);
  });
});

describe('file reliability time formatting', () => {
  it('formats UTC ISO timestamps for the local timezone instead of exposing the raw value', () => {
    const iso = '2026-07-11T15:23:59.401Z';

    expect(formatLocalDateTime(iso)).toBe(
      `${new Date(iso).getFullYear()}/${String(new Date(iso).getMonth() + 1).padStart(2, '0')}/${String(new Date(iso).getDate()).padStart(2, '0')} ${String(new Date(iso).getHours()).padStart(2, '0')}:${String(new Date(iso).getMinutes()).padStart(2, '0')}`,
    );
    expect(formatLocalDateTime(iso)).not.toContain(iso);
    expect(formatRelativeLocalTime(iso, new Date(iso))).not.toContain(iso);
  });

  it('uses the unknown-time label for missing or invalid timestamps', () => {
    expect(formatLocalDateTime(undefined)).toBe('时间未知');
    expect(formatLocalDateTime('not-a-date')).toBe('时间未知');
    expect(formatRelativeLocalTime('not-a-date')).not.toContain('Invalid Date');
  });

  it('sorts versions by their persisted timestamps rather than formatted text', () => {
    const entries = [
      { createdAt: '2026-12-01T00:00:00.000Z' },
      { createdAt: '2026-02-01T00:00:00.000Z' },
      { createdAt: '2026-01-01T00:00:00.000Z' },
    ];

    expect(entries.sort((a, b) => compareIsoDateTimesDesc(a.createdAt, b.createdAt))).toEqual([
      { createdAt: '2026-12-01T00:00:00.000Z' },
      { createdAt: '2026-02-01T00:00:00.000Z' },
      { createdAt: '2026-01-01T00:00:00.000Z' },
    ]);
  });
});

describe('autosave drafts and version history', () => {
  const documentText = serializeLmindDocument(rootNode, [], 'default-blue');

  beforeEach(() => {
    installMemoryUserData();
  });

  afterEach(() => {
    setUserDataStorageInvokerForTests(null);
    Reflect.deleteProperty(globalThis, 'window');
  });

  it('saves unnamed mindmaps as stable draft autosaves', async () => {
    const entry = await saveAutosaveDraft({
      draftId: 'draft-1',
      documentText,
      title: 'Draft title',
      updatedAt: '2026-07-11T00:00:00.000Z',
    });

    expect(entry.path).toBe('autosaves/draft-draft-1.lmind');
    expect(entry.nodeCount).toBe(2);
    await expect(loadRecoveryDrafts()).resolves.toMatchObject([
      { draftId: 'draft-1', rootText: 'Root' },
    ]);
  });

  it('deletes only the selected draft from the index', async () => {
    await saveAutosaveDraft({ draftId: 'draft-1', documentText });
    await saveAutosaveDraft({ draftId: 'draft-2', documentText });

    await deleteRecoveryDraft('draft-1');

    await expect(loadRecoveryDrafts()).resolves.toMatchObject([
      { draftId: 'draft-2' },
    ]);
  });

  it('creates, lists, previews, and deletes version snapshots', async () => {
    const entry = await createVersionSnapshot({
      documentText,
      source: 'manual',
      note: 'checkpoint',
      currentFilePath: 'C:/maps/example.lmind',
      currentFileName: 'example.lmind',
      createdAt: '2026-07-11T00:00:00.000Z',
    });

    await expect(loadVersionHistory()).resolves.toMatchObject([
      { id: entry.id, source: 'manual', note: 'checkpoint', nodeCount: 2 },
    ]);
    await expect(previewVersionSnapshot(entry)).resolves.toMatchObject({
      rootText: 'Root',
      nodeCount: 2,
      treeText: expect.stringContaining('Child'),
    });

    await deleteVersionSnapshot(entry.id);
    await expect(loadVersionHistory()).resolves.toEqual([]);
  });

  it('keeps recovery drafts and versions sorted by their stored UTC timestamps', async () => {
    await saveAutosaveDraft({
      draftId: 'older-draft',
      documentText,
      updatedAt: '2026-07-11T00:00:00.000Z',
    });
    await saveAutosaveDraft({
      draftId: 'newer-draft',
      documentText,
      updatedAt: '2026-07-11T02:00:00.000Z',
    });
    await createVersionSnapshot({
      documentText,
      source: 'manual',
      createdAt: '2026-07-11T00:00:00.000Z',
    });
    await createVersionSnapshot({
      documentText,
      source: 'manual',
      createdAt: '2026-07-11T02:00:00.000Z',
    });

    await expect(loadRecoveryDrafts()).resolves.toMatchObject([
      { draftId: 'newer-draft' },
      { draftId: 'older-draft' },
    ]);
    await expect(loadVersionHistory()).resolves.toMatchObject([
      { createdAt: '2026-07-11T02:00:00.000Z' },
      { createdAt: '2026-07-11T00:00:00.000Z' },
    ]);
  });
});
