import { useEffect, useRef, useState } from 'react';
import type { MindmapLayoutResult } from '../../features/mindmap/layout';
import {
  drawMiniMap,
  getMiniMapNavigationPoint,
} from '../../features/mindmap/miniMap';
import type { WorldViewport } from '../../features/mindmap/viewportCulling';

type MiniMapProps = { layout: MindmapLayoutResult; viewport: WorldViewport; onNavigate: (worldX: number, worldY: number) => void };

export function MiniMap({ layout, viewport, onNavigate }: MiniMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: 180, height: 120 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const updateDimensions = () => {
      setDimensions({
        width: canvas.clientWidth || 180,
        height: canvas.clientHeight || 120,
      });
    };
    updateDimensions();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(updateDimensions);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const pixelRatio = window.devicePixelRatio || 1;
    canvas.width = dimensions.width * pixelRatio;
    canvas.height = dimensions.height * pixelRatio;
    const ctx = canvas.getContext('2d'); if (!ctx || layout.width <= 0 || layout.height <= 0) return;
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    drawMiniMap(ctx, layout, viewport, dimensions);
  }, [dimensions, layout, viewport]);
  const handlePointer = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const point = getMiniMapNavigationPoint(
      { x: event.clientX - rect.left, y: event.clientY - rect.top },
      layout,
      { width: rect.width, height: rect.height },
    );
    onNavigate(point.x, point.y);
  };
  return <canvas className="mini-map" ref={canvasRef} onPointerDown={handlePointer} aria-label="小地图，点击可移动画布" title="小地图" />;
}
