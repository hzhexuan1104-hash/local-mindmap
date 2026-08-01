import type { MindmapNode } from './types';

export type NodePosition = NonNullable<MindmapNode['position']>;

export function updateNodePositionById(
  node: MindmapNode,
  nodeId: string,
  position: NodePosition,
): MindmapNode {
  return updateNodePositionsById(node, new Map([[nodeId, position]]));
}

export function updateNodePositionsById(
  node: MindmapNode,
  positionsByNodeId: ReadonlyMap<string, NodePosition>,
): MindmapNode {
  const nextPosition = positionsByNodeId.get(node.id);
  const nextChildren = node.children.map((child) =>
    updateNodePositionsById(child, positionsByNodeId),
  );
  const childrenChanged = nextChildren.some(
    (child, index) => child !== node.children[index],
  );

  if (!nextPosition && !childrenChanged) {
    return node;
  }

  return {
    ...node,
    ...(nextPosition ? { position: { ...nextPosition } } : {}),
    ...(childrenChanged ? { children: nextChildren } : {}),
  };
}
