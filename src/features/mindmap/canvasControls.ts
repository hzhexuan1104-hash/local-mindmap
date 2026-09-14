export type CanvasViewState = {
  scale: number;
  offsetX: number;
  offsetY: number;
};

export const DEFAULT_CANVAS_VIEW: CanvasViewState = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
};

const MIN_SCALE = 0.4;
const MAX_SCALE = 2.2;
const SCALE_STEP = 0.1;

export function clampScale(scale: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, Number(scale.toFixed(2))));
}

export function zoomCanvasView(
  view: CanvasViewState,
  direction: 'in' | 'out',
): CanvasViewState {
  return {
    ...view,
    scale: clampScale(
      view.scale + (direction === 'in' ? SCALE_STEP : -SCALE_STEP),
    ),
  };
}

export function panCanvasView(
  view: CanvasViewState,
  deltaX: number,
  deltaY: number,
): CanvasViewState {
  return {
    ...view,
    offsetX: view.offsetX + deltaX,
    offsetY: view.offsetY + deltaY,
  };
}

export function centerCanvasView(): CanvasViewState {
  return DEFAULT_CANVAS_VIEW;
}

export function centerNodeInCanvasView(
  view: CanvasViewState,
  nodeBounds: { x: number; y: number; width: number; height: number },
  viewport: { width: number; height: number },
): CanvasViewState {
  return {
    ...view,
    offsetX: viewport.width / 2 - (nodeBounds.x + nodeBounds.width / 2) * view.scale,
    offsetY: viewport.height / 2 - (nodeBounds.y + nodeBounds.height / 2) * view.scale,
  };
}
