import type { MindmapLayoutResult } from './layout';
import type { WorldViewport } from './viewportCulling';

export type MiniMapDimensions = { width: number; height: number };

export function getMiniMapScale(
  layout: Pick<MindmapLayoutResult, 'width' | 'height'>,
  dimensions: MiniMapDimensions,
) {
  if (layout.width <= 0 || layout.height <= 0) return 1;
  return Math.min(dimensions.width / layout.width, dimensions.height / layout.height);
}

export function getMiniMapNavigationPoint(
  pointer: { x: number; y: number },
  layout: Pick<MindmapLayoutResult, 'width' | 'height'>,
  dimensions: MiniMapDimensions,
) {
  const scale = getMiniMapScale(layout, dimensions);
  return {
    x: Math.max(0, Math.min(layout.width, pointer.x / scale)),
    y: Math.max(0, Math.min(layout.height, pointer.y / scale)),
  };
}

/** Lightweight canvas renderer: lines first, nodes next, viewport last. */
export function drawMiniMap(
  context: CanvasRenderingContext2D,
  layout: MindmapLayoutResult,
  viewport: WorldViewport,
  dimensions: MiniMapDimensions,
) {
  const scale = getMiniMapScale(layout, dimensions);
  context.clearRect(0, 0, dimensions.width, dimensions.height);

  if (layout.lines.length > 0) {
    context.beginPath();
    layout.lines.forEach((line) => {
      context.moveTo(line.from.x * scale, line.from.y * scale);
      context.lineTo(line.to.x * scale, line.to.y * scale);
    });
    context.strokeStyle = '#7f96b2';
    context.lineWidth = 1;
    context.stroke();
  }

  context.fillStyle = '#4e7cff';
  layout.nodes.forEach((node) => {
    context.fillRect(
      node.x * scale,
      node.y * scale,
      Math.max(1, node.width * scale),
      Math.max(1, node.height * scale),
    );
  });

  context.strokeStyle = '#f05a47';
  context.lineWidth = 1;
  context.strokeRect(
    viewport.left * scale,
    viewport.top * scale,
    viewport.width * scale,
    viewport.height * scale,
  );
  return scale;
}
