import { describe, expect, it } from 'vitest';
import { centerNodeInCanvasView } from '../canvasControls';

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
