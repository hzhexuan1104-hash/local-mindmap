import type { CSSProperties } from 'react';
import type { MindmapNode } from './types';

const MINDMAP_LAYOUT = {
  canvasPadding: 80,
  childHorizontalGap: 96,
  childVerticalGap: 80,
  nodeMinWidth: 144,
  nodeMaxWidth: 220,
  nodeHeight: 72,
} as const;

export const POSITIONED_LAYOUT = {
  canvasPadding: 96,
  nodeWidth: MINDMAP_LAYOUT.nodeMaxWidth,
  nodeHeight: MINDMAP_LAYOUT.nodeHeight,
  horizontalGap: 180,
  verticalGap: 88,
} as const;

type MindmapLayoutStyle = CSSProperties & {
  '--mindmap-canvas-padding': string;
  '--mindmap-child-horizontal-gap': string;
  '--mindmap-child-vertical-gap': string;
  '--mindmap-node-min-width': string;
  '--mindmap-node-max-width': string;
};

export function createMindmapLayoutStyle(): MindmapLayoutStyle {
  return {
    '--mindmap-canvas-padding': `${MINDMAP_LAYOUT.canvasPadding}px`,
    '--mindmap-child-horizontal-gap': `${MINDMAP_LAYOUT.childHorizontalGap}px`,
    '--mindmap-child-vertical-gap': `${MINDMAP_LAYOUT.childVerticalGap}px`,
    '--mindmap-node-min-width': `${MINDMAP_LAYOUT.nodeMinWidth}px`,
    '--mindmap-node-max-width': `${MINDMAP_LAYOUT.nodeMaxWidth}px`,
  };
}

export type MindmapLayoutNode = {
  id: string;
  node: MindmapNode;
  x: number;
  y: number;
};

export type MindmapLayoutLine = {
  id: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
};

export type MindmapLayoutResult = {
  nodes: MindmapLayoutNode[];
  lines: MindmapLayoutLine[];
  width: number;
  height: number;
};

type AutoLayoutEntry = {
  id: string;
  x: number;
  y: number;
};

function getVisibleChildren(node: MindmapNode) {
  return node.collapsed ? [] : node.children;
}

function measureSubtreeHeight(node: MindmapNode): number {
  const children = getVisibleChildren(node);

  if (children.length === 0) {
    return POSITIONED_LAYOUT.nodeHeight;
  }

  const childrenHeight = children.reduce(
    (sum, child) => sum + measureSubtreeHeight(child),
    0,
  );
  const gaps = POSITIONED_LAYOUT.verticalGap * (children.length - 1);

  return Math.max(POSITIONED_LAYOUT.nodeHeight, childrenHeight + gaps);
}

function buildAutoLayout(
  node: MindmapNode,
  depth: number,
  top: number,
  entries: AutoLayoutEntry[],
): number {
  const subtreeHeight = measureSubtreeHeight(node);
  const nodeY = top + subtreeHeight / 2 - POSITIONED_LAYOUT.nodeHeight / 2;
  const nodeX =
    depth * (POSITIONED_LAYOUT.nodeWidth + POSITIONED_LAYOUT.horizontalGap);

  entries.push({
    id: node.id,
    x: nodeX,
    y: nodeY,
  });

  const children = getVisibleChildren(node);
  let nextTop = top;

  children.forEach((child) => {
    const childHeight = measureSubtreeHeight(child);
    buildAutoLayout(child, depth + 1, nextTop, entries);
    nextTop += childHeight + POSITIONED_LAYOUT.verticalGap;
  });

  return subtreeHeight;
}

function collectVisibleNodes(node: MindmapNode, nodes: MindmapNode[] = []) {
  nodes.push(node);

  getVisibleChildren(node).forEach((child) => collectVisibleNodes(child, nodes));

  return nodes;
}

export function createMindmapLayout(rootNode: MindmapNode): MindmapLayoutResult {
  const autoEntries: AutoLayoutEntry[] = [];
  buildAutoLayout(rootNode, 0, 0, autoEntries);
  const autoPositionById = new Map(
    autoEntries.map((entry) => [entry.id, { x: entry.x, y: entry.y }]),
  );
  const nodes = collectVisibleNodes(rootNode).map((node) => {
    const autoPosition = autoPositionById.get(node.id) ?? { x: 0, y: 0 };

    return {
      id: node.id,
      node,
      x: node.position?.x ?? autoPosition.x,
      y: node.position?.y ?? autoPosition.y,
    };
  });
  const nodeById = new Map(nodes.map((layoutNode) => [layoutNode.id, layoutNode]));
  const lines: MindmapLayoutLine[] = [];

  nodes.forEach((layoutNode) => {
    if (layoutNode.node.collapsed) {
      return;
    }

    layoutNode.node.children.forEach((child) => {
      const childLayoutNode = nodeById.get(child.id);

      if (!childLayoutNode) {
        return;
      }

      lines.push({
        id: `${layoutNode.id}-${child.id}`,
        from: {
          x: layoutNode.x + POSITIONED_LAYOUT.nodeWidth,
          y: layoutNode.y + POSITIONED_LAYOUT.nodeHeight / 2,
        },
        to: {
          x: childLayoutNode.x,
          y: childLayoutNode.y + POSITIONED_LAYOUT.nodeHeight / 2,
        },
      });
    });
  });

  const minX = Math.min(...nodes.map((node) => node.x), 0);
  const minY = Math.min(...nodes.map((node) => node.y), 0);
  const maxX = Math.max(
    ...nodes.map((node) => node.x + POSITIONED_LAYOUT.nodeWidth),
    POSITIONED_LAYOUT.nodeWidth,
  );
  const maxY = Math.max(
    ...nodes.map((node) => node.y + POSITIONED_LAYOUT.nodeHeight),
    POSITIONED_LAYOUT.nodeHeight,
  );
  const offsetX = POSITIONED_LAYOUT.canvasPadding - minX;
  const offsetY = POSITIONED_LAYOUT.canvasPadding - minY;

  return {
    nodes: nodes.map((node) => ({
      ...node,
      x: node.x + offsetX,
      y: node.y + offsetY,
    })),
    lines: lines.map((line) => ({
      ...line,
      from: { x: line.from.x + offsetX, y: line.from.y + offsetY },
      to: { x: line.to.x + offsetX, y: line.to.y + offsetY },
    })),
    width: maxX - minX + POSITIONED_LAYOUT.canvasPadding * 2,
    height: maxY - minY + POSITIONED_LAYOUT.canvasPadding * 2,
  };
}

export function clearMindmapPositions(node: MindmapNode): MindmapNode {
  return {
    ...node,
    position: undefined,
    children: node.children.map(clearMindmapPositions),
  };
}
