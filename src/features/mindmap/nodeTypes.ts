import type { MindmapNode, MindmapNodeType } from './types';
import {
  createNodeTypePack,
  importNodeTypesFromPack,
  normalizeImportedNodeType,
} from './nodeTypePacks';

const LOCAL_NODE_TYPES_STORAGE_KEY = 'local-mindmap.node-types.v1';

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

export function loadLocalNodeTypes(): MindmapNodeType[] {
  const rawValue = window.localStorage.getItem(LOCAL_NODE_TYPES_STORAGE_KEY);

  if (!rawValue) {
    return [];
  }

  try {
    const parsedValue: unknown = JSON.parse(rawValue);

    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue
      .map(normalizeImportedNodeType)
      .filter((nodeType): nodeType is MindmapNodeType => Boolean(nodeType));
  } catch {
    return [];
  }
}

export function saveLocalNodeTypes(nodeTypes: MindmapNodeType[]) {
  window.localStorage.setItem(
    LOCAL_NODE_TYPES_STORAGE_KEY,
    JSON.stringify(nodeTypes),
  );
}

export function mergeWithLocalNodeTypes(nodeTypes: MindmapNodeType[]) {
  return importNodeTypesFromPack(
    nodeTypes,
    createNodeTypePack(loadLocalNodeTypes()),
  ).nodeTypes;
}
