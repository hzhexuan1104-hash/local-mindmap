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

export function hitTestNodesInRect(rect: Rect, nodes: NodeHitbox[]) {
  return nodes
    .filter((node) =>
      doRectsIntersect(rect, {
        left: node.left,
        top: node.top,
        width: node.width,
        height: node.height,
      }),
    )
    .map((node) => node.id);
}

export function screenToCanvasPoint(
  screenPoint: Point,
  canvasViewportRect: { left: number; top: number },
  canvasView: CanvasViewState,
): Point {
  return {
    x: (screenPoint.x - canvasViewportRect.left - canvasView.offsetX) / canvasView.scale,
    y: (screenPoint.y - canvasViewportRect.top - canvasView.offsetY) / canvasView.scale,
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
}) {
  return input.button === 0 && !input.isOnInteractiveElement;
}
