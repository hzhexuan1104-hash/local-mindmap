import { parseLmindProject } from './openMindmap';
import type { LmindDocument, MindmapNode } from './types';
import {
  deleteUserFile,
  listUserFiles,
  readUserJson,
  readUserText,
  USER_DATA_PATHS,
  writeUserJson,
} from '../storage/userDataStorage';
import { compareIsoDateTimesDesc } from './timeFormat';

export const AUTO_SAVE_INTERVAL_OPTIONS = [
  { label: '10 秒', value: 10_000 },
  { label: '30 秒', value: 30_000 },
  { label: '1 分钟', value: 60_000 },
  { label: '5 分钟', value: 300_000 },
] as const;

export type FileReliabilitySettings = {
  autoSaveEnabled: boolean;
  autoSaveIntervalMs: number;
  backupBeforeSaveEnabled: boolean;
  maxBackupsPerFile: number;
};

export const DEFAULT_FILE_RELIABILITY_SETTINGS: FileReliabilitySettings = {
  autoSaveEnabled: true,
  autoSaveIntervalMs: 30_000,
  backupBeforeSaveEnabled: true,
  maxBackupsPerFile: 20,
};

export type VersionSource =
  | 'manual'
  | 'autosave'
  | 'before-save'
  | 'recovery'
  | 'recovery-before-restore';

export type VersionHistoryEntry = {
  id: string;
  source: VersionSource;
  title: string;
  note?: string;
  originalFilePathHash?: string;
  displayFileName: string;
  createdAt: string;
  nodeCount: number;
  rootText: string;
  sizeBytes: number;
  path: string;
};

export type RecoveryDraftEntry = {
  id: string;
  draftId: string;
  title: string;
  displayFileName: string;
  associatedFilePathHash?: string;
  updatedAt: string;
  nodeCount: number;
  rootText: string;
  sizeBytes: number;
  path: string;
};

export type VersionPreview = {
  rootText: string;
  nodeCount: number;
  treeText: string;
};

const VERSION_INDEX_PATH = `${USER_DATA_PATHS.versions}/index.json`;
const AUTOSAVE_INDEX_PATH = `${USER_DATA_PATHS.autosaves}/index.json`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeInterval(value: unknown) {
  return AUTO_SAVE_INTERVAL_OPTIONS.some((option) => option.value === value)
    ? (value as FileReliabilitySettings['autoSaveIntervalMs'])
    : DEFAULT_FILE_RELIABILITY_SETTINGS.autoSaveIntervalMs;
}

/** Returns the validated millisecond delay used by the autosave scheduler. */
export function getAutoSaveDelayMs(
  settings: Pick<FileReliabilitySettings, 'autoSaveIntervalMs'>,
) {
  return normalizeInterval(settings.autoSaveIntervalMs);
}

export function normalizeFileReliabilitySettings(
  value: unknown,
): FileReliabilitySettings {
  if (!isRecord(value)) {
    return DEFAULT_FILE_RELIABILITY_SETTINGS;
  }

  const maxBackups =
    typeof value.maxBackupsPerFile === 'number' &&
    Number.isFinite(value.maxBackupsPerFile)
      ? Math.round(value.maxBackupsPerFile)
      : DEFAULT_FILE_RELIABILITY_SETTINGS.maxBackupsPerFile;

  return {
    autoSaveEnabled:
      typeof value.autoSaveEnabled === 'boolean'
        ? value.autoSaveEnabled
        : DEFAULT_FILE_RELIABILITY_SETTINGS.autoSaveEnabled,
    autoSaveIntervalMs: getAutoSaveDelayMs({
      autoSaveIntervalMs: value.autoSaveIntervalMs as number,
    }),
    backupBeforeSaveEnabled:
      typeof value.backupBeforeSaveEnabled === 'boolean'
        ? value.backupBeforeSaveEnabled
        : DEFAULT_FILE_RELIABILITY_SETTINGS.backupBeforeSaveEnabled,
    maxBackupsPerFile: Math.min(200, Math.max(1, maxBackups)),
  };
}

export async function loadFileReliabilitySettings() {
  return normalizeFileReliabilitySettings(
    await readUserJson<unknown>(
      USER_DATA_PATHS.fileReliabilitySettings,
      DEFAULT_FILE_RELIABILITY_SETTINGS,
    ),
  );
}

