import { describe, expect, it } from 'vitest';
import {
  collectNodeIds,
  findParentNode,
  isDescendant,
  moveNodeAsChild,
  validateTreeIntegrity,
} from '../treeOperations';
import type { MindmapNode } from '../types';

const createMindmap = (): MindmapNode => ({
  id: 'root',
  text: 'Center',
  remark: 'root remark',
  collapsed: false,
  position: { x: 0, y: 0 },
  children: [
    {
      id: 'topic-a',
      text: 'Topic A',
      remark: 'remark a',
      nodeTypeId: 'type-task',
      collapsed: true,
      position: { x: 100, y: 20 },
      children: [
        {
          id: 'topic-a-1',
          text: 'Topic A.1',
          remark: 'remark a.1',
          nodeTypeId: 'type-risk',
          collapsed: false,
          position: { x: 220, y: 30 },
          children: [],
        },
      ],
    },
    {
      id: 'topic-b',
      text: 'Topic B',
      remark: 'remark b',
      nodeTypeId: 'type-note',
      collapsed: false,
      position: { x: 100, y: 180 },
      children: [],
    },
  ],
});

describe('mindmap tree operations', () => {
  it('finds a parent node', () => {
    const parentNode = findParentNode(createMindmap(), 'topic-a-1');

    expect(parentNode?.id).toBe('topic-a');
  });

  it('detects descendants', () => {
    const mindmap = createMindmap();

    expect(isDescendant(mindmap, 'topic-a', 'topic-a-1')).toBe(true);
    expect(isDescendant(mindmap, 'topic-b', 'topic-a-1')).toBe(false);
  });

  it('does not move the root node', () => {
    const result = moveNodeAsChild(createMindmap(), 'root', 'topic-a');

    expect(result).toBeNull();
  });

  it('does not move a node under itself', () => {
    const result = moveNodeAsChild(createMindmap(), 'topic-a', 'topic-a');

    expect(result).toBeNull();
  });

  it('does not move a node under one of its descendants', () => {
    const result = moveNodeAsChild(createMindmap(), 'topic-a', 'topic-a-1');

    expect(result).toBeNull();
  });

  it('moves a normal node to the target children', () => {
    const result = moveNodeAsChild(createMindmap(), 'topic-b', 'topic-a');

    expect(result?.rootNode.children[0].children.map((node) => node.id)).toEqual([
      'topic-a-1',
      'topic-b',
    ]);
  });

  it('removes the moved node from the original parent', () => {
    const result = moveNodeAsChild(createMindmap(), 'topic-b', 'topic-a');

    expect(result?.rootNode.children.map((node) => node.id)).toEqual(['topic-a']);
  });

  it('keeps node data while moving', () => {
    const result = moveNodeAsChild(createMindmap(), 'topic-a', 'topic-b');
    const movedNode = result?.rootNode.children[0].children[0];

    expect(movedNode).toMatchObject({
      id: 'topic-a',
      text: 'Topic A',
      remark: 'remark a',
      nodeTypeId: 'type-task',
      collapsed: true,
      position: { x: 100, y: 20 },
    });
  });

  it('keeps ids unique after moving', () => {
    const result = moveNodeAsChild(createMindmap(), 'topic-b', 'topic-a');
    const ids = collectNodeIds(result!.rootNode);

    expect(ids.size).toBe(4);
    expect(validateTreeIntegrity(result!.rootNode).valid).toBe(true);
  });

  it('keeps root node after moving', () => {
    const result = moveNodeAsChild(createMindmap(), 'topic-b', 'topic-a');

    expect(result?.rootNode.id).toBe('root');
  });

  it('detects duplicate ids', () => {
    const mindmap = createMindmap();
    const invalidTree = {
      ...mindmap,
      children: [
        ...mindmap.children,
        { ...mindmap.children[1], text: 'Duplicate Topic B' },
      ],
    };

    const integrity = validateTreeIntegrity(invalidTree);

    expect(integrity.valid).toBe(false);
    expect(integrity.errors.some((error) => error.includes('Duplicate'))).toBe(true);
  });

  it('detects reused node objects as invalid structure', () => {
    const sharedNode: MindmapNode = {
      id: 'shared',
      text: 'Shared',
      remark: '',
      children: [],
    };
    const invalidTree: MindmapNode = {
      id: 'root',
      text: 'Center',
      remark: '',
      children: [
        { id: 'a', text: 'A', remark: '', children: [sharedNode] },
        { id: 'b', text: 'B', remark: '', children: [sharedNode] },
      ],
    };

    const integrity = validateTreeIntegrity(invalidTree);

    expect(integrity.valid).toBe(false);
    expect(integrity.errors.some((error) => error.includes('reused'))).toBe(true);
  });
});
