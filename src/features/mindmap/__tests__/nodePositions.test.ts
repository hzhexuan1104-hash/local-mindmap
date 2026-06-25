import { describe, expect, it } from 'vitest';
import { updateNodePositionById } from '../nodePositions';
import { moveNodeAsChild } from '../treeOperations';
import type { MindmapNode } from '../types';

const createMindmap = (): MindmapNode => ({
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

describe('node position helpers', () => {
  it('updates root node position to a negative x value', () => {
    const nextMindmap = updateNodePositionById(createMindmap(), 'root', {
      x: -120,
      y: 40,
    });

    expect(nextMindmap.position).toEqual({ x: -120, y: 40 });
  });

  it('updates root node position to a negative y value', () => {
    const nextMindmap = updateNodePositionById(createMindmap(), 'root', {
      x: 40,
      y: -90,
    });

    expect(nextMindmap.position).toEqual({ x: 40, y: -90 });
  });

  it('updates normal node position to negative x and y values', () => {
    const nextMindmap = updateNodePositionById(createMindmap(), 'child', {
      x: -80,
      y: -60,
    });

    expect(nextMindmap.children[0].position).toEqual({ x: -80, y: -60 });
  });

  it('keeps root structural protection separate from root position updates', () => {
    const positionedMindmap = updateNodePositionById(createMindmap(), 'root', {
      x: -120,
      y: -90,
    });

    expect(moveNodeAsChild(positionedMindmap, 'root', 'child')).toBeNull();
    expect(positionedMindmap.position).toEqual({ x: -120, y: -90 });
  });
});
