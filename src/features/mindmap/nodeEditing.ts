/** Normalizes an edited title using the existing product fallback. */
export function resolveCommittedNodeText(draft: string) {
  return draft.trim() || '未命名节点';
}

/**
 * A shortcut-created node can enter edit mode before a textarea blur event
 * exists. Keep the React edit state as a safe fallback for that lifecycle.
 */
export function resolveEditingNodeId(
  sessionNodeId: string | null,
  editingNodeId: string | null,
) {
  return sessionNodeId ?? editingNodeId;
}
