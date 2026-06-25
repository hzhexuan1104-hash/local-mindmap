import { describe, expect, it } from 'vitest';
import {
  applyNodeTypeToNodes,
  deleteNodesByIds,
  getDeletableSelectedNodeIds,
  normalizeSelectionState,
  resolveBoxSelectionState,
  resolveNodeClickSelection,
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

  it('keeps blank canvas selection empty', () => {
    expect(
      normalizeSelectionState({
        selectedNodeId: null,
        selectedNodeIds: [],
      }),
    ).toEqual({
      selectedNodeId: null,
      selectedNodeIds: [],
    });
  });

  it('does not add root when ctrl or shift clicking after blank canvas selection', () => {
    expect(
      resolveNodeClickSelection(
        {
          selectedNodeId: null,
          selectedNodeIds: [],
        },
        'child-1',
        true,
      ),
    ).toEqual({
      selectedNodeId: 'child-1',
      selectedNodeIds: ['child-1'],
    });
  });

  it('keeps primary node id inside selected node ids after ctrl toggle', () => {
    expect(
      resolveNodeClickSelection(
        {
          selectedNodeId: 'child-1',
          selectedNodeIds: ['child-1'],
        },
        'child-1',
        true,
      ),
    ).toEqual({
      selectedNodeId: null,
      selectedNodeIds: [],
    });
  });

  it('replaces old selected node id after non-shift box selection', () => {
    expect(
      resolveBoxSelectionState(
        {
          selectedNodeId: 'child-2',
          selectedNodeIds: ['child-2'],
        },
        ['root', 'child-1'],
        false,
      ),
    ).toEqual({
      selectedNodeId: 'child-1',
      selectedNodeIds: ['root', 'child-1'],
    });
  });

  it('keeps only current hits after non-shift box selection', () => {
    const selection = resolveBoxSelectionState(
      {
        selectedNodeId: 'child-2',
        selectedNodeIds: ['child-2'],
      },
      ['root', 'child-1'],
      false,
    );

    expect(selection.selectedNodeIds).toEqual(['root', 'child-1']);
    expect(selection.selectedNodeIds).not.toContain('child-2');
    expect(selection.selectedNodeId === null || selection.selectedNodeIds.includes(selection.selectedNodeId)).toBe(
      true,
    );
  });

  it('clears primary node id when non-shift box selection hits nothing', () => {
    expect(
      resolveBoxSelectionState(
        {
          selectedNodeId: 'child-2',
          selectedNodeIds: ['child-2'],
        },
        [],
        false,
      ),
    ).toEqual({
      selectedNodeId: null,
      selectedNodeIds: [],
    });
  });

  it('keeps selected node id inside selected node ids for shift box selection', () => {
    expect(
      resolveBoxSelectionState(
        {
          selectedNodeId: 'missing',
          selectedNodeIds: ['child-1'],
        },
        ['child-2'],
        true,
      ),
    ).toEqual({
      selectedNodeId: 'child-2',
      selectedNodeIds: ['child-1', 'child-2'],
    });
  });

  it('does not add root when shift box selection starts from empty selection', () => {
    expect(
      resolveBoxSelectionState(
        {
          selectedNodeId: null,
          selectedNodeIds: [],
        },
        ['child-1', 'child-2'],
        true,
      ),
    ).toEqual({
      selectedNodeId: 'child-2',
      selectedNodeIds: ['child-1', 'child-2'],
    });
  });

  it('falls back to the last selected id when shift box selection has no new hits', () => {
    expect(
      resolveBoxSelectionState(
        {
          selectedNodeId: 'missing',
          selectedNodeIds: ['child-1', 'child-2'],
        },
        [],
        true,
      ),
    ).toEqual({
      selectedNodeId: 'child-2',
      selectedNodeIds: ['child-1', 'child-2'],
    });
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
