import { describe, expect, it } from 'vitest';
import {
  getSelectionRect,
  hitTestNodesInRect,
  mergeBoxSelection,
  screenToCanvasPoint,
  shouldStartBoxSelection,
} from '../boxSelection';

describe('box selection helpers', () => {
  it('calculates a selection rectangle from top-left to bottom-right drag', () => {
    expect(getSelectionRect({ x: 10, y: 20 }, { x: 80, y: 120 })).toEqual({
      left: 10,
      top: 20,
      width: 70,
      height: 100,
    });
  });

  it('calculates a selection rectangle when dragging in the opposite direction', () => {
    expect(getSelectionRect({ x: 80, y: 120 }, { x: 10, y: 20 })).toEqual({
      left: 10,
      top: 20,
      width: 70,
      height: 100,
    });
  });

  it('hit-tests nodes that intersect the selection rectangle', () => {
    const selectedIds = hitTestNodesInRect(
      { left: 50, top: 50, width: 100, height: 100 },
      [
        { id: 'inside', left: 80, top: 80, width: 40, height: 40 },
        { id: 'intersecting', left: 130, top: 130, width: 80, height: 80 },
        { id: 'outside', left: 200, top: 200, width: 40, height: 40 },
      ],
    );

    expect(selectedIds).toEqual(['inside', 'intersecting']);
  });

  it('does not hit nodes outside the selection rectangle', () => {
    expect(
      hitTestNodesInRect(
        { left: 0, top: 0, width: 40, height: 40 },
        [{ id: 'outside', left: 80, top: 80, width: 40, height: 40 }],
      ),
    ).toEqual([]);
  });

  it('converts screen coordinates to canvas coordinates with zoom and pan', () => {
    expect(
      screenToCanvasPoint(
        { x: 260, y: 170 },
        { left: 20, top: 10 },
        { offsetX: 40, offsetY: 20, scale: 2 },
      ),
    ).toEqual({ x: 100, y: 70 });
  });

  it('merges shift box selection with the current selection', () => {
    expect(mergeBoxSelection(['root', 'a'], ['a', 'b'], true)).toEqual([
      'root',
      'a',
      'b',
    ]);
    expect(mergeBoxSelection(['root', 'a'], ['b'], false)).toEqual(['b']);
  });

  it('starts box selection only from a left-button empty canvas area', () => {
    expect(
      shouldStartBoxSelection({ button: 0, isOnInteractiveElement: false }),
    ).toBe(true);
    expect(
      shouldStartBoxSelection({ button: 2, isOnInteractiveElement: false }),
    ).toBe(false);
    expect(
      shouldStartBoxSelection({ button: 0, isOnInteractiveElement: true }),
    ).toBe(false);
  });
});
