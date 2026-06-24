export type KeyboardShortcutAction =
  | 'close-or-clear'
  | 'undo'
  | 'redo'
  | 'copy'
  | 'cut'
  | 'paste'
  | 'duplicate'
  | 'select-all'
  | 'save'
  | 'open'
  | 'delete';

export type KeyboardShortcutState = {
  hasModalOpen: boolean;
  hasContextMenuOpen: boolean;
  isBoxSelecting: boolean;
  hasSelection: boolean;
};

export type KeyboardShortcutEventLike = {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  target?: EventTarget | null;
};

export function isEditableShortcutTarget(target: EventTarget | null | undefined) {
  if (!target || typeof target !== 'object') {
    return false;
  }

  const closest = (target as { closest?: (selector: string) => unknown }).closest;

  if (typeof closest !== 'function') {
    return false;
  }

  return Boolean(
    closest.call(target, 'input, textarea, select, [contenteditable="true"]'),
  );
}

export function getKeyboardShortcutAction(
  event: KeyboardShortcutEventLike,
  state: KeyboardShortcutState,
): KeyboardShortcutAction | null {
  if (isEditableShortcutTarget(event.target)) {
    return null;
  }

  if (event.key === 'Escape') {
    return state.hasModalOpen ||
      state.hasContextMenuOpen ||
      state.isBoxSelecting ||
      state.hasSelection
      ? 'close-or-clear'
      : null;
  }

  if (event.key === 'Delete' || event.key === 'Backspace') {
    return 'delete';
  }

  const usesCommandKey = Boolean(event.ctrlKey || event.metaKey);

  if (!usesCommandKey) {
    return null;
  }

  switch (event.key.toLowerCase()) {
    case 'z':
      return 'undo';
    case 'y':
      return 'redo';
    case 'c':
      return 'copy';
    case 'x':
      return 'cut';
    case 'v':
      return 'paste';
    case 'd':
      return 'duplicate';
    case 'a':
      return 'select-all';
    case 's':
      return 'save';
    case 'o':
      return 'open';
    default:
      return null;
  }
}
