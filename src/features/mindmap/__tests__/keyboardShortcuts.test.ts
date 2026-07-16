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
  isEditingNodeText: false,
};

describe('keyboard shortcut helpers', () => {
  it('returns select-all for Ctrl+A outside editable elements', () => {
    expect(
      getKeyboardShortcutAction({ key: 'a', ctrlKey: true }, defaultState),
    ).toBe('select-all');
  });

  it('does not intercept shortcuts inside input, textarea, select, button, or contenteditable', () => {
    const editableTargets = [
      { closest: () => ({ tagName: 'INPUT' }) },
      { closest: () => ({ tagName: 'TEXTAREA' }) },
      { closest: () => ({ tagName: 'SELECT' }) },
      { closest: () => ({ tagName: 'BUTTON' }) },
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
      expect(
        getKeyboardShortcutAction({ key: 'Insert', target }, defaultState),
      ).toBeNull();
      expect(
        getKeyboardShortcutAction({ key: 'Enter', target }, defaultState),
      ).toBeNull();
    });
  });

  it('keeps Escape available inside editable elements to return from an open window', () => {
    const target = {
      closest: () => ({ tagName: 'TEXTAREA' }),
    } as unknown as EventTarget;

    expect(
      getKeyboardShortcutAction(
        { key: 'Escape', target },
        { ...defaultState, hasModalOpen: true },
      ),
    ).toBe('close-or-clear');
    expect(
      getKeyboardShortcutAction({ key: 'Escape', target }, defaultState),
    ).toBeNull();
  });

  it('maps Insert and Enter to node creation shortcuts outside editable elements', () => {
    expect(getKeyboardShortcutAction({ key: 'Insert' }, defaultState)).toBe(
      'add-child',
    );
    expect(getKeyboardShortcutAction({ key: 'Tab' }, defaultState)).toBeNull();
    expect(getKeyboardShortcutAction({ key: 'Enter' }, defaultState)).toBe(
      'add-sibling',
    );
  });

  it('does not map Insert or Enter while editing, without selection, or while UI overlays are active', () => {
    expect(
      getKeyboardShortcutAction(
        { key: 'Insert' },
        { ...defaultState, isEditingNodeText: true },
      ),
    ).toBeNull();
    expect(
      getKeyboardShortcutAction(
        { key: 'Enter' },
        { ...defaultState, hasSelection: false },
      ),
    ).toBeNull();
    expect(
      getKeyboardShortcutAction(
        { key: 'Insert' },
        { ...defaultState, hasModalOpen: true },
      ),
    ).toBeNull();
    expect(
      getKeyboardShortcutAction(
        { key: 'Enter' },
        { ...defaultState, isBoxSelecting: true },
      ),
    ).toBeNull();
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

  it('maps find and replace shortcuts', () => {
    expect(getKeyboardShortcutAction({ key: 'f', ctrlKey: true }, defaultState)).toBe(
      'find',
    );
    expect(getKeyboardShortcutAction({ key: 'h', ctrlKey: true }, defaultState)).toBe(
      'replace',
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
