import { describe, expect, it } from 'vitest';
import { createMindmapLayout } from '../layout';
import { drawMiniMap, getMiniMapNavigationPoint } from '../miniMap';
import type { MindmapNode } from '../types';

function createContext(log: string[]) {
  return {
    clearRect: () => log.push('clear'),
    beginPath: () => log.push('begin'),
    moveTo: () => log.push('move'),
    lineTo: () => log.push('line'),
    stroke: () => log.push('stroke'),
    fillRect: () => log.push('node'),
    strokeRect: () => log.push('viewport'),
  } as unknown as CanvasRenderingContext2D;
}

const tree: MindmapNode = {
  id: 'root', text: 'root', remark: '', children: [
    { id: 'one', text: 'one', remark: '', children: [] },
    { id: 'two', text: 'two', remark: '', children: [{ id: 'three', text: 'three', remark: '', children: [] }] },
  ],
};

describe('mini map edge rendering', () => {
  it('renders every visible branch before nodes and the viewport rectangle', () => {
    const layout = createMindmapLayout(tree);
    const log: string[] = [];

    drawMiniMap(createContext(log), layout, { left: 0, top: 0, width: 200, height: 120 }, { width: 240, height: 160 });

    expect(layout.lines).toHaveLength(3);
    expect(log.filter((entry) => entry === 'move')).toHaveLength(3);
    expect(log.indexOf('move')).toBeLessThan(log.indexOf('node'));
    expect(log[log.length - 1]).toBe('viewport');
  });

  it('omits collapsed descendants and keeps coordinate navigation bounded', () => {
    const collapsed = createMindmapLayout({ ...tree, collapsed: true });
    const log: string[] = [];

    drawMiniMap(createContext(log), collapsed, { left: 0, top: 0, width: 200, height: 120 }, { width: 240, height: 160 });
    expect(collapsed.lines).toHaveLength(0);
    expect(log).not.toContain('move');
    expect(getMiniMapNavigationPoint({ x: 999, y: -20 }, collapsed, { width: 240, height: 160 })).toEqual({ x: collapsed.width, y: 0 });
  });
});
