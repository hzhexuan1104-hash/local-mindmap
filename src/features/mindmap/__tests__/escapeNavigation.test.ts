import { describe, expect, it } from 'vitest';
import {
  getEscapeNavigationAction,
  type EscapeNavigationState,
} from '../escapeNavigation';

const defaultState: EscapeNavigationState = {
  isCommandPaletteOpen: false,
  hasExcelImportPreview: false,
  isPluginManagerVisible: false,
  isShortcutHelpVisible: false,
  hasVersionPreview: false,
  isVersionHistoryVisible: false,
  isRecoveryCenterVisible: false,
  isFileStatusVisible: false,
  hasContextMenu: false,
  isBoxSelecting: false,
  isDragging: false,
  hasWorkspacePanel: false,
  hasSelection: false,
};

describe('escape navigation', () => {
  it('returns from a nested version preview before closing its history window', () => {
    expect(
      getEscapeNavigationAction({
        ...defaultState,
        hasVersionPreview: true,
        isVersionHistoryVisible: true,
        isFileStatusVisible: true,
      }),
    ).toBe('clear-version-preview');
    expect(
      getEscapeNavigationAction({
        ...defaultState,
        isVersionHistoryVisible: true,
        isFileStatusVisible: true,
      }),
    ).toBe('close-version-history');
  });

  it('closes each expanded application window before canvas state', () => {
    expect(
      getEscapeNavigationAction({ ...defaultState, isRecoveryCenterVisible: true }),
    ).toBe('close-recovery-center');
    expect(
      getEscapeNavigationAction({ ...defaultState, isFileStatusVisible: true }),
    ).toBe('close-file-status');
    expect(
      getEscapeNavigationAction({ ...defaultState, hasWorkspacePanel: true }),
    ).toBe('close-workspace-panel');
  });

  it('cancels transient canvas interactions before clearing the selection', () => {
    expect(
      getEscapeNavigationAction({
        ...defaultState,
        hasContextMenu: true,
        isBoxSelecting: true,
      }),
    ).toBe('close-context-menu');
    expect(
      getEscapeNavigationAction({ ...defaultState, isBoxSelecting: true }),
    ).toBe('cancel-box-selection');
    expect(
      getEscapeNavigationAction({ ...defaultState, isDragging: true }),
    ).toBe('cancel-drag');
    expect(
      getEscapeNavigationAction({ ...defaultState, hasSelection: true }),
    ).toBe('clear-selection');
    expect(getEscapeNavigationAction(defaultState)).toBeNull();
  });
});
