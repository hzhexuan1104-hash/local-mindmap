import { describe, expect, it } from 'vitest';
import {
  createHistoryState,
  pushHistory,
  redoHistory,
  undoHistory,
} from '../history';
import {
  createNodeTypePack,
  importNodeTypesFromPack,
} from '../nodeTypePacks';
import { applyNodeTypeToNodes } from '../selection';
import {
  addTypedChildNode,
  addTypedSiblingNode,
  getNodeTypeCreationOptions,
} from '../typedNodeCreation';
import type {
  MindmapNode,
  MindmapNodeType,
  MindmapProject,
} from '../types';

const test1: MindmapNodeType = {
  id: 'type-test1',
  name: 'test1',
  icon: '⭐',
  shape: 'rounded',
  backgroundColor: '#fff5cc',
  borderColor: '#d8a500',
  textColor: '#4a3900',
  fontSize: 16,
  bold: true,
  defaultText: 'test1 节点',
  defaultRemark: 'test1 remark',
};

const createMindmap = (): MindmapNode => ({
  id: 'root',
  text: '中心主题',
  remark: '',
  collapsed: true,
  children: [
    {
      id: 'topic-a',
      text: 'Topic A',
      remark: '',
      children: [],
    },
  ],
});

describe('typed node creation', () => {
  it('lists the default type and custom test1 type for context creation', () => {
    expect(getNodeTypeCreationOptions([test1])).toEqual([
      { value: '', label: '普通节点' },
      { value: 'type-test1', label: 'test1' },
    ]);
  });

  it('creates a test1 child and selects it', () => {
    const mindmap = createMindmap();
    const result = addTypedChildNode(
      mindmap,
      'topic-a',
      [test1],
      test1.id,
    );

    expect(result?.createdNode).toMatchObject({
      text: 'test1 节点',
      remark: 'test1 remark',
      nodeTypeId: test1.id,
    });
    expect(result?.rootNode.children[0].children[0].nodeTypeId).toBe(test1.id);
    expect(result?.selectedNodeId).toBe(result?.createdNode.id);
    expect(result?.selectedNodeIds).toEqual([result?.createdNode.id]);
    expect(result?.createdNode.id).not.toBe('root');
    expect(result?.createdNode.id).not.toBe('topic-a');
  });

  it('creates a test1 sibling under the same parent', () => {
    const mindmap = createMindmap();
    const result = addTypedSiblingNode(
      mindmap,
      'topic-a',
      [test1],
      test1.id,
    );

    expect(result?.rootNode.children).toHaveLength(2);
    expect(result?.rootNode.children[1].nodeTypeId).toBe(test1.id);
    expect(result?.selectedNodeId).toBe(result?.rootNode.children[1].id);
  });

  it('does not create a sibling for the root node', () => {
    expect(
      addTypedSiblingNode(createMindmap(), 'root', [test1], test1.id),
    ).toBeNull();
  });

  it('falls back to a normal node when the type id does not exist', () => {
    const result = addTypedChildNode(
      createMindmap(),
      'root',
      [test1],
      'missing-type',
    );

    expect(result?.createdNode.text).toBe('新节点');
    expect(result?.createdNode.nodeTypeId).toBeUndefined();
  });

  it('uses a node type imported from a node type pack', () => {
    const importedTypes = importNodeTypesFromPack(
      [],
      createNodeTypePack([test1]),
    ).nodeTypes;
    const result = addTypedChildNode(
      createMindmap(),
      'root',
      importedTypes,
      test1.id,
    );

    expect(result?.createdNode.nodeTypeId).toBe(test1.id);
    expect(result?.createdNode.text).toBe(test1.defaultText);
  });

  it('supports undo and redo after typed creation', () => {
    const before: MindmapProject = {
      rootNode: createMindmap(),
      nodeTypes: [test1],
      themeId: 'default-blue',
    };
    const creation = addTypedChildNode(
      before.rootNode,
      'root',
      before.nodeTypes,
      test1.id,
    )!;
    const after: MindmapProject = {
      ...before,
      rootNode: creation.rootNode,
    };
    const history = pushHistory(createHistoryState(), before);
    const undoResult = undoHistory(history, after)!;
    const redoResult = redoHistory(undoResult.history, undoResult.project)!;

    expect(undoResult.project.rootNode.children).toHaveLength(1);
    expect(redoResult.project.rootNode.children).toHaveLength(2);
    expect(redoResult.project.rootNode.children[1].nodeTypeId).toBe(test1.id);
  });

  it('keeps switching the current node type working', () => {
    const switched = applyNodeTypeToNodes(
      createMindmap(),
      new Set(['topic-a']),
      test1.id,
    );

    expect(switched.children[0].nodeTypeId).toBe(test1.id);
  });
});
