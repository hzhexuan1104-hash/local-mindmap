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

  it('serializes positions into lmind JSON', () => {
    const serialized = serializeLmindDocument(mindmap, [], 'default-blue');
    const parsed = JSON.parse(serialized) as { rootNode: MindmapNode };

    expect(parsed.rootNode.children[1].position).toEqual({ x: 480, y: 160 });
  });

  it('clears positions when resetting automatic layout', () => {
    const resetMindmap = clearMindmapPositions(mindmap);

    expect(resetMindmap.children[1].position).toBeUndefined();
  });
});
