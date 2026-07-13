import type { CanvasViewState } from './canvasControls';
import type { MindmapLayoutLine, MindmapLayoutNode } from './layout';

export type WorldViewport = { left: number; top: number; width: number; height: number };
export type NodeBounds = Pick<MindmapLayoutNode, 'id' | 'x' | 'y' | 'width' | 'height'>;

export function getWorldViewport(view: CanvasViewState, viewport: { width: number; height: number }): WorldViewport {
  const scale = Number.isFinite(view.scale) && view.scale > 0 ? view.scale : 1;
  return { left: -view.offsetX / scale, top: -view.offsetY / scale, width: viewport.width / scale, height: viewport.height / scale };
}

export function expandViewport(viewport: WorldViewport, screenOverscan: number, scale: number): WorldViewport {
  const overscan = screenOverscan / Math.max(scale, 0.01);
  return { left: viewport.left - overscan, top: viewport.top - overscan, width: viewport.width + overscan * 2, height: viewport.height + overscan * 2 };
}

export function intersectsNodeBounds(bounds: NodeBounds, viewport: WorldViewport) {
  return bounds.x + bounds.width >= viewport.left && bounds.x <= viewport.left + viewport.width && bounds.y + bounds.height >= viewport.top && bounds.y <= viewport.top + viewport.height;
}

export function getVisibleNodeIds(nodes: NodeBounds[], viewport: WorldViewport, forcedNodeIds: Iterable<string> = []) {
  const ids = new Set<string>();
  nodes.forEach((node) => { if (intersectsNodeBounds(node, viewport)) ids.add(node.id); });
  for (const id of forcedNodeIds) ids.add(id);
  return ids;
}

export function shouldRenderEdge(line: MindmapLayoutLine, visibleNodeIds: Set<string>, nodeIds: { fromId: string; toId: string }, viewport: WorldViewport) {
  if (visibleNodeIds.has(nodeIds.fromId) || visibleNodeIds.has(nodeIds.toId)) return true;
  const left = Math.min(line.from.x, line.to.x); const top = Math.min(line.from.y, line.to.y);
  const bounds = { id: line.id, x: left, y: top, width: Math.abs(line.to.x - line.from.x), height: Math.abs(line.to.y - line.from.y) };
  return intersectsNodeBounds(bounds, viewport);
}
