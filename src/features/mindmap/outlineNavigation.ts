import type { MindmapIndex } from './mindmapIndex';

export type OutlineRow = { id: string; depth: number; hasChildren: boolean; collapsed: boolean; childCount: number; hasRemark: boolean };

export function createOutlineRows(index: MindmapIndex, expandedIds?: Set<string>) {
  const rows: OutlineRow[] = [];
  index.flattenedNodeIds.forEach((id) => {
    const node = index.nodeById.get(id)!;
    const ancestors = index.ancestorIds.get(id) ?? [];
    if (ancestors.some((ancestorId) => {
      const ancestor = index.nodeById.get(ancestorId)!;
      return expandedIds ? !expandedIds.has(ancestorId) : ancestor.collapsed;
    })) return;
    rows.push({ id, depth: index.depthById.get(id) ?? 0, hasChildren: node.children.length > 0, collapsed: expandedIds ? !expandedIds.has(id) : Boolean(node.collapsed), childCount: index.descendantCount.get(id) ?? 0, hasRemark: Boolean(node.remark.trim()) });
  });
  return rows;
}

export function getVirtualRows<T>(rows: T[], scrollTop: number, viewportHeight: number, rowHeight = 32, overscan = 5) {
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const end = Math.min(rows.length, Math.ceil((scrollTop + viewportHeight) / rowHeight) + overscan);
  return { start, end, offsetTop: start * rowHeight, totalHeight: rows.length * rowHeight, rows: rows.slice(start, end) };
}
