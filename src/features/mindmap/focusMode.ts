import type { MindmapNode } from './types';
import type { MindmapIndex } from './mindmapIndex';

export function getFocusedRoot(rootNode: MindmapNode, index: MindmapIndex, focusedRootId: string | null) {
  return focusedRootId ? index.nodeById.get(focusedRootId) ?? rootNode : rootNode;
}

export function getFocusBreadcrumb(index: MindmapIndex, nodeId: string | null) {
  if (!nodeId || !index.nodeById.has(nodeId)) return [];
  return [...(index.ancestorIds.get(nodeId) ?? []), nodeId].map((id) => index.nodeById.get(id)!);
}