export async function saveFileReliabilitySettings(
  settings: FileReliabilitySettings,
) {
  await writeUserJson(
    USER_DATA_PATHS.fileReliabilitySettings,
    normalizeFileReliabilitySettings(settings),
  );
}

export function createDraftId() {
  const randomId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return randomId.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 64);
}

export function createFilePathHash(path: string | null | undefined) {
  if (!path) {
    return undefined;
  }
  let hash = 2166136261;
  for (const character of path) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function fileNameFromPath(path: string | null | undefined) {
  return path?.split(/[\\/]/).pop() || '未命名导图';
}

export function maskUserDataPath(path: string | null | undefined, userDataDir = '') {
  if (!path) {
    return '未绑定真实文件';
  }
  const normalizedRoot = userDataDir.replace(/\\/g, '/').replace(/\/+$/, '');
  const normalizedPath = path.replace(/\\/g, '/');
  if (normalizedRoot && normalizedPath.startsWith(normalizedRoot)) {
    return normalizedPath.replace(normalizedRoot, '<USER_DATA_DIR>');
  }
  return fileNameFromPath(path);
}

export function countNodes(node: MindmapNode): number {
  return 1 + node.children.reduce((sum, child) => sum + countNodes(child), 0);
}

function parseDocumentText(documentText: string): LmindDocument {
  const document = JSON.parse(documentText) as LmindDocument;
  if (!isRecord(document) || !isRecord(document.rootNode)) {
    throw new Error('Invalid lmind document');
  }
  return document;
}

function createEntryStats(documentText: string) {
  const project = parseLmindProject(documentText);
  const rootText = project.rootNode.text || '未命名导图';
  return {
    nodeCount: countNodes(project.rootNode),
    rootText,
    sizeBytes: new TextEncoder().encode(documentText).byteLength,
  };
}

function normalizeVersionEntries(value: unknown): VersionHistoryEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter(isRecord)
    .filter((entry): entry is VersionHistoryEntry => {
      return (
        typeof entry.id === 'string' &&
        typeof entry.path === 'string' &&
        typeof entry.createdAt === 'string' &&
        typeof entry.source === 'string'
      );
    });
}

function normalizeRecoveryDraftEntries(value: unknown): RecoveryDraftEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter(isRecord)
    .filter((entry): entry is RecoveryDraftEntry => {
      return (
        typeof entry.id === 'string' &&
        typeof entry.draftId === 'string' &&
        typeof entry.path === 'string' &&
        typeof entry.updatedAt === 'string'
      );
    });
}

export async function loadVersionHistory() {
  return normalizeVersionEntries(await readUserJson(VERSION_INDEX_PATH, []))
    .slice()
    .sort((a, b) => compareIsoDateTimesDesc(a.createdAt, b.createdAt));
}

export async function loadRecoveryDrafts() {
  const indexed = normalizeRecoveryDraftEntries(
    await readUserJson(AUTOSAVE_INDEX_PATH, []),
  );
  if (indexed.length > 0) {
    return indexed.sort((a, b) => compareIsoDateTimesDesc(a.updatedAt, b.updatedAt));
  }

  const files = await listUserFiles(USER_DATA_PATHS.autosaves);
  return files
    .filter((path) => /draft-.+\.lmind$/i.test(path))
    .map((path) => {
      const draftId = path.match(/draft-(.+)\.lmind$/i)?.[1] ?? createDraftId();
      return {
        id: draftId,
        draftId,
        title: `草稿 ${draftId.slice(0, 8)}`,
        displayFileName: `draft-${draftId}.lmind`,
        updatedAt: new Date(0).toISOString(),
        nodeCount: 0,
        rootText: '草稿',
        sizeBytes: 0,
        path,
      };
    });
}

