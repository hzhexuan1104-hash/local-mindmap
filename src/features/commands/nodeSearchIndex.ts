import type { MindmapIndex } from '../mindmap/mindmapIndex';

export type NodeSearchEntry = {
  nodeId: string;
  title: string;
  path: string;
  depth: number;
  searchText: string;
};

export function createNodeSearchIndex(index: MindmapIndex): NodeSearchEntry[] {
  return index.flattenedNodeIds.map((nodeId) => {
    const node = index.nodeById.get(nodeId)!;
    const path = (index.ancestorIds.get(nodeId) ?? [])
      .map((ancestorId) => index.nodeById.get(ancestorId)?.text)
      .filter((item): item is string => Boolean(item))
      .join(' / ');
    return {
      nodeId,
      title: node.text || '未命名节点',
      path,
      depth: index.depthById.get(nodeId) ?? 0,
      searchText: `${node.text}\n${node.remark ?? ''}`.toLocaleLowerCase(),
    };
  });
}
