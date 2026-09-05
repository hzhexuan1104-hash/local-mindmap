import { describe, expect, it } from 'vitest';
import {
  clampInspectorWidth,
  DEFAULT_INSPECTOR_WIDTH,
  normalizeUiLayoutSettings,
} from '../uiLayoutSettings';

describe('UI layout settings', () => {
  it('clamps the inspector width to the configured minimum and half the viewport', () => {
    expect(clampInspectorWidth(10, 1200)).toBe(280);
    expect(clampInspectorWidth(900, 1200)).toBe(600);
  });

  it('defaults to compact layout density without writing map data', () => {
    expect(normalizeUiLayoutSettings(null, 1280)).toEqual({
      layoutDensity: 'compact',
      inspectorWidth: DEFAULT_INSPECTOR_WIDTH,
    });
  });
});
