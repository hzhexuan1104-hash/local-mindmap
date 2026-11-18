import { describe, expect, it } from 'vitest';
import { centerNodeInCanvasView, revealNodeInCanvasView } from '../canvasControls';

describe('initial canvas centering', () => {
  const rootBounds = { x: 80, y: 120, width: 160, height: 52 };

  it.each([
    ['normal workspace', { width: 960, height: 640 }],
    ['remark panel open', { width: 700, height: 640 }],
    ['resized workspace', { width: 1280, height: 760 }],
  ])('centers the blank root after %s layout', (_name, viewport) => {
    const view = centerNodeInCanvasView(
      { scale: 1, offsetX: 0, offsetY: 0 },
      rootBounds,
      viewport,
    );

    expect((rootBounds.x + rootBounds.width / 2) * view.scale + view.offsetX).toBe(viewport.width / 2);
    expect((rootBounds.y + rootBounds.height / 2) * view.scale + view.offsetY).toBe(viewport.height / 2);
  });
});

describe('revealing a new node', () => {
  const view = { scale: 1.5, offsetX: 30, offsetY: -24 };
  const viewport = { width: 960, height: 640 };
  const bounds = { x: 90, y: 100, width: 120, height: 52 };

  it('keeps the current view when the node already fits', () => {
    expect(revealNodeInCanvasView(view, bounds, viewport)).toBe(view);
  });

  it('pans only the clipped axis while keeping the current zoom', () => {
    const clipped = { ...bounds, x: 630 };
    const next = revealNodeInCanvasView(view, clipped, viewport);
    expect(next.scale).toBe(view.scale);
    expect(next.offsetY).toBe(view.offsetY);
    expect((clipped.x + clipped.width) * next.scale + next.offsetX).toBeLessThan(viewport.width);
    expect(clipped.x * next.scale + next.offsetX).toBeGreaterThan(0);
  });
});
