import { useEffect, useRef } from 'react';
import type { MindmapLayoutResult } from '../../features/mindmap/layout';
import type { WorldViewport } from '../../features/mindmap/viewportCulling';

type MiniMapProps = { layout: MindmapLayoutResult; viewport: WorldViewport; onNavigate: (worldX: number, worldY: number) => void };

export function MiniMap({ layout, viewport, onNavigate }: MiniMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const width = canvas.clientWidth || 180; const height = canvas.clientHeight || 120;
    canvas.width = width * devicePixelRatio; canvas.height = height * devicePixelRatio;
    const ctx = canvas.getContext('2d'); if (!ctx || layout.width <= 0 || layout.height <= 0) return;
    ctx.scale(devicePixelRatio, devicePixelRatio); ctx.clearRect(0, 0, width, height);
    const scale = Math.min(width / layout.width, height / layout.height);
    ctx.fillStyle = '#4e7cff';
    layout.nodes.forEach((node) => ctx.fillRect(node.x * scale, node.y * scale, Math.max(1, node.width * scale), Math.max(1, node.height * scale)));
    ctx.strokeStyle = '#f05a47'; ctx.lineWidth = 1;
    ctx.strokeRect(viewport.left * scale, viewport.top * scale, viewport.width * scale, viewport.height * scale);
  }, [layout, viewport]);
  const handlePointer = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    onNavigate(((event.clientX - rect.left) / rect.width) * layout.width, ((event.clientY - rect.top) / rect.height) * layout.height);
  };
  return <canvas className="mini-map" ref={canvasRef} onPointerDown={handlePointer} aria-label="小地图，点击可移动画布" title="小地图" />;
}
