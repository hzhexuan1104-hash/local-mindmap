import type { MindmapNode, MindmapNodeType } from './types';

export type NodeTypeDraft = {
  name: string;
  backgroundColor: string;
  borderColor: string;
  defaultText: string;
  defaultRemark: string;
};

export const createEmptyNodeTypeDraft = (): NodeTypeDraft => ({
  name: '',
  backgroundColor: '#fff7e8',
  borderColor: '#f59f00',
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
    backgroundColor: draft.backgroundColor || '#eef5ff',
    borderColor: draft.borderColor || '#1f6feb',
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
