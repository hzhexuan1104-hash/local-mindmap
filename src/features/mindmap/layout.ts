import type { CSSProperties } from 'react';
import { getEffectiveNodeStyle } from './nodeStyles';
import { findNodeTypeById } from './nodeTypes';
import type { MindmapNode, MindmapNodeType } from './types';

const MINDMAP_LAYOUT = {
  canvasPadding: 80,
  childHorizontalGap: 96,
  childVerticalGap: 80,
  nodeMinWidth: 88,
  nodeMaxWidth: 340,
  nodeMinHeight: 44,
  nodeHorizontalPadding: 16,
  nodeVerticalPadding: 10,
  rootMinWidth: 120,
  rootMinHeight: 52,
  rootHorizontalPadding: 20,
  rootVerticalPadding: 12,
  iconGap: 7,
  iconWidth: 18,
} as const;

export const POSITIONED_LAYOUT = {
  canvasPadding: 96,
  // Retained as a conservative placement fallback for manually positioned nodes.
  nodeWidth: MINDMAP_LAYOUT.nodeMaxWidth,
  nodeHeight: MINDMAP_LAYOUT.nodeMinHeight,
  diamondNodeHeight: 72,
  horizontalGap: 116,
  verticalGap: 52,
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

export type NodeContentSize = {
  width: number;
  height: number;
  lineCount: number;
};

type AutoLayoutEntry = { id: string; x: number; y: number };
type AnchorRect = { x: number; y: number; width: number; height: number };
type AnchorPoint = { x: number; y: number };

const textMeasurementCache = new Map<string, number>();
const MAX_TEXT_MEASUREMENTS = 4_000;
let textMeasureContext: CanvasRenderingContext2D | null | undefined;

function getTextMeasureContext() {
  if (textMeasureContext !== undefined) return textMeasureContext;
  if (typeof document === 'undefined') {
    textMeasureContext = null;
    return textMeasureContext;
  }
  textMeasureContext = document.createElement('canvas').getContext('2d');
  return textMeasureContext;
}

function fallbackTextWidth(text: string, fontSize: number) {
  return Array.from(text).reduce(
    (width, character) => width + (/[\u0000-\u00ff]/.test(character) ? fontSize * 0.56 : fontSize),
    0,
  );
}

/** Cached by content and font characteristics; interaction state never enters this key. */
export function measureNodeText(text: string, fontSize: number, bold: boolean) {
  const key = `${fontSize}|${bold ? 700 : 500}|${text}`;
  const cached = textMeasurementCache.get(key);
  if (cached !== undefined) return cached;
  const context = getTextMeasureContext();
  if (context) context.font = `${bold ? 700 : 500} ${fontSize}px system-ui, sans-serif`;
  const width = context ? context.measureText(text).width : fallbackTextWidth(text, fontSize);
  if (textMeasurementCache.size >= MAX_TEXT_MEASUREMENTS) textMeasurementCache.clear();
  textMeasurementCache.set(key, width);
  return width;
}

export function clearNodeTextMeasurementCache() {
  textMeasurementCache.clear();
}

function wrapText(text: string, maxWidth: number, fontSize: number, bold: boolean) {
  const paragraphs = (text || ' ').split(/\r?\n/);
  const lines: string[] = [];
  paragraphs.forEach((paragraph) => {
    let line = '';
    Array.from(paragraph || ' ').forEach((character) => {
      const candidate = `${line}${character}`;
      if (line && measureNodeText(candidate, fontSize, bold) > maxWidth) {
        lines.push(line);
        line = character;
      } else {
        line = candidate;
      }
    });
    lines.push(line || ' ');
  });
  return lines;
}

function getVisibleChildren(node: MindmapNode) {
  return node.collapsed ? [] : node.children;
}

function getNodeType(node: MindmapNode, nodeTypes: MindmapNodeType[]) {
  return findNodeTypeById(nodeTypes, node.nodeTypeId);
}

function getNodeShape(node: MindmapNode, nodeTypes: MindmapNodeType[]) {
  return getEffectiveNodeStyle(node, getNodeType(node, nodeTypes)).shape;
}

export function getNodeContentSize(
  node: MindmapNode,
  nodeTypes: MindmapNodeType[] = [],
  isRoot = false,
): NodeContentSize {
  const nodeType = getNodeType(node, nodeTypes);
  const style = getEffectiveNodeStyle(node, nodeType);
  const shape = style.shape;
  const horizontalPadding = isRoot ? MINDMAP_LAYOUT.rootHorizontalPadding : MINDMAP_LAYOUT.nodeHorizontalPadding;
  const verticalPadding = isRoot ? MINDMAP_LAYOUT.rootVerticalPadding : MINDMAP_LAYOUT.nodeVerticalPadding;
  const minWidth = isRoot ? MINDMAP_LAYOUT.rootMinWidth : MINDMAP_LAYOUT.nodeMinWidth;
  const minHeight = isRoot ? MINDMAP_LAYOUT.rootMinHeight : MINDMAP_LAYOUT.nodeMinHeight;
  const iconWidth = nodeType?.icon ? MINDMAP_LAYOUT.iconWidth + MINDMAP_LAYOUT.iconGap : 0;
  const diamondFactor = shape === 'diamond' ? 1.34 : 1;
  const pillExtra = shape === 'pill' ? 8 : 0;
  const availableTextWidth = Math.max(
    48,
    (MINDMAP_LAYOUT.nodeMaxWidth - horizontalPadding * 2 - iconWidth - pillExtra) / diamondFactor,
  );
  const lines = wrapText(node.text, availableTextWidth, style.fontSize, style.bold);
  const widestLine = Math.max(...lines.map((line) => measureNodeText(line, style.fontSize, style.bold)));
  const lineHeight = Math.ceil(style.fontSize * 1.4);
  const contentWidth = widestLine + iconWidth;
  const unclampedWidth = (contentWidth + horizontalPadding * 2 + pillExtra) * diamondFactor;
  const width = Math.max(minWidth, Math.min(MINDMAP_LAYOUT.nodeMaxWidth, Math.ceil(unclampedWidth)));
  const baseHeight = lines.length * lineHeight + verticalPadding * 2;
  const height = Math.max(
    minHeight,
    Math.ceil(shape === 'diamond' ? baseHeight + Math.max(18, width * 0.12) : baseHeight),
  );
  return { width, height, lineCount: lines.length };
}

function collectVisibleNodes(node: MindmapNode, nodes: MindmapNode[] = []) {
  nodes.push(node);
  getVisibleChildren(node).forEach((child) => collectVisibleNodes(child, nodes));
  return nodes;
}

function measureSubtreeHeight(node: MindmapNode, sizeById: Map<string, NodeContentSize>): number {
  const children = getVisibleChildren(node);
  const nodeHeight = sizeById.get(node.id)?.height ?? POSITIONED_LAYOUT.nodeHeight;
  if (children.length === 0) return nodeHeight;
  const childrenHeight = children.reduce((sum, child) => sum + measureSubtreeHeight(child, sizeById), 0);
  return Math.max(nodeHeight, childrenHeight + POSITIONED_LAYOUT.verticalGap * (children.length - 1));
}

function buildAutoLayout(
  node: MindmapNode,
  depth: number,
  top: number,
  entries: AutoLayoutEntry[],
  sizeById: Map<string, NodeContentSize>,
  depthOffsets: number[],
): number {
  const nodeHeight = sizeById.get(node.id)?.height ?? POSITIONED_LAYOUT.nodeHeight;
  const subtreeHeight = measureSubtreeHeight(node, sizeById);
  entries.push({ id: node.id, x: depthOffsets[depth] ?? 0, y: top + subtreeHeight / 2 - nodeHeight / 2 });
  let nextTop = top;
  getVisibleChildren(node).forEach((child) => {
    const childHeight = measureSubtreeHeight(child, sizeById);
    buildAutoLayout(child, depth + 1, nextTop, entries, sizeById, depthOffsets);
    nextTop += childHeight + POSITIONED_LAYOUT.verticalGap;
  });
  return subtreeHeight;
}

function getRectCenter(rect: AnchorRect): AnchorPoint {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

export function getDiamondBoundaryAnchor(rect: AnchorRect, target: AnchorPoint): AnchorPoint {
  const center = getRectCenter(rect);
  const dx = target.x - center.x;
  const dy = target.y - center.y;
  if (dx === 0 && dy === 0) return center;
  const scale = 1 / (Math.abs(dx) / (rect.width / 2) + Math.abs(dy) / (rect.height / 2));
  return { x: center.x + dx * scale, y: center.y + dy * scale };
}

export function getNodeBoundaryAnchor(rect: AnchorRect, target: AnchorPoint, shape: MindmapNodeType['shape'] = 'rounded'): AnchorPoint {
  const center = getRectCenter(rect);
  // Edges intentionally attach at diamond vertices, matching the visual branch axis.
  if (shape === 'diamond') return { x: target.x >= center.x ? rect.x + rect.width : rect.x, y: center.y };
  return { x: target.x >= center.x ? rect.x + rect.width : rect.x, y: center.y };
}

export function createMindmapLayout(rootNode: MindmapNode, nodeTypes: MindmapNodeType[] = []): MindmapLayoutResult {
  const visibleNodes = collectVisibleNodes(rootNode);
  const sizeById = new Map(visibleNodes.map((node) => [node.id, getNodeContentSize(node, nodeTypes, node.id === rootNode.id)]));
  const maxWidthByDepth: number[] = [];
  const collectDepthWidths = (node: MindmapNode, depth = 0) => {
    maxWidthByDepth[depth] = Math.max(maxWidthByDepth[depth] ?? 0, sizeById.get(node.id)?.width ?? 0);
    getVisibleChildren(node).forEach((child) => collectDepthWidths(child, depth + 1));
  };
  collectDepthWidths(rootNode);
  const depthOffsets = maxWidthByDepth.reduce<number[]>((offsets, width, depth) => {
    offsets[depth] = depth === 0 ? 0 : offsets[depth - 1] + maxWidthByDepth[depth - 1] + POSITIONED_LAYOUT.horizontalGap;
    return offsets;
  }, []);
  const entries: AutoLayoutEntry[] = [];
  buildAutoLayout(rootNode, 0, 0, entries, sizeById, depthOffsets);
  const autoPositionById = new Map(entries.map((entry) => [entry.id, { x: entry.x, y: entry.y }]));
  const nodes = visibleNodes.map((node) => {
    const size = sizeById.get(node.id)!;
    const autoPosition = autoPositionById.get(node.id) ?? { x: 0, y: 0 };
    return { id: node.id, node, x: node.position?.x ?? autoPosition.x, y: node.position?.y ?? autoPosition.y, width: size.width, height: size.height, shape: getNodeShape(node, nodeTypes) };
  });
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const lines: MindmapLayoutLine[] = [];
  nodes.forEach((layoutNode) => {
    if (layoutNode.node.collapsed) return;
    layoutNode.node.children.forEach((child) => {
      const childNode = nodeById.get(child.id);
      if (!childNode) return;
      const fromRect = { x: layoutNode.x, y: layoutNode.y, width: layoutNode.width, height: layoutNode.height };
      const toRect = { x: childNode.x, y: childNode.y, width: childNode.width, height: childNode.height };
      lines.push({ id: `${layoutNode.id}-${child.id}`, from: getNodeBoundaryAnchor(fromRect, getRectCenter(toRect), layoutNode.shape), to: getNodeBoundaryAnchor(toRect, getRectCenter(fromRect), childNode.shape) });
    });
  });
  const maxX = Math.max(...nodes.map((node) => node.x + node.width), POSITIONED_LAYOUT.nodeWidth);
  const maxY = Math.max(...nodes.map((node) => node.y + node.height), POSITIONED_LAYOUT.nodeHeight);
  const offsetX = POSITIONED_LAYOUT.canvasPadding;
  const offsetY = POSITIONED_LAYOUT.canvasPadding;
  return {
    nodes: nodes.map((node) => ({ ...node, x: node.x + offsetX, y: node.y + offsetY })),
    lines: lines.map((line) => ({ ...line, from: { x: line.from.x + offsetX, y: line.from.y + offsetY }, to: { x: line.to.x + offsetX, y: line.to.y + offsetY } })),
    width: Math.max(maxX + POSITIONED_LAYOUT.canvasPadding * 2, POSITIONED_LAYOUT.nodeWidth),
    height: Math.max(maxY + POSITIONED_LAYOUT.canvasPadding * 2, POSITIONED_LAYOUT.nodeHeight),
  };
}

export function clearMindmapPositions(node: MindmapNode): MindmapNode {
  return { ...node, position: undefined, children: node.children.map(clearMindmapPositions) };
}
