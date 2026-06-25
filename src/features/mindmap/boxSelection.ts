import type { CanvasViewState } from './canvasControls';

export type Point = {
  x: number;
  y: number;
};

export type Rect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type NodeHitbox = {
  id: string;
  left: number;
  top: number;
  width: number;
  height: number;
};

const BOX_SELECTION_THRESHOLD = 5;
export const CANVAS_INTERACTION_BLOCK_SELECTOR = [
  'button',
  'input',
  'textarea',
  'select',
  '[contenteditable="true"]',
  '.toolbar',
  '.floating-toolbar',
  '.side-panel',
  '.modal',
  '.app-header',
  '.node-toolbar',
  '.toolbar-group',
  '.side-toolrail',
  '.tool-sidebar',
  '.tool-drawer',
  '.feature-panel',
  '.remark-panel',
  '.remark-panel-shell',
  '.remark-collapsed-bar',
  '.canvas-floating-toolbar',
  '.context-menu',
  '.shortcut-help-dialog',
  '.shortcut-help-backdrop',
  '.remark-preview-dialog',
  '.remark-preview-backdrop',
  '.excel-mapping-dialog',
  '.excel-mapping-backdrop',
  '.plugin-manager-dialog',
  '.plugin-manager-backdrop',
  '.mindmap-node',
  '.collapse-toggle',
].join(',');

export function getSelectionRect(start: Point, end: Point): Rect {
  const left = Math.min(start.x, end.x);
  const top = Math.min(start.y, end.y);

  return {
    left,
    top,
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}

export function isDragPastThreshold(start: Point, current: Point) {
  return (
    Math.abs(current.x - start.x) >= BOX_SELECTION_THRESHOLD ||
    Math.abs(current.y - start.y) >= BOX_SELECTION_THRESHOLD
  );
}

export function doRectsIntersect(a: Rect, b: Rect) {
  return (
    a.left <= b.left + b.width &&
    a.left + a.width >= b.left &&
    a.top <= b.top + b.height &&
    a.top + a.height >= b.top
  );
}

export function isPointInRect(point: Point, rect: Rect) {
  return (
    point.x >= rect.left &&
    point.x <= rect.left + rect.width &&
    point.y >= rect.top &&
    point.y <= rect.top + rect.height
  );
}

export function hitTestNodesInRect(rect: Rect, nodes: NodeHitbox[]) {
  return nodes
    .filter((node) => {
      const centerPoint = {
        x: node.left + node.width / 2,
        y: node.top + node.height / 2,
      };

      return isPointInRect(centerPoint, rect);
    })
    .map((node) => node.id);
}

export function screenToCanvasPoint(
  screenPoint: Point,
  canvasViewportRect: { left: number; top: number },
  canvasView: CanvasViewState,
  scrollOffset: Point = { x: 0, y: 0 },
): Point {
  return {
    x:
      (screenPoint.x -
        canvasViewportRect.left +
        scrollOffset.x -
        canvasView.offsetX) /
      canvasView.scale,
    y:
      (screenPoint.y -
        canvasViewportRect.top +
        scrollOffset.y -
        canvasView.offsetY) /
      canvasView.scale,
  };
}

export function screenPointToWorldPoint(
  screenPoint: Point,
  worldViewportRect: { left: number; top: number },
  scale: number,
): Point {
  return {
    x: (screenPoint.x - worldViewportRect.left) / scale,
    y: (screenPoint.y - worldViewportRect.top) / scale,
  };
}

export function getViewportSelectionRect(
  start: Point,
  end: Point,
  canvasViewportRect: { left: number; top: number },
  scrollOffset: Point = { x: 0, y: 0 },
) {
  return getSelectionRect(
    {
      x: start.x - canvasViewportRect.left + scrollOffset.x,
      y: start.y - canvasViewportRect.top + scrollOffset.y,
    },
    {
      x: end.x - canvasViewportRect.left + scrollOffset.x,
      y: end.y - canvasViewportRect.top + scrollOffset.y,
    },
  );
}

export function getBoxSelectionGeometry(input: {
  screenStart: Point;
  screenCurrent: Point;
  canvasViewportRect: { left: number; top: number };
  worldViewportRect?: { left: number; top: number };
  canvasView: CanvasViewState;
  scrollOffset?: Point;
}) {
  const scrollOffset = input.scrollOffset ?? { x: 0, y: 0 };
  const canvasStart = input.worldViewportRect
    ? screenPointToWorldPoint(
        input.screenStart,
        input.worldViewportRect,
        input.canvasView.scale,
      )
    : screenToCanvasPoint(
        input.screenStart,
        input.canvasViewportRect,
        input.canvasView,
        scrollOffset,
      );
  const canvasCurrent = input.worldViewportRect
    ? screenPointToWorldPoint(
        input.screenCurrent,
        input.worldViewportRect,
        input.canvasView.scale,
      )
    : screenToCanvasPoint(
        input.screenCurrent,
        input.canvasViewportRect,
        input.canvasView,
        scrollOffset,
      );

  return {
    canvasStart,
    canvasCurrent,
    canvasRect: getSelectionRect(canvasStart, canvasCurrent),
    viewportRect: getViewportSelectionRect(
      input.screenStart,
      input.screenCurrent,
      input.canvasViewportRect,
      scrollOffset,
    ),
  };
}

export function mergeBoxSelection(
  currentSelectedNodeIds: string[],
  hitNodeIds: string[],
  append: boolean,
) {
  if (!append) {
    return hitNodeIds;
  }

  return Array.from(new Set([...currentSelectedNodeIds, ...hitNodeIds]));
}

export function shouldStartBoxSelection(input: {
  button: number;
  isOnInteractiveElement: boolean;
  shiftKey: boolean;
}) {
  return input.button === 0 && input.shiftKey && !input.isOnInteractiveElement;
}

export function shouldStartCanvasPan(input: {
  button: number;
  isOnInteractiveElement: boolean;
  shiftKey: boolean;
}) {
  return input.button === 0 && !input.shiftKey && !input.isOnInteractiveElement;
}

export function isCanvasInteractionBlockedTarget(
  target: { closest: (selector: string) => unknown } | null,
) {
  return Boolean(target?.closest(CANVAS_INTERACTION_BLOCK_SELECTOR));
}