export async function saveAutosaveDraft(options: {
  draftId: string;
  documentText: string;
  title?: string;
  currentFilePath?: string | null;
  currentFileName?: string | null;
  updatedAt?: string;
}) {
  const updatedAt = options.updatedAt ?? new Date().toISOString();
  const draftId = options.draftId || createDraftId();
  const path = `${USER_DATA_PATHS.autosaves}/draft-${draftId}.lmind`;
  const document = parseDocumentText(options.documentText);
  await writeUserJson(path, document);

  const stats = createEntryStats(options.documentText);
  const entry: RecoveryDraftEntry = {
    id: draftId,
    draftId,
    title: options.title || stats.rootText || '未命名导图',
    displayFileName:
      options.currentFileName || fileNameFromPath(options.currentFilePath) || '未命名导图',
    associatedFilePathHash: createFilePathHash(options.currentFilePath),
    updatedAt,
    ...stats,
    path,
  };
  const existing = normalizeRecoveryDraftEntries(
    await readUserJson(AUTOSAVE_INDEX_PATH, []),
  );
  await writeUserJson(AUTOSAVE_INDEX_PATH, [
    entry,
    ...existing.filter((item) => item.draftId !== draftId),
  ]);
  return entry;
}

export async function readUserLmindProject(relativePath: string) {
  return parseLmindProject(await readUserText(relativePath));
}

export async function readUserLmindText(relativePath: string) {
  return readUserText(relativePath);
}

export async function deleteRecoveryDraft(draftId: string) {
  const entries = normalizeRecoveryDraftEntries(
    await readUserJson(AUTOSAVE_INDEX_PATH, []),
  );
  const entry = entries.find((item) => item.draftId === draftId);
  if (entry) {
    await deleteUserFile(entry.path);
  }
  await writeUserJson(
    AUTOSAVE_INDEX_PATH,
    entries.filter((item) => item.draftId !== draftId),
  );
}

export async function createVersionSnapshot(options: {
  documentText: string;
  source: VersionSource;
  note?: string;
  currentFilePath?: string | null;
  currentFileName?: string | null;
  title?: string;
  createdAt?: string;
}) {
  const createdAt = options.createdAt ?? new Date().toISOString();
  const id = `${options.source}-${createdAt.replace(/[:.]/g, '-')}-${createDraftId().slice(0, 8)}`;
  const path = `${USER_DATA_PATHS.versions}/version-${id}.lmind`;
  const document = parseDocumentText(options.documentText);
  await writeUserJson(path, document);
  const stats = createEntryStats(options.documentText);
  const entry: VersionHistoryEntry = {
    id,
    source: options.source,
    title:
      options.title ||
      (options.source === 'manual' ? options.note || '手动快照' : stats.rootText),
    ...(options.note ? { note: options.note } : {}),
    originalFilePathHash: createFilePathHash(options.currentFilePath),
    displayFileName:
      options.currentFileName || fileNameFromPath(options.currentFilePath) || '未命名导图',
    createdAt,
    ...stats,
    path,
  };
  const existing = normalizeVersionEntries(await readUserJson(VERSION_INDEX_PATH, []));
  await writeUserJson(VERSION_INDEX_PATH, [entry, ...existing]);
  return entry;
}

export async function deleteVersionSnapshot(id: string) {
  const entries = normalizeVersionEntries(await readUserJson(VERSION_INDEX_PATH, []));
  const entry = entries.find((item) => item.id === id);
  if (entry) {
    await deleteUserFile(entry.path);
  }
  await writeUserJson(
    VERSION_INDEX_PATH,
    entries.filter((item) => item.id !== id),
  );
}

function treePreview(node: MindmapNode, depth = 0, maxDepth = 3): string[] {
  const prefix = `${'  '.repeat(depth)}- `;
  if (depth >= maxDepth) {
    return [`${prefix}...`];
  }
  return [
    `${prefix}${node.text || '未命名节点'}`,
    ...node.children.slice(0, 8).flatMap((child) => treePreview(child, depth + 1, maxDepth)),
    ...(node.children.length > 8 ? [`${'  '.repeat(depth + 1)}- ...`] : []),
  ];
}

export async function previewVersionSnapshot(entry: VersionHistoryEntry) {
  const project = await readUserLmindProject(entry.path);
  return {
    rootText: project.rootNode.text,
    nodeCount: countNodes(project.rootNode),
    treeText: treePreview(project.rootNode).join('\n'),
  } satisfies VersionPreview;
}

export function versionSourceLabel(source: VersionSource) {
  const labels: Record<VersionSource, string> = {
    manual: '手动',
    autosave: '自动保存',
    'before-save': '保存前备份',
    recovery: '恢复',
    'recovery-before-restore': '恢复前',
  };
  return labels[source];
}
