export type EscapeNavigationState = {
  isCommandPaletteOpen: boolean;
  hasExcelImportPreview: boolean;
  isPluginManagerVisible: boolean;
  isShortcutHelpVisible: boolean;
  hasVersionPreview: boolean;
  isVersionHistoryVisible: boolean;
  isRecoveryCenterVisible: boolean;
  isFileStatusVisible: boolean;
  hasContextMenu: boolean;
  isBoxSelecting: boolean;
  isDragging: boolean;
  hasWorkspacePanel: boolean;
  hasSelection: boolean;
};

export type EscapeNavigationAction =
  | 'close-command-palette'
  | 'close-excel-import'
  | 'close-plugin-manager'
  | 'close-shortcut-help'
  | 'clear-version-preview'
  | 'close-version-history'
  | 'close-recovery-center'
  | 'close-file-status'
  | 'close-context-menu'
  | 'cancel-box-selection'
  | 'cancel-drag'
  | 'close-workspace-panel'
  | 'clear-selection';

/** Returns the immediate parent surface for the current escape-navigation state. */
export function getEscapeNavigationAction(
  state: EscapeNavigationState,
): EscapeNavigationAction | null {
  if (state.isCommandPaletteOpen) return 'close-command-palette';
  if (state.hasExcelImportPreview) return 'close-excel-import';
  if (state.isPluginManagerVisible) return 'close-plugin-manager';
  if (state.isShortcutHelpVisible) return 'close-shortcut-help';
  if (state.hasVersionPreview) return 'clear-version-preview';
  if (state.isVersionHistoryVisible) return 'close-version-history';
  if (state.isRecoveryCenterVisible) return 'close-recovery-center';
  if (state.isFileStatusVisible) return 'close-file-status';
  if (state.hasContextMenu) return 'close-context-menu';
  if (state.isBoxSelecting) return 'cancel-box-selection';
  if (state.isDragging) return 'cancel-drag';
  if (state.hasWorkspacePanel) return 'close-workspace-panel';
  return state.hasSelection ? 'clear-selection' : null;
}
