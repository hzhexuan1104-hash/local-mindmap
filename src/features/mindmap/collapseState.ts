import type { MindmapNode } from './types';
import type { MindmapIndex } from './mindmapIndex';

export function setCollapsed(node: MindmapNode, nodeId: string, collapsed: boolean): MindmapNode {
  if (node.id === nodeId) return { ...node, collapsed: node.children.length > 0 ? collapsed : false };
  return { ...node, children: node.children.map((child) => setCollapsed(child, nodeId, collapsed)) };
}

export function setAllCollapsed(node: MindmapNode, collapsed: boolean): MindmapNode {
  return { ...node, collapsed: node.children.length > 0 ? collapsed : false, children: node.children.map((child) => setAllCollapsed(child, collapsed)) };
}

export function expandToDepth(node: MindmapNode, maxDepth: number, depth = 0): MindmapNode {
  return { ...node, collapsed: node.children.length > 0 ? depth >= maxDepth : false, children: node.children.map((child) => expandToDepth(child, maxDepth, depth + 1)) };
}

export function expandAncestors(node: MindmapNode, nodeId: string, index: MindmapIndex): MindmapNode {
  const ancestors = new Set(index.ancestorIds.get(nodeId) ?? []);
  const visit = (current: MindmapNode): MindmapNode => ({
    ...current,
    ...(ancestors.has(current.id) ? { collapsed: false } : {}),
    children: current.children.map(visit),
  });
  return visit(node);
}
