import type { MindmapNode } from './types';

export type NodePosition = NonNullable<MindmapNode['position']>;

export function updateNodePositionById(
  node: MindmapNode,
  nodeId: string,
  position: NodePosition,
): MindmapNode {
  if (node.id === nodeId) {
    return {
      ...node,
      position: { ...position },
    };
  }

  return {
    ...node,
    children: node.children.map((child) =>
      updateNodePositionById(child, nodeId, position),
    ),
  };
}
