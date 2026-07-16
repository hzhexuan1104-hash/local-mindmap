import { describe, expect, it } from 'vitest';
import { resolveCommittedNodeText, resolveEditingNodeId } from '../nodeEditing';

describe('node editing commit rules', () => {
  it('keeps the existing empty-text fallback when an edit is committed', () => {
    expect(resolveCommittedNodeText('   ')).toBe('未命名节点');
  });

  it('does not require a tree update when the normalized value is unchanged', () => {
    const original = '节点';
    expect(resolveCommittedNodeText(original) === original).toBe(true);
  });

  it('normalizes text once before a history entry is recorded', () => {
    expect(resolveCommittedNodeText('  已修改  ')).toBe('已修改');
  });

  it('keeps a shortcut-created node editable when its blur session has not started', () => {
    expect(resolveEditingNodeId(null, 'shortcut-child')).toBe('shortcut-child');
    expect(resolveEditingNodeId('double-clicked-node', 'shortcut-child')).toBe(
      'double-clicked-node',
    );
  });
});
