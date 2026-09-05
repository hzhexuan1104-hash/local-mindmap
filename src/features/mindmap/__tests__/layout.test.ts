import { describe, expect, it } from 'vitest';
import {
  clearMindmapPositions,
  createMindmapLayout,
  getNodeContentSize,
  getDiamondBoundaryAnchor,
  LAYOUT_DENSITY_CONFIG,
  measureNodeText,
  POSITIONED_LAYOUT,
} from '../layout';
import { serializeLmindDocument } from '../saveMindmap';
import type { MindmapNode, MindmapNodeType } from '../types';

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

const diamondNodeType: MindmapNodeType = {
  id: 'diamond-type',
  name: 'Diamond',
  icon: 'D',
  shape: 'diamond',
  backgroundColor: '#e7f5ff',
  borderColor: '#1864ab',
  textColor: '#0b7285',
  fontSize: 18,
  bold: true,
  defaultText: 'Diamond node',
  defaultRemark: '',
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

  it('keeps regular node anchors on the original left and right edges', () => {
    const layout = createMindmapLayout({
      id: 'root',
      text: 'Root',
      remark: '',
      children: [
        {
          id: 'child',
          text: 'Child',
          remark: '',
          children: [],
        },
      ],
    });
    const root = layout.nodes.find((node) => node.id === 'root')!;
    const child = layout.nodes.find((node) => node.id === 'child')!;
    const line = layout.lines[0];

    expect(root.width).toBeGreaterThan(child.width);
    expect(child.width).toBeGreaterThanOrEqual(88);
    expect(line.from).toEqual({
      x: root.x + root.width,
      y: root.y + root.height / 2,
    });
    expect(line.to).toEqual({
      x: child.x,
      y: child.y + child.height / 2,
    });
  });

  it('computes diamond anchors on the real diamond boundary', () => {
    const rect = { x: 20, y: 40, width: 220, height: 120 };
    const anchor = getDiamondBoundaryAnchor(rect, { x: 360, y: 190 });
    const center = {
      x: rect.x + rect.width / 2,
      y: rect.y + rect.height / 2,
    };
    const boundaryValue =
      Math.abs(anchor.x - center.x) / (rect.width / 2) +
      Math.abs(anchor.y - center.y) / (rect.height / 2);

    expect(boundaryValue).toBeCloseTo(1);
    expect(anchor.x).toBeGreaterThan(center.x);
    expect(anchor.y).toBeGreaterThan(center.y);
  });

  it('connects diamond nodes to their visual left and right vertices', () => {
    const layout = createMindmapLayout({
      id: 'root',
      text: 'Root diamond',
      remark: '',
      style: { shape: 'diamond' },
      children: [
        {
          id: 'child',
          text: 'Child diamond',
          remark: '',
          style: { shape: 'diamond' },
          children: [],
        },
      ],
    });
    const root = layout.nodes.find((node) => node.id === 'root')!;
    const child = layout.nodes.find((node) => node.id === 'child')!;
    const line = layout.lines[0];

    expect(root.height).toBeGreaterThan(child.height);
    expect(line.from).toEqual({
      x: root.x + root.width,
      y: root.y + root.height / 2,
    });
    expect(line.to).toEqual({
      x: child.x,
      y: child.y + child.height / 2,
    });
  });

  it('uses node type diamond shape when attaching at visual vertices', () => {
    const layout = createMindmapLayout(
      {
        id: 'root',
        text: 'Typed root',
        remark: '',
        nodeTypeId: diamondNodeType.id,
        children: [
          {
            id: 'child',
            text: 'Child',
            remark: '',
            children: [],
          },
        ],
      },
      [diamondNodeType],
    );
    const root = layout.nodes.find((node) => node.id === 'root')!;
    expect(root.shape).toBe('diamond');
    expect(layout.lines[0].from).toEqual({
      x: root.x + root.width,
      y: root.y + root.height / 2,
    });
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

  it('sizes short nodes close to the minimum and grows wider for longer text', () => {
    const short = getNodeContentSize({ id: 'short', text: '短', remark: '', children: [] });
    const long = getNodeContentSize({ id: 'long', text: '这是一个明显更长的节点标题', remark: '', children: [] });

    expect(short.width).toBeGreaterThanOrEqual(88);
    expect(short.width).toBeLessThan(140);
    expect(long.width).toBeGreaterThan(short.width);
  });

  it('uses compact child node proportions while preserving a larger root node', () => {
    const child = getNodeContentSize({
      id: 'child',
      text: '分支主题',
      remark: '',
      children: [],
    });
    const root = getNodeContentSize(
      { id: 'root', text: '新建脑图', remark: '', children: [] },
      [],
      true,
    );

    expect(child.height).toBe(36);
    expect(root.height).toBe(52);
    expect(root.height).toBeGreaterThan(child.height);
  });

  it('wraps long content at the maximum width and gives diamonds a safe width allowance', () => {
    const longText = '一个很长的节点文本 '.repeat(40);
    const rounded = getNodeContentSize({ id: 'rounded', text: longText, remark: '', children: [] });
    const diamond = getNodeContentSize({ id: 'diamond', text: '菱形节点', remark: '', style: { shape: 'diamond' }, children: [] });
    const regular = getNodeContentSize({ id: 'regular', text: '菱形节点', remark: '', children: [] });

    expect(rounded.width).toBeLessThanOrEqual(POSITIONED_LAYOUT.nodeWidth);
    expect(rounded.height).toBeGreaterThan(POSITIONED_LAYOUT.nodeHeight);
    expect(diamond.width).toBeGreaterThan(regular.width);
  });

  it('measures oversized imported fonts using the same capped rendered font size', () => {
    const capped = getNodeContentSize({
      id: 'capped-font',
      text: 'A long label that needs to stay inside the node frame',
      remark: '',
      style: { fontSize: 28 },
      children: [],
    });
    const oversized = getNodeContentSize({
      id: 'oversized-font',
      text: 'A long label that needs to stay inside the node frame',
      remark: '',
      style: { fontSize: 96 },
      children: [],
    });

    expect(oversized).toEqual(capped);
    expect(oversized.width).toBeLessThanOrEqual(POSITIONED_LAYOUT.nodeWidth);
  });

  it('grows node bounds for markers and a wrapped tag row', () => {
    const plain = getNodeContentSize({ id: 'plain', text: '任务', remark: '', children: [] });
    const marked = getNodeContentSize({
      id: 'marked',
      text: '任务',
      remark: '已有备注',
      priority: 1,
      progress: 75,
      tags: ['产品设计', '需要评审', '2026 年第三季度'],
      children: [],
    });

    expect(marked.height).toBeGreaterThan(plain.height);
    expect(marked.width).toBeGreaterThanOrEqual(plain.width);
  });

  it('reuses content measurements for unchanged text and font attributes', () => {
    const first = measureNodeText('缓存测量', 16, true);
    const second = measureNodeText('缓存测量', 16, true);

    expect(second).toBe(first);
  });

  it('uses smaller compact density gaps without overlapping automatic subtrees', () => {
    const source: MindmapNode = {
      id: 'root', text: '中心', remark: '', children: [
        { id: 'a', text: '分支 A', remark: '', children: [{ id: 'a-1', text: 'A1', remark: '', children: [] }] },
        { id: 'b', text: '分支 B', remark: '', children: [{ id: 'b-1', text: 'B1', remark: '', children: [] }] },
      ],
    };
    const compact = createMindmapLayout(source, [], 'compact');
    const comfortable = createMindmapLayout(source, [], 'comfortable');
    const compactA = compact.nodes.find((node) => node.id === 'a')!;
    const compactB = compact.nodes.find((node) => node.id === 'b')!;
    const comfortableA = comfortable.nodes.find((node) => node.id === 'a')!;
    const comfortableB = comfortable.nodes.find((node) => node.id === 'b')!;

    expect(LAYOUT_DENSITY_CONFIG.compact.levelGap).toBeLessThan(LAYOUT_DENSITY_CONFIG.comfortable.levelGap);
    expect(LAYOUT_DENSITY_CONFIG.compact.siblingGap).toBeLessThan(LAYOUT_DENSITY_CONFIG.comfortable.siblingGap);
    expect(LAYOUT_DENSITY_CONFIG.compact.subtreeGap).toBeLessThan(LAYOUT_DENSITY_CONFIG.comfortable.subtreeGap);
    expect(compactB.y).toBeGreaterThanOrEqual(compactA.y + compactA.height + LAYOUT_DENSITY_CONFIG.compact.siblingGap);
    expect(comfortableB.y - comfortableA.y).toBeGreaterThan(compactB.y - compactA.y);
  });

  it('uses real long-text and marker bounds while keeping compact layout boxes separate', () => {
    const source: MindmapNode = {
      id: 'root', text: '中心主题', remark: '', children: [
        { id: 'long', text: '这是一个带有较长文本的节点，用于验证紧凑布局不会压缩真实内容边界', remark: '', tags: ['产品设计', '待评审'], priority: 1, progress: 75, children: [] },
        { id: 'marked', text: '带标签和状态的节点', remark: '备注', tags: ['第二个标签', '第三个标签'], priority: 3, progress: 50, children: [] },
        { id: 'nested', text: '子树节点', remark: '', children: [{ id: 'nested-child', text: '嵌套长文本节点用于验证真实尺寸', remark: '', children: [] }] },
      ],
    };
    const compact = createMindmapLayout(source, [], 'compact');

    compact.nodes.forEach((node, index) => {
      compact.nodes.slice(index + 1).forEach((other) => {
        const overlaps =
          node.x < other.x + other.width &&
          node.x + node.width > other.x &&
          node.y < other.y + other.height &&
          node.y + node.height > other.y;
        expect(overlaps).toBe(false);
      });
    });
    expect(compact.lines).toHaveLength(4);
  });

  it('keeps roughly 25 default-size Chinese characters on a single normal-node line', () => {
    const size = getNodeContentSize({
      id: 'wide-cjk',
      text: '一二三四五六七八九十一二三四五六七八九十一二三四五',
      remark: '',
      children: [],
    });

    expect(size.lineCount).toBe(1);
    expect(size.width).toBeGreaterThanOrEqual(430);
  });
});
