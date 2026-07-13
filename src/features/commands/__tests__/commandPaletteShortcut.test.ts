import { describe, expect, it } from 'vitest';
import { isCommandPaletteShortcut } from '../commandPaletteShortcut';

describe('command palette shortcuts', () => {
  it('accepts Ctrl/Meta+K and the optional Shift+P variants', () => {
    expect(isCommandPaletteShortcut({ key: 'k', ctrlKey: true })).toBe(true);
    expect(isCommandPaletteShortcut({ key: 'K', metaKey: true })).toBe(true);
    expect(isCommandPaletteShortcut({ key: 'p', ctrlKey: true, shiftKey: true })).toBe(true);
    expect(isCommandPaletteShortcut({ key: 'p', metaKey: true, shiftKey: true })).toBe(true);
  });

  it('ignores unrelated keys and IME composition', () => {
    expect(isCommandPaletteShortcut({ key: 'k', ctrlKey: true, isComposing: true })).toBe(false);
    expect(isCommandPaletteShortcut({ key: 'f', ctrlKey: true })).toBe(false);
    expect(isCommandPaletteShortcut({ key: 'k' })).toBe(false);
  });
});
