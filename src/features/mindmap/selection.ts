import type { MindmapNode } from './types';

export function updateSelection(
  currentSelectedIds: string[],
  nodeId: string,
  options: { append: boolean },
) {
  if (!options.append) {
    return [nodeId];
  }

  if (currentSelectedIds.includes(nodeId)) {
    return currentSelectedIds.filter((id) => id !== nodeId);
  }

  return [...currentSelectedIds, nodeId];
}

export function getDeletableSelectedNodeIds(
  selectedNodeIds: string[],
  rootNodeId: string,
) {
  return selectedNodeIds.filter((nodeId) => nodeId !== rootNodeId);
}

export function deleteNodesByIds(
  node: MindmapNode,
  deletedNodeIds: Set<string>,
): MindmapNode {
  return {
    ...node,
    children: node.children
      .filter((child) => !deletedNodeIds.has(child.id))
      .map((child) => deleteNodesByIds(child, deletedNodeIds)),
  };
}

export function applyNodeTypeToNodes(
  node: MindmapNode,
  selectedNodeIds: Set<string>,
  nodeTypeId: string,
): MindmapNode {
  return {
    ...node,
    ...(selectedNodeIds.has(node.id)
      ? nodeTypeId
        ? { nodeTypeId }
        : { nodeTypeId: undefined }
      : {}),
    children: node.children.map((child) =>
      applyNodeTypeToNodes(child, selectedNodeIds, nodeTypeId),
    ),
  };
}
