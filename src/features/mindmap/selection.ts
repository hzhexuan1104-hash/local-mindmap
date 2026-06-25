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

export function normalizeSelectionState(input: {
  selectedNodeId: string | null;
  selectedNodeIds: string[];
}) {
  const selectedNodeIds = Array.from(new Set(input.selectedNodeIds));
  let selectedNodeId = input.selectedNodeId;

  if (selectedNodeId && !selectedNodeIds.includes(selectedNodeId)) {
    selectedNodeId = selectedNodeIds[selectedNodeIds.length - 1] ?? null;
  }

  return {
    selectedNodeId,
    selectedNodeIds,
  };
}

export function resolveNodeClickSelection(
  currentSelection: {
    selectedNodeId: string | null;
    selectedNodeIds: string[];
  },
  nodeId: string,
  append: boolean,
) {
  const selectedNodeIds = updateSelection(currentSelection.selectedNodeIds, nodeId, {
    append,
  });
  const clickedNodeIsSelected = selectedNodeIds.includes(nodeId);
  const selectedNodeId = clickedNodeIsSelected
    ? nodeId
    : currentSelection.selectedNodeId;

  return normalizeSelectionState({
    selectedNodeId,
    selectedNodeIds,
  });
}

export function resolveBoxSelectionState(
  currentSelection: {
    selectedNodeId: string | null;
    selectedNodeIds: string[];
  },
  hitNodeIds: string[],
  append: boolean,
) {
  const nextSelectedNodeIds = append
    ? Array.from(new Set([...currentSelection.selectedNodeIds, ...hitNodeIds]))
    : Array.from(new Set(hitNodeIds));

  let nextSelectedNodeId = append
    ? hitNodeIds[hitNodeIds.length - 1] ?? currentSelection.selectedNodeId
    : hitNodeIds[hitNodeIds.length - 1] ?? null;

  return normalizeSelectionState({
    selectedNodeId: nextSelectedNodeId,
    selectedNodeIds: nextSelectedNodeIds,
  });
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
