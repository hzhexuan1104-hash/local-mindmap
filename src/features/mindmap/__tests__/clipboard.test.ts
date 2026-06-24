import { describe, expect, it } from 'vitest';
import {
  cloneNodeSubtreeWithNewIds,
  collectSelectedSubtrees,
  cutNodesSafely,
  duplicateNodeAsSibling,
  hasDuplicateIds,
  pasteNodesAsChildren,
  validateTreeIntegrity,
} from '../clipboard';
import type { MindmapNode } from '../types';

function createIdGenerator() {
  let index = 0;
  return () => {
    index += 1;
    return `new-${index}`;
  };
}

const mindmap: MindmapNode = {
  id: 'root',
  text: '中心主题',
  remark: 'root remark',
  collapsed: false,
  position: { x: 0, y: 0 },
  children: [
    {
      id: 'child-1',
      text: '子节点 1',
      remark: 'remark 1',
      nodeTypeId: 'type-task',
      collapsed: true,
      position: { x: 10, y: 20 },
      children: [
        {
          id: 'grandchild-1',
          text: '孙节点 1',
          remark: 'grand remark',
          nodeTypeId: 'type-risk',
          position: { x: 30, y: 40 },
          children: [],
        },
      ],
    },
    {
      id: 'child-2',
      text: '子节点 2',
      remark: 'remark 2',
      children: [],
    },
  ],
};

describe('mindmap clipboard helpers', () => {
  it('clones a single node with a new id', () => {
    const clonedNode = cloneNodeSubtreeWithNewIds(mindmap.children[1], {
      generateId: createIdGenerator(),
    });

    expect(clonedNode.id).toBe('new-1');
    expect(clonedNode.id).not.toBe('child-2');
    expect(clonedNode.text).toBe('子节点 2');
  });

  it('clones a complete subtree with new ids for all descendants', () => {
    const clonedNode = cloneNodeSubtreeWithNewIds(mindmap.children[0], {
      generateId: createIdGenerator(),
    });

    expect(clonedNode.id).toBe('new-1');
    expect(clonedNode.children[0].id).toBe('new-2');
    expect(clonedNode.children[0].id).not.toBe('grandchild-1');
  });

  it('keeps text, remark, node type, collapsed state, and position when cloning', () => {
    const clonedNode = cloneNodeSubtreeWithNewIds(mindmap.children[0], {
      generateId: createIdGenerator(),
    });

    expect(clonedNode.text).toBe('子节点 1');
    expect(clonedNode.remark).toBe('remark 1');
    expect(clonedNode.nodeTypeId).toBe('type-task');
    expect(clonedNode.collapsed).toBe(true);
    expect(clonedNode.position).toEqual({ x: 10, y: 20 });
  });

  it('pastes nodes as children under the target node', () => {
    const result = pasteNodesAsChildren(
      mindmap,
      'child-2',
      [mindmap.children[0]],
      { generateId: createIdGenerator() },
    );

    const targetNode = result.rootNode.children[1];
    expect(targetNode.children).toHaveLength(1);
    expect(targetNode.children[0].id).toBe('new-1');
    expect(targetNode.children[0].children[0].id).toBe('new-2');
  });

  it('pastes multiple nodes while keeping each subtree structure', () => {
    const copiedNodes = collectSelectedSubtrees(mindmap, ['child-1', 'child-2']);
    const result = pasteNodesAsChildren(mindmap, 'root', copiedNodes, {
      generateId: createIdGenerator(),
    });

    expect(result.rootNode.children).toHaveLength(4);
    expect(result.pastedNodeIds).toEqual(['new-1', 'new-3']);
    expect(result.rootNode.children[2].children[0].id).toBe('new-2');
    expect(result.rootNode.children[3].text).toBe('子节点 2');
  });

  it('does not allow cutting the root node', () => {
    const result = cutNodesSafely(mindmap, ['root'], 'root');

    expect(result.skippedRoot).toBe(true);
    expect(result.cutNodes).toEqual([]);
    expect(result.cutNodeIds).toEqual([]);
  });

  it('skips root when cutting a multi-selection', () => {
    const result = cutNodesSafely(mindmap, ['root', 'child-1'], 'root');

    expect(result.skippedRoot).toBe(true);
    expect(result.cutNodeIds).toEqual(['child-1']);
    expect(result.cutNodes[0].children[0].id).toBe('grandchild-1');
  });

  it('duplicates a node as a sibling under the same parent', () => {
    const result = duplicateNodeAsSibling(mindmap, 'child-1', {
      generateId: createIdGenerator(),
    });

    expect(result).not.toBeNull();
    expect(result?.rootNode.children).toHaveLength(3);
    expect(result?.rootNode.children[2].id).toBe('new-1');
    expect(result?.rootNode.children[2].children[0].id).toBe('new-2');
  });

  it('duplicates root as a normal child of root', () => {
    const result = duplicateNodeAsSibling(mindmap, 'root', {
      generateId: createIdGenerator(),
    });

    expect(result?.rootNode.id).toBe('root');
    expect(result?.rootNode.children[2].id).toBe('new-1');
    expect(result?.rootNode.children[2].text).toBe('中心主题');
  });

  it('does not create duplicate ids after paste', () => {
    const result = pasteNodesAsChildren(
      mindmap,
      'root',
      [mindmap.children[0], mindmap.children[1]],
      { generateId: createIdGenerator() },
    );

    expect(hasDuplicateIds(result.rootNode)).toBe(false);
    expect(validateTreeIntegrity(result.rootNode).valid).toBe(true);
  });

  it('detects duplicate ids and cyclic children', () => {
    const duplicateTree: MindmapNode = {
      id: 'root',
      text: 'root',
      remark: '',
      children: [
        { id: 'same', text: 'a', remark: '', children: [] },
        { id: 'same', text: 'b', remark: '', children: [] },
      ],
    };
    const cyclicRoot: MindmapNode = {
      id: 'root',
      text: 'root',
      remark: '',
      children: [],
    };
    cyclicRoot.children.push(cyclicRoot);

    expect(hasDuplicateIds(duplicateTree)).toBe(true);
    expect(validateTreeIntegrity(duplicateTree).valid).toBe(false);
    expect(validateTreeIntegrity(cyclicRoot).valid).toBe(false);
  });
});
