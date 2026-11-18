import {
  createMindmapLayout,
  LAYOUT_DENSITY_CONFIG,
  POSITIONED_LAYOUT,
  type LayoutDensity,
  type MindmapLayoutNode,
} from './layout';
import { updateNodePositionsById, type NodePosition } from './nodePositions';
import type { MindmapNode, MindmapNodeType } from './types';

export type NodeInsertionKind = 'child' | 'sibling' | 'parent';
type Box = Pick<MindmapLayoutNode, 'x' | 'y' | 'width' | 'height'>;

function hasVisiblePosition(node: MindmapNode): boolean {
  return Boolean(node.position || (!node.collapsed && node.children.some(hasVisiblePosition)));
}

function nearestOpenY(box: Box, occupied: readonly Box[], gap: number, searchAbove: boolean) {
  // Each obstacle rules out a vertical interval for the new node's top edge.
  const intervals = occupied
    .filter((other) => box.x < other.x + other.width + gap && box.x + box.width + gap > other.x)
    .map((other) => ({ start: other.y - box.height - gap, end: other.y + other.height + gap }))
    .sort((a, b) => a.start - b.start);
  let below = box.y;
  for (const { start, end } of intervals) {
    if (below <= start) break;
    below = Math.max(below, end);
  }
  if (!searchAbove || below === box.y) return below;
  let above = box.y;
  for (let index = intervals.length - 1; index >= 0; index -= 1) {
    const { start, end } = intervals[index];
    if (above > start && above < end) above = start;
  }
  return box.y - above < below - box.y ? above : below;
}

function overlaps(a: Box, b: Box) {
  return a.x < b.x + b.width && a.x + a.width > b.x &&
    a.y < b.y + b.height && a.y + a.height > b.y;
}

/** Place newly inserted nodes in a mixed layout without rewriting existing saved coordinates. */
export function placeInsertedNodes(
  root: MindmapNode,
  visibleRoot: MindmapNode,
  insertedIds: readonly string[],
  kind: NodeInsertionKind,
  nodeTypes: MindmapNodeType[],
  density: LayoutDensity,
): MindmapNode {
  if (!hasVisiblePosition(visibleRoot)) return root;

  const { nodes, lines } = createMindmapLayout(visibleRoot, nodeTypes, density);
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const parentById = new Map(lines.map(({ toNodeId, fromNodeId }) => [toNodeId, fromNodeId]));
  const inserted = new Set(insertedIds);
  const occupied = nodes.filter((node) => !inserted.has(node.id));
  const { levelGap, siblingGap } = LAYOUT_DENSITY_CONFIG[density];
  const positions = new Map<string, NodePosition>();

  // Layout traversal visits siblings in their structural order, even for selections made out of order.
  for (const node of nodes) {
    if (!inserted.has(node.id)) continue;
    const parent = byId.get(parentById.get(node.id) ?? '');
    const index = parent?.node.children.findIndex((child) => child.id === node.id) ?? -1;
    const previous = index > 0 ? byId.get(parent!.node.children[index - 1].id) : undefined;
    const child = kind === 'parent' ? byId.get(node.node.children[0]?.id ?? '') : undefined;
    const followedManualAnchor = parent?.node.position || previous?.node.position || child?.node.position ||
      (previous && positions.has(previous.id));

    if (!followedManualAnchor && !occupied.some((other) => overlaps(node, other))) {
      occupied.push(node);
      continue;
    }

    let { x, y } = node;
    let searchAbove = true;
    if (child) {
      // Use the space between the two existing nodes when it is wide enough.
      if (parent && child.x + child.width <= parent.x) {
        const left = child.x + child.width;
        const room = parent.x - left - node.width;
        x = left + (room >= levelGap ? room / 2 : levelGap);
      } else {
        const left = parent ? parent.x + parent.width : child.x;
        const room = child.x - left - node.width;
        x = room >= levelGap ? left + room / 2 : child.x - node.width - levelGap;
      }
      y = child.y + (child.height - node.height) / 2;
    } else if (parent) {
      x = parent.x + parent.width + levelGap;
      y = parent.y + (parent.height - node.height) / 2;
      if (kind === 'sibling' && previous?.node.position && previous.x + previous.width <= parent.x - levelGap / 2) {
        x = Math.min(previous.x, parent.x - levelGap - node.width);
      }
      if (previous && Math.abs(previous.x - x) <= levelGap / 2) {
        y = previous.y + previous.height + siblingGap;
        searchAbove = false;
      }
    }

    y = nearestOpenY({ ...node, x, y }, occupied, siblingGap, searchAbove);
    const placed = { ...node, x, y };
    byId.set(node.id, placed);
    occupied.push(placed);
    positions.set(node.id, {
      x: x - POSITIONED_LAYOUT.canvasPadding,
      y: y - POSITIONED_LAYOUT.canvasPadding,
    });
  }

  return positions.size ? updateNodePositionsById(root, positions) : root;
}
