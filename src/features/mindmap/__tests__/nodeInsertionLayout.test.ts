import { describe, expect, it } from 'vitest';
import { createMindmapLayout, LAYOUT_DENSITY_CONFIG } from '../layout';
import { placeInsertedNodes, type NodeInsertionKind } from '../nodeInsertionLayout';
import { addTypedChildNodes, addTypedParentNodes, addTypedSiblingNodes } from '../typedNodeCreation';
import type { MindmapNode } from '../types';

const leaf = (id: string, position?: MindmapNode['position'], text = id): MindmapNode =>
  ({ id, text, remark: '', children: [], position });

const getBoxes = (root: MindmapNode, density: 'compact' | 'comfortable' = 'compact') =>
  new Map(createMindmapLayout(root, [], density).nodes.map((node) => [node.id, node]));

function create(root: MindmapNode, kind: NodeInsertionKind, ids: string[], density: 'compact' | 'comfortable' = 'compact') {
  const insert = { child: addTypedChildNodes, sibling: addTypedSiblingNodes, parent: addTypedParentNodes }[kind];
  const result = insert(root, ids, [], '')!;
  const updated = placeInsertedNodes(result.rootNode, result.rootNode, result.selectedNodeIds, kind, [], density);
  return { updated, inserted: result.selectedNodeIds, boxes: getBoxes(updated, density) };
}

describe('placement on node insertion', () => {
  it.each(['compact', 'comfortable'] as const)('places repeated children next to a moved parent at %s density', (density) => {
    const original: MindmapNode = {
      ...leaf('root', { x: -40, y: 60 }, '中心主题'),
      collapsed: true,
      children: [leaf('old', { x: 600, y: 210 })],
    };
    const first = create(original, 'child', ['root'], density);
    const second = create(first.updated, 'child', ['root'], density);
    const root = second.boxes.get('root')!;
    const old = second.boxes.get('old')!;
    const one = second.boxes.get(first.inserted[0])!;
    const two = second.boxes.get(second.inserted[0])!;
    const { levelGap, siblingGap } = LAYOUT_DENSITY_CONFIG[density];
    expect(one.x - (root.x + root.width)).toBe(levelGap);
    expect(one.y + one.height / 2).toBe(root.y + root.height / 2);
    expect(two.x).toBe(one.x);
    expect(two.y - (one.y + one.height)).toBe(siblingGap);
    expect(root.node.position).toEqual(original.position);
    expect(old.node.position).toEqual(original.children[0].position);
  });

  it('places batched siblings in open slots without intersecting a tall manually positioned node', () => {
    const original = {
      ...leaf('root', { x: 0, y: 0 }),
      children: [
        leaf('first', { x: 166, y: 0 }),
        { ...leaf('blocker', { x: 166, y: 54 }, '文字与标签让节点更高。'.repeat(9)), tags: ['验收', '需求跟踪'] },
        leaf('second', { x: 166, y: 340 }),
      ],
    };
    const { boxes, inserted, updated } = create(original, 'sibling', ['second', 'first']);
    const blocker = boxes.get('blocker')!;
    const forSecond = boxes.get(inserted[0])!;
    const forFirst = boxes.get(inserted[1])!;
    expect(updated.children.map(({ id }) => id)).toEqual(['first', forFirst.id, 'blocker', 'second', forSecond.id]);
    expect(forFirst.x).toBe(blocker.x);
    expect(forFirst.y).toBeGreaterThan(blocker.y + blocker.height);
    expect(forSecond.y).toBeGreaterThan(boxes.get('second')!.y + boxes.get('second')!.height);
    expect(forFirst.y + forFirst.height <= forSecond.y || forSecond.y + forSecond.height <= forFirst.y).toBe(true);
    expect(blocker.node.position).toEqual(original.children[1].position);
  });

  it.each([400, -400])('inserts a new parent between existing nodes when the child is at x=%s', (x) => {
    const original = { ...leaf('root', { x: 0, y: 50 }), children: [leaf('selected', { x, y: 50 })] };
    const { boxes, inserted } = create(original, 'parent', ['selected']);
    const pair = [boxes.get('selected')!, boxes.get('root')!].sort((a, b) => a.x - b.x);
    const added = boxes.get(inserted[0])!;
    expect(added.x).toBeGreaterThan(pair[0].x + pair[0].width);
    expect(added.x + added.width).toBeLessThan(pair[1].x);
    expect(added.node.children[0].position).toEqual(original.children[0].position);
  });

  it('keeps new nodes automatic on a document without manual positions', () => {
    const original = { ...leaf('root'), children: [leaf('child')] };
    const { boxes, inserted } = create(original, 'sibling', ['child']);
    expect(boxes.get(inserted[0])!.node.position).toBeUndefined();
    expect(boxes.get(inserted[0])!.x).toBe(boxes.get('child')!.x);
  });
});
