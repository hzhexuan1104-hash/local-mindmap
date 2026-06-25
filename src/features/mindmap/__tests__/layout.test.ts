import { describe, expect, it } from 'vitest';
import {
  clearMindmapPositions,
  createMindmapLayout,
} from '../layout';
import { serializeLmindDocument } from '../saveMindmap';
import type { MindmapNode } from '../types';

const mindmap: MindmapNode = {
  id: 'root',
  text: '中心主题',
  remark: '',
  children: [
    {
      id: 'child-1',
      text: '自动布局节点',
      remark: '',
      children: [],
    },
    {
      id: 'child-2',
      text: '手动布局节点',
      remark: '',
      position: { x: 480, y: 160 },
      children: [],
    },
  ],
};

describe('mindmap layout positions', () => {
  it('creates left-to-right layout for nodes without positions', () => {
    const layout = createMindmapLayout({
      id: 'root',
      text: '中心主题',
      remark: '',
      children: [
        {
          id: 'child',
          text: '子节点',
          remark: '',
          children: [],
        },
      ],
    });
    const root = layout.nodes.find((node) => node.id === 'root');
    const child = layout.nodes.find((node) => node.id === 'child');

    expect(root).toBeDefined();
    expect(child).toBeDefined();
    expect(child!.x).toBeGreaterThan(root!.x);
    expect(layout.lines).toHaveLength(1);
  });

  it('uses saved node positions in layout results', () => {
    const layout = createMindmapLayout(mindmap);
    const manualNode = layout.nodes.find((node) => node.id === 'child-2');

    expect(manualNode?.x).toBeGreaterThanOrEqual(480);
    expect(manualNode?.y).toBeGreaterThanOrEqual(160);
  });

  it('keeps negative root positions visible instead of normalizing them back to padding', () => {
    const layout = createMindmapLayout({
      ...mindmap,
      position: { x: -120, y: -90 },
    });
    const root = layout.nodes.find((node) => node.id === 'root');

    expect(root?.x).toBe(-24);
    expect(root?.y).toBe(6);
  });

  it('keeps negative normal node positions visible instead of normalizing them back to padding', () => {
    const layout = createMindmapLayout({
      ...mindmap,
      children: [
        mindmap.children[0],
        {
          ...mindmap.children[1],
          position: { x: -60, y: -40 },
        },
      ],
    });
    const manualNode = layout.nodes.find((node) => node.id === 'child-2');

    expect(manualNode?.x).toBe(36);
    expect(manualNode?.y).toBe(56);
  });

  it('serializes positions into lmind JSON', () => {
    const serialized = serializeLmindDocument(mindmap, [], 'default-blue');
    const parsed = JSON.parse(serialized) as { rootNode: MindmapNode };

    expect(parsed.rootNode.children[1].position).toEqual({ x: 480, y: 160 });
  });

  it('serializes negative positions into lmind JSON', () => {
    const negativePositionMindmap: MindmapNode = {
      ...mindmap,
      position: { x: -120, y: -80 },
      children: [
        {
          ...mindmap.children[0],
          position: { x: -40, y: -20 },
        },
      ],
    };
    const serialized = serializeLmindDocument(
      negativePositionMindmap,
      [],
      'default-blue',
    );
    const parsed = JSON.parse(serialized) as { rootNode: MindmapNode };

    expect(parsed.rootNode.position).toEqual({ x: -120, y: -80 });
    expect(parsed.rootNode.children[0].position).toEqual({ x: -40, y: -20 });
  });

  it('clears positions when resetting automatic layout', () => {
    const resetMindmap = clearMindmapPositions(mindmap);

    expect(resetMindmap.children[1].position).toBeUndefined();
  });
});
