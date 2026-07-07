import type { CSSProperties } from 'react';
import { getEffectiveNodeStyle } from './nodeStyles';
import { findNodeTypeById } from './nodeTypes';
import type { MindmapNode, MindmapNodeType } from './types';

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
  diamondNodeHeight: 120,
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
  width: number;
  height: number;
  shape: MindmapNodeType['shape'];
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

type AnchorRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type AnchorPoint = {
  x: number;
  y: number;
};

function getVisibleChildren(node: MindmapNode) {
  return node.collapsed ? [] : node.children;
}

function getNodeShape(
  node: MindmapNode,
  nodeTypes: MindmapNodeType[],
): MindmapNodeType['shape'] {
  const nodeType = findNodeTypeById(nodeTypes, node.nodeTypeId);

  return getEffectiveNodeStyle(node, nodeType).shape;
}

function measureSubtreeHeight(
  node: MindmapNode,
  nodeTypes: MindmapNodeType[],
): number {
  const children = getVisibleChildren(node);
  const nodeHeight = getLayoutNodeSize(getNodeShape(node, nodeTypes)).height;

  if (children.length === 0) {
    return nodeHeight;
  }

  const childrenHeight = children.reduce(
    (sum, child) => sum + measureSubtreeHeight(child, nodeTypes),
    0,
  );
  const gaps = POSITIONED_LAYOUT.verticalGap * (children.length - 1);

  return Math.max(nodeHeight, childrenHeight + gaps);
}

function buildAutoLayout(
  node: MindmapNode,
  depth: number,
  top: number,
  entries: AutoLayoutEntry[],
  nodeTypes: MindmapNodeType[],
): number {
  const nodeHeight = getLayoutNodeSize(getNodeShape(node, nodeTypes)).height;
  const subtreeHeight = measureSubtreeHeight(node, nodeTypes);
  const nodeY = top + subtreeHeight / 2 - nodeHeight / 2;
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
    const childHeight = measureSubtreeHeight(child, nodeTypes);
    buildAutoLayout(child, depth + 1, nextTop, entries, nodeTypes);
    nextTop += childHeight + POSITIONED_LAYOUT.verticalGap;
  });

  return subtreeHeight;
}

function collectVisibleNodes(node: MindmapNode, nodes: MindmapNode[] = []) {
  nodes.push(node);

  getVisibleChildren(node).forEach((child) => collectVisibleNodes(child, nodes));

  return nodes;
}

function getLayoutNodeSize(shape: MindmapNodeType['shape']) {
  return {
    width: POSITIONED_LAYOUT.nodeWidth,
    height:
      shape === 'diamond'
        ? POSITIONED_LAYOUT.diamondNodeHeight
        : POSITIONED_LAYOUT.nodeHeight,
  };
}

function getRectCenter(rect: AnchorRect): AnchorPoint {
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  };
}

export function getDiamondBoundaryAnchor(
  rect: AnchorRect,
  target: AnchorPoint,
): AnchorPoint {
  const center = getRectCenter(rect);
  const dx = target.x - center.x;
  const dy = target.y - center.y;

  if (dx === 0 && dy === 0) {
    return center;
  }

  const halfWidth = rect.width / 2;
  const halfHeight = rect.height / 2;
  const scale = 1 / (Math.abs(dx) / halfWidth + Math.abs(dy) / halfHeight);

  return {
    x: center.x + dx * scale,
    y: center.y + dy * scale,
  };
}

export function getNodeBoundaryAnchor(
  rect: AnchorRect,
  target: AnchorPoint,
  shape: MindmapNodeType['shape'] = 'rounded',
): AnchorPoint {
  if (shape === 'diamond') {
    return getDiamondBoundaryAnchor(rect, target);
  }

  const center = getRectCenter(rect);

  return {
    x: target.x >= center.x ? rect.x + rect.width : rect.x,
    y: center.y,
  };
}

export function createMindmapLayout(
  rootNode: MindmapNode,
  nodeTypes: MindmapNodeType[] = [],
): MindmapLayoutResult {
  const autoEntries: AutoLayoutEntry[] = [];
  buildAutoLayout(rootNode, 0, 0, autoEntries, nodeTypes);
  const autoPositionById = new Map(
    autoEntries.map((entry) => [entry.id, { x: entry.x, y: entry.y }]),
  );
  const nodes = collectVisibleNodes(rootNode).map((node) => {
    const autoPosition = autoPositionById.get(node.id) ?? { x: 0, y: 0 };
    const shape = getNodeShape(node, nodeTypes);
    const size = getLayoutNodeSize(shape);

    return {
      id: node.id,
      node,
      x: node.position?.x ?? autoPosition.x,
      y: node.position?.y ?? autoPosition.y,
      width: size.width,
      height: size.height,
      shape,
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

      const fromRect = {
        x: layoutNode.x,
        y: layoutNode.y,
        width: layoutNode.width,
        height: layoutNode.height,
      };
      const toRect = {
        x: childLayoutNode.x,
        y: childLayoutNode.y,
        width: childLayoutNode.width,
        height: childLayoutNode.height,
      };
      const fromCenter = getRectCenter(fromRect);
      const toCenter = getRectCenter(toRect);

      lines.push({
        id: `${layoutNode.id}-${child.id}`,
        from: getNodeBoundaryAnchor(fromRect, toCenter, layoutNode.shape),
        to: getNodeBoundaryAnchor(toRect, fromCenter, childLayoutNode.shape),
      });
    });
  });

  const maxX = Math.max(
    ...nodes.map((node) => node.x + node.width),
    POSITIONED_LAYOUT.nodeWidth,
  );
  const maxY = Math.max(
    ...nodes.map((node) => node.y + node.height),
    POSITIONED_LAYOUT.nodeHeight,
  );
  const offsetX = POSITIONED_LAYOUT.canvasPadding;
  const offsetY = POSITIONED_LAYOUT.canvasPadding;

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
    width:
      Math.max(maxX + POSITIONED_LAYOUT.canvasPadding * 2, POSITIONED_LAYOUT.nodeWidth),
    height:
      Math.max(maxY + POSITIONED_LAYOUT.canvasPadding * 2, POSITIONED_LAYOUT.nodeHeight),
  };
}

export function clearMindmapPositions(node: MindmapNode): MindmapNode {
  return {
    ...node,
    position: undefined,
    children: node.children.map(clearMindmapPositions),
  };
}
