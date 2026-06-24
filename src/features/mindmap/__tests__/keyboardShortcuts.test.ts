import { describe, expect, it } from 'vitest';
import {
  getKeyboardShortcutAction,
  isEditableShortcutTarget,
  type KeyboardShortcutState,
} from '../keyboardShortcuts';

const defaultState: KeyboardShortcutState = {
  hasModalOpen: false,
  hasContextMenuOpen: false,
  isBoxSelecting: false,
  hasSelection: true,
};

describe('keyboard shortcut helpers', () => {
  it('returns select-all for Ctrl+A outside editable elements', () => {
    expect(
      getKeyboardShortcutAction({ key: 'a', ctrlKey: true }, defaultState),
    ).toBe('select-all');
  });

  it('does not intercept Ctrl+A inside input, textarea, select, or contenteditable', () => {
    const editableTargets = [
      { closest: () => ({ tagName: 'INPUT' }) },
      { closest: () => ({ tagName: 'TEXTAREA' }) },
      { closest: () => ({ tagName: 'SELECT' }) },
      { closest: () => ({ getAttribute: () => 'true' }) },
    ] as unknown as EventTarget[];

    editableTargets.forEach((target) => {
      expect(isEditableShortcutTarget(target)).toBe(true);
      expect(
        getKeyboardShortcutAction(
          { key: 'a', ctrlKey: true, target },
          defaultState,
        ),
      ).toBeNull();
    });
  });

  it('maps supported editing shortcuts', () => {
    expect(getKeyboardShortcutAction({ key: 'z', ctrlKey: true }, defaultState)).toBe(
      'undo',
    );
    expect(getKeyboardShortcutAction({ key: 'y', ctrlKey: true }, defaultState)).toBe(
      'redo',
    );
    expect(getKeyboardShortcutAction({ key: 'c', ctrlKey: true }, defaultState)).toBe(
      'copy',
    );
    expect(getKeyboardShortcutAction({ key: 'x', ctrlKey: true }, defaultState)).toBe(
      'cut',
    );
    expect(getKeyboardShortcutAction({ key: 'v', ctrlKey: true }, defaultState)).toBe(
      'paste',
    );
    expect(getKeyboardShortcutAction({ key: 'd', ctrlKey: true }, defaultState)).toBe(
      'duplicate',
    );
  });

  it('maps save, open, and delete shortcuts', () => {
    expect(getKeyboardShortcutAction({ key: 's', ctrlKey: true }, defaultState)).toBe(
      'save',
    );
    expect(getKeyboardShortcutAction({ key: 'o', ctrlKey: true }, defaultState)).toBe(
      'open',
    );
    expect(getKeyboardShortcutAction({ key: 'Delete' }, defaultState)).toBe(
      'delete',
    );
    expect(getKeyboardShortcutAction({ key: 'Backspace' }, defaultState)).toBe(
      'delete',
    );
  });

  it('uses Escape for modal, context menu, box selection, then normal selection clearing', () => {
    expect(
      getKeyboardShortcutAction(
        { key: 'Escape' },
        { ...defaultState, hasModalOpen: true },
      ),
    ).toBe('close-or-clear');
    expect(
      getKeyboardShortcutAction(
        { key: 'Escape' },
        { ...defaultState, hasContextMenuOpen: true },
      ),
    ).toBe('close-or-clear');
    expect(
      getKeyboardShortcutAction(
        { key: 'Escape' },
        { ...defaultState, isBoxSelecting: true },
      ),
    ).toBe('close-or-clear');
    expect(getKeyboardShortcutAction({ key: 'Escape' }, defaultState)).toBe(
      'close-or-clear',
    );
    expect(
      getKeyboardShortcutAction(
        { key: 'Escape' },
        { ...defaultState, hasSelection: false },
      ),
    ).toBeNull();
  });
});
