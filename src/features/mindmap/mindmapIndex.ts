import type { MindmapNode } from './types';

/** Runtime-only indexes for a mind map. Never persist these values in .lmind. */
export type MindmapIndex = {
  nodeById: Map<string, MindmapNode>;
  parentById: Map<string, string | null>;
  childrenById: Map<string, string[]>;
  depthById: Map<string, number>;
  ancestorIds: Map<string, string[]>;
  descendantCount: Map<string, number>;
  flattenedNodeIds: string[];
};

export function createMindmapIndex(rootNode: MindmapNode): MindmapIndex {
  const nodeById = new Map<string, MindmapNode>();
  const parentById = new Map<string, string | null>();
  const childrenById = new Map<string, string[]>();
  const depthById = new Map<string, number>();
  const ancestorIds = new Map<string, string[]>();
  const descendantCount = new Map<string, number>();
  const flattenedNodeIds: string[] = [];

  const visit = (node: MindmapNode, parentId: string | null, depth: number, ancestors: string[]) => {
    nodeById.set(node.id, node);
    parentById.set(node.id, parentId);
    childrenById.set(node.id, node.children.map((child) => child.id));
    depthById.set(node.id, depth);
    ancestorIds.set(node.id, ancestors);
    flattenedNodeIds.push(node.id);
    let count = 0;
    node.children.forEach((child) => {
      count += visit(child, node.id, depth + 1, [...ancestors, node.id]) + 1;
    });
    descendantCount.set(node.id, count);
    return count;
  };

  visit(rootNode, null, 0, []);
  return { nodeById, parentById, childrenById, depthById, ancestorIds, descendantCount, flattenedNodeIds };
}

export function isNodeInSubtree(index: MindmapIndex, nodeId: string, rootId: string) {
  return nodeId === rootId || index.ancestorIds.get(nodeId)?.includes(rootId) === true;
}

export function getSubtreeNodeIds(index: MindmapIndex, rootId: string) {
  return index.flattenedNodeIds.filter((nodeId) => isNodeInSubtree(index, nodeId, rootId));
}
