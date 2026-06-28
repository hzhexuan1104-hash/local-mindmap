import type { MindmapNode, MindmapNodeType } from './types';
import {
  createNodeTypePack,
  importNodeTypesFromPack,
  normalizeImportedNodeType,
  parseNodeTypePack,
  type NodeTypePack,
} from './nodeTypePacks';
import {
  isDesktopRuntime,
  isDirectUserJsonFile,
  listUserFiles,
  loadUserNodeTypes,
  readUserJson,
  saveUserNodeTypes,
  USER_DATA_PATHS,
  writeUserJson,
} from '../storage/userDataStorage';

export const NODE_TYPE_ICONS = [
  { value: '✅', label: '✅ 任务' },
  { value: '⭐', label: '⭐ 重点' },
  { value: '⚠️', label: '⚠️ 风险' },
  { value: '💡', label: '💡 想法' },
  { value: '📌', label: '📌 备注' },
  { value: '🧩', label: '🧩 模块' },
];

export const NODE_TYPE_SHAPES = [
  { value: 'rounded', label: 'rounded 圆角矩形' },
  { value: 'rectangle', label: 'rectangle 矩形' },
  { value: 'pill', label: 'pill 胶囊形' },
  { value: 'diamond', label: 'diamond 菱形' },
] as const;

export type NodeTypeDraft = {
  name: string;
  icon: string;
  shape: MindmapNodeType['shape'];
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  fontSize: number;
  bold: boolean;
  defaultText: string;
  defaultRemark: string;
};

export const createEmptyNodeTypeDraft = (): NodeTypeDraft => ({
  name: '',
  icon: '✅',
  shape: 'rounded',
  backgroundColor: '#fff7e8',
  borderColor: '#f59f00',
  textColor: '#14315f',
  fontSize: 18,
  bold: true,
  defaultText: '新节点',
  defaultRemark: '',
});

export function createMindmapNodeType(
  draft: NodeTypeDraft,
): MindmapNodeType | null {
  const name = draft.name.trim();

  if (!name) {
    return null;
  }

  return {
    id: crypto.randomUUID(),
    name,
    icon: draft.icon || '✅',
    shape: draft.shape || 'rounded',
    backgroundColor: draft.backgroundColor || '#eef5ff',
    borderColor: draft.borderColor || '#1f6feb',
    textColor: draft.textColor || '#14315f',
    fontSize:
      Number.isFinite(draft.fontSize) && draft.fontSize > 0
        ? draft.fontSize
        : 18,
    bold: Boolean(draft.bold),
    defaultText: draft.defaultText.trim() || '新节点',
    defaultRemark: draft.defaultRemark,
  };
}

export function findNodeTypeById(
  nodeTypes: MindmapNodeType[],
  nodeTypeId?: string,
) {
  return nodeTypes.find((nodeType) => nodeType.id === nodeTypeId) ?? null;
}

export function createNodeFromType(nodeType?: MindmapNodeType | null): MindmapNode {
  return {
    id: crypto.randomUUID(),
    text: nodeType?.defaultText || '新节点',
    remark: nodeType?.defaultRemark || '',
    ...(nodeType ? { nodeTypeId: nodeType.id } : {}),
    children: [],
  };
}

export function normalizeUserNodeTypes(value: unknown): MindmapNodeType[] {
  return Array.isArray(value)
    ? value
        .map(normalizeImportedNodeType)
        .filter((nodeType): nodeType is MindmapNodeType => Boolean(nodeType))
    : [];
}

export async function loadLocalNodeTypes(): Promise<MindmapNodeType[]> {
  const nodeTypes = normalizeUserNodeTypes(await loadUserNodeTypes());
  console.info('[user-data][node-types] custom node types normalized', {
    desktop: isDesktopRuntime(),
    count: nodeTypes.length,
    names: nodeTypes.map((nodeType) => nodeType.name),
  });
  return nodeTypes;
}

export async function saveLocalNodeTypes(nodeTypes: MindmapNodeType[]) {
  await saveUserNodeTypes(nodeTypes);
}

export async function loadStoredNodeTypePacks(): Promise<NodeTypePack[]> {
  const files = await listUserFiles(USER_DATA_PATHS.nodeTypePacks);
  const packFiles = files.filter((path) =>
    isDirectUserJsonFile(path, USER_DATA_PATHS.nodeTypePacks),
  );
  const packs: NodeTypePack[] = [];

  for (const file of packFiles) {
    const value = await readUserJson<unknown | null>(file, null);
    if (value === null) {
      continue;
    }
    try {
      packs.push(parseNodeTypePack(JSON.stringify(value)));
    } catch (error) {
      console.error('[user-data][node-types] node type pack ignored', {
        file,
        error,
      });
    }
  }

  console.info('[user-data][node-types] packs loaded', {
    desktop: isDesktopRuntime(),
    fileCount: packFiles.length,
    packCount: packs.length,
  });
  return packs;
}

export async function saveImportedNodeTypePack(pack: NodeTypePack) {
  const safeName =
    pack.meta.name
      .trim()
      .replace(/[^A-Za-z0-9\u4e00-\u9fff._-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'node-types';
  const suffix = new Date().toISOString().replace(/[:.]/g, '-');
  const relativePath = `${USER_DATA_PATHS.nodeTypePacks}/${safeName}-${suffix}.json`;
  await writeUserJson(relativePath, pack);
  return relativePath;
}

export async function loadAllUserNodeTypes() {
  let nodeTypes = await loadLocalNodeTypes();
  const packs = await loadStoredNodeTypePacks();
  for (const pack of packs) {
    nodeTypes = importNodeTypesFromPack(nodeTypes, pack).nodeTypes;
  }
  console.info('[user-data][node-types] final user node types', {
    desktop: isDesktopRuntime(),
    count: nodeTypes.length,
    names: nodeTypes.map((nodeType) => nodeType.name),
  });
  return nodeTypes;
}

export async function mergeWithLocalNodeTypes(nodeTypes: MindmapNodeType[]) {
  return importNodeTypesFromPack(
    nodeTypes,
    createNodeTypePack(await loadAllUserNodeTypes()),
  ).nodeTypes;
}
