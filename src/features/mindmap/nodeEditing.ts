/** Normalizes an edited title using the existing product fallback. */
export function resolveCommittedNodeText(draft: string) {
  return draft.trim() || '未命名节点';
}
