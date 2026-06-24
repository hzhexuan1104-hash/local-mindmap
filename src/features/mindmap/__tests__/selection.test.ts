import { describe, expect, it } from 'vitest';
import {
  applyNodeTypeToNodes,
  deleteNodesByIds,
  getDeletableSelectedNodeIds,
  updateSelection,
} from '../selection';
import type { MindmapNode } from '../types';

const mindmap: MindmapNode = {
  id: 'root',
  text: '中心主题',
  remark: '',
  children: [
    {
      id: 'child-1',
      text: '子节点 1',
      remark: '',
      children: [],
    },
    {
      id: 'child-2',
      text: '子节点 2',
      remark: '',
      children: [],
    },
  ],
};

describe('selection helpers', () => {
  it('uses normal click as single selection', () => {
    expect(updateSelection(['root'], 'child-1', { append: false })).toEqual([
      'child-1',
    ]);
  });

  it('adds an unselected node on ctrl or shift append selection', () => {
    expect(updateSelection(['child-1'], 'child-2', { append: true })).toEqual([
      'child-1',
      'child-2',
    ]);
  });

  it('removes an already selected node on ctrl append selection', () => {
    expect(
      updateSelection(['child-1', 'child-2'], 'child-1', { append: true }),
    ).toEqual(['child-2']);
    expect(updateSelection(['child-1'], 'child-1', { append: true })).toEqual([]);
  });

  it('does not overwrite a multi-selection unless append is false', () => {
    const selectedIds = updateSelection(['root', 'child-1'], 'child-2', {
      append: true,
    });

    expect(selectedIds).toEqual(['root', 'child-1', 'child-2']);
    expect(updateSelection(selectedIds, 'child-1', { append: false })).toEqual([
      'child-1',
    ]);
  });

  it('keeps root out of deletable selected node ids', () => {
    expect(getDeletableSelectedNodeIds(['root', 'child-1'], 'root')).toEqual([
      'child-1',
    ]);
    expect(getDeletableSelectedNodeIds(['root'], 'root')).toEqual([]);
  });

  it('deletes selected nodes without deleting root', () => {
    const nextMindmap = deleteNodesByIds(mindmap, new Set(['child-1']));

    expect(nextMindmap.id).toBe('root');
    expect(nextMindmap.children.map((node) => node.id)).toEqual(['child-2']);
  });

  it('applies node type to all selected nodes', () => {
    const nextMindmap = applyNodeTypeToNodes(
      mindmap,
      new Set(['child-1', 'child-2']),
      'type-task',
    );

    expect(nextMindmap.children.every((node) => node.nodeTypeId === 'type-task')).toBe(
      true,
    );
  });
});
