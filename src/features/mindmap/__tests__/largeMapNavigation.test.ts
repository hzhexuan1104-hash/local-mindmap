import { describe, expect, it } from 'vitest';
import { expandToDepth } from '../collapseState';
import { getFocusBreadcrumb, getFocusedRoot } from '../focusMode';
import { generateLargeMindmap } from '../largeMapGenerator';
import { createMindmapIndex } from '../mindmapIndex';
import { createOutlineRows, getVirtualRows } from '../outlineNavigation';
import { expandViewport, getVisibleNodeIds, getWorldViewport, intersectsNodeBounds } from '../viewportCulling';

describe('large map navigation primitives', () => {
  it('generates a deterministic bounded mind map', () => {
    const options = { nodeCount: 500, maxDepth: 20, maxChildren: 6, includeRemarks: true, includeCustomStyles: true, seed: 9 };
    const first = generateLargeMindmap(options);
    const second = generateLargeMindmap(options);
    expect(first.nodeCount).toBe(500);
    expect(first.rootNode).toEqual(second.rootNode);
    expect(first.maxDepth).toBeLessThanOrEqual(20);
  });

  it('creates stable parent, depth, ancestor and descendant indexes', () => {
    const root = { id: 'root', text: 'root', remark: '', children: [{ id: 'a', text: 'a', remark: '', children: [{ id: 'b', text: 'b', remark: '', children: [] }] }] };
    const index = createMindmapIndex(root);
    expect(index.parentById.get('b')).toBe('a');
    expect(index.depthById.get('b')).toBe(2);
    expect(index.ancestorIds.get('b')).toEqual(['root', 'a']);
    expect(index.descendantCount.get('root')).toBe(2);
    expect(getFocusedRoot(root, index, 'a').id).toBe('a');
    expect(getFocusBreadcrumb(index, 'b').map((node) => node.id)).toEqual(['root', 'a', 'b']);
  });

  it('folds hierarchy and virtualizes outline rows', () => {
    const root = generateLargeMindmap({ nodeCount: 100, maxChildren: 3, seed: 1 }).rootNode;
    const collapsed = expandToDepth(root, 1);
    const index = createMindmapIndex(collapsed);
    const rows = createOutlineRows(index);
    expect(rows.every((row) => row.depth <= 2)).toBe(true);
    const virtual = getVirtualRows(rows, 32, 64, 32, 1);
    expect(virtual.rows.length).toBeLessThanOrEqual(5);
  });

  it('uses world coordinates and overscan for viewport culling', () => {
    const world = getWorldViewport({ scale: 2, offsetX: -100, offsetY: -40 }, { width: 400, height: 200 });
    expect(world).toEqual({ left: 50, top: 20, width: 200, height: 100 });
    const expanded = expandViewport(world, 100, 2);
    expect(intersectsNodeBounds({ id: 'near', x: 10, y: 20, width: 10, height: 10 }, expanded)).toBe(true);
    expect(getVisibleNodeIds([{ id: 'inside', x: 100, y: 30, width: 10, height: 10 }], world, ['forced']).has('forced')).toBe(true);
  });
});
