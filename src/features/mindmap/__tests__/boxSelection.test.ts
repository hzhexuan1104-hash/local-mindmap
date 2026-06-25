import { describe, expect, it } from 'vitest';
import {
  getBoxSelectionGeometry,
  getSelectionRect,
  hitTestNodesInRect,
  isCanvasInteractionBlockedTarget,
  mergeBoxSelection,
  screenToCanvasPoint,
  shouldStartCanvasPan,
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

  it('hit-tests nodes by center point inside the selection rectangle', () => {
    const selectedIds = hitTestNodesInRect(
      { left: 50, top: 50, width: 100, height: 100 },
      [
        { id: 'inside', left: 80, top: 80, width: 40, height: 40 },
        { id: 'edge-overlap', left: 130, top: 130, width: 80, height: 80 },
        { id: 'outside', left: 200, top: 200, width: 40, height: 40 },
      ],
    );

    expect(selectedIds).toEqual(['inside']);
  });

  it('does not hit an edge-overlapping node whose center is outside the selection rectangle', () => {
    const selectedIds = hitTestNodesInRect(
      { left: 0, top: 0, width: 100, height: 100 },
      [
        { id: 'first', left: 10, top: 10, width: 20, height: 20 },
        { id: 'second', left: 75, top: 75, width: 40, height: 40 },
        { id: 'edge-only', left: 90, top: 20, width: 40, height: 40 },
      ],
    );

    expect(selectedIds).toEqual(['first', 'second']);
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

  it('converts screen coordinates with zoom, pan, and scroll offset', () => {
    expect(
      screenToCanvasPoint(
        { x: 260, y: 170 },
        { left: 20, top: 10 },
        { offsetX: 40, offsetY: 20, scale: 2 },
        { x: 60, y: 40 },
      ),
    ).toEqual({ x: 130, y: 90 });
  });

  it('uses converted canvas coordinates for stable zoom and pan hit-testing', () => {
    const canvasView = { offsetX: 40, offsetY: 20, scale: 2 };
    const viewport = { left: 20, top: 10 };
    const start = screenToCanvasPoint({ x: 240, y: 210 }, viewport, canvasView);
    const end = screenToCanvasPoint({ x: 480, y: 330 }, viewport, canvasView);

    expect(
      hitTestNodesInRect(getSelectionRect(start, end), [
        { id: 'first', left: 80, top: 80, width: 40, height: 40 },
        { id: 'second', left: 160, top: 110, width: 40, height: 40 },
        { id: 'third', left: 220, top: 80, width: 40, height: 40 },
      ]),
    ).toEqual(['first', 'second']);
  });

  it('builds viewport and canvas selection rectangles from the same screen points', () => {
    const geometry = getBoxSelectionGeometry({
      screenStart: { x: 140, y: 110 },
      screenCurrent: { x: 340, y: 270 },
      canvasViewportRect: { left: 100, top: 80 },
      canvasView: { offsetX: 40, offsetY: 20, scale: 2 },
      scrollOffset: { x: 10, y: 6 },
    });

    expect(geometry.viewportRect).toEqual({
      left: 50,
      top: 36,
      width: 200,
      height: 160,
    });
    expect(geometry.canvasRect).toEqual({
      left: 5,
      top: 8,
      width: 100,
      height: 80,
    });
  });

  it('uses the pan layer viewport as the world origin when it differs from the canvas viewport', () => {
    const geometry = getBoxSelectionGeometry({
      screenStart: { x: 180, y: 320 },
      screenCurrent: { x: 850, y: 585 },
      canvasViewportRect: { left: 114, top: 169 },
      worldViewportRect: { left: 114, top: 248 },
      canvasView: { offsetX: 0, offsetY: 0, scale: 1 },
    });

    expect(geometry.viewportRect).toEqual({
      left: 66,
      top: 151,
      width: 670,
      height: 265,
    });
    expect(geometry.canvasRect).toEqual({
      left: 66,
      top: 72,
      width: 670,
      height: 265,
    });
    expect(
      hitTestNodesInRect(geometry.canvasRect, [
        { id: 'upper-child', left: 496, top: 96, width: 220, height: 72 },
        { id: 'middle-child', left: 496, top: 256, width: 220, height: 72 },
        { id: 'lower-child', left: 496, top: 416, width: 220, height: 72 },
      ]),
    ).toEqual(['upper-child', 'middle-child']);
  });

  it('selects a node whose center is inside the visual selection after zoom and pan', () => {
    const geometry = getBoxSelectionGeometry({
      screenStart: { x: 220, y: 180 },
      screenCurrent: { x: 520, y: 420 },
      canvasViewportRect: { left: 100, top: 80 },
      canvasView: { offsetX: 60, offsetY: 40, scale: 1.5 },
    });

    expect(
      hitTestNodesInRect(geometry.canvasRect, [
        { id: 'inside', left: 100, top: 100, width: 80, height: 60 },
        { id: 'outside-center', left: 240, top: 120, width: 120, height: 80 },
      ]),
    ).toEqual(['inside']);
  });

  it('keeps center-point hit-testing aligned after canvas scroll', () => {
    const geometry = getBoxSelectionGeometry({
      screenStart: { x: 180, y: 140 },
      screenCurrent: { x: 380, y: 300 },
      canvasViewportRect: { left: 100, top: 80 },
      canvasView: { offsetX: -30, offsetY: -20, scale: 1 },
      scrollOffset: { x: 120, y: 60 },
    });

    expect(
      hitTestNodesInRect(geometry.canvasRect, [
        { id: 'inside', left: 220, top: 150, width: 80, height: 60 },
        { id: 'edge-only', left: 390, top: 150, width: 120, height: 60 },
      ]),
    ).toEqual(['inside']);
  });

  it('merges shift box selection with the current selection', () => {
    expect(mergeBoxSelection(['root', 'a'], ['a', 'b'], true)).toEqual([
      'root',
      'a',
      'b',
    ]);
    expect(mergeBoxSelection(['root', 'a'], ['b'], false)).toEqual(['b']);
  });

  it('starts box selection only from a shift-left-button empty canvas area', () => {
    expect(
      shouldStartBoxSelection({
        button: 0,
        isOnInteractiveElement: false,
        shiftKey: true,
      }),
    ).toBe(true);
    expect(
      shouldStartBoxSelection({
        button: 0,
        isOnInteractiveElement: false,
        shiftKey: false,
      }),
    ).toBe(false);
    expect(
      shouldStartBoxSelection({
        button: 2,
        isOnInteractiveElement: false,
        shiftKey: true,
      }),
    ).toBe(false);
    expect(
      shouldStartBoxSelection({
        button: 0,
        isOnInteractiveElement: true,
        shiftKey: true,
      }),
    ).toBe(false);
  });

  it('starts canvas pan only from a non-shift left-button empty canvas area', () => {
    expect(
      shouldStartCanvasPan({
        button: 0,
        isOnInteractiveElement: false,
        shiftKey: false,
      }),
    ).toBe(true);
    expect(
      shouldStartCanvasPan({
        button: 0,
        isOnInteractiveElement: false,
        shiftKey: true,
      }),
    ).toBe(false);
    expect(
      shouldStartCanvasPan({
        button: 2,
        isOnInteractiveElement: false,
        shiftKey: false,
      }),
    ).toBe(false);
    expect(
      shouldStartCanvasPan({
        button: 0,
        isOnInteractiveElement: true,
        shiftKey: false,
      }),
    ).toBe(false);
  });

  it('blocks canvas interactions from form controls and buttons', () => {
    const createTarget = (selectorToken: string) => ({
      closest: (selector: string) =>
        selector.includes(selectorToken) ? {} : null,
    });

    expect(isCanvasInteractionBlockedTarget(createTarget('button'))).toBe(true);
    expect(isCanvasInteractionBlockedTarget(createTarget('input'))).toBe(true);
    expect(isCanvasInteractionBlockedTarget(createTarget('textarea'))).toBe(true);
    expect(isCanvasInteractionBlockedTarget(createTarget('select'))).toBe(true);
    expect(
      isCanvasInteractionBlockedTarget(createTarget('[contenteditable="true"]')),
    ).toBe(true);
    expect(isCanvasInteractionBlockedTarget({ closest: () => null })).toBe(
      false,
    );
  });
});
