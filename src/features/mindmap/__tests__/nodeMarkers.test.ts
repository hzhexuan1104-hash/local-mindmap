import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  deriveAvailableNodeTags,
  deriveSelectedNodeTags,
  getNodeTagApplicationState,
  isNodePriority,
  isNodeProgress,
  mutateNodeTags,
  normalizeNodeTag,
  normalizeNodeTags,
} from '../nodeMarkers';
import { createHistoryState, pushHistory, redoHistory, undoHistory } from '../history';
import { updateSelectedNodes } from '../selection';
import type { MindmapNode, MindmapProject } from '../types';

describe('node markers', () => {
  it('accepts only the supported priority and completion values', () => {
    expect(isNodePriority(1)).toBe(true);
    expect(isNodePriority(9)).toBe(true);
    expect(isNodePriority(0)).toBe(false);
    expect(isNodePriority(1.5)).toBe(false);
    expect(isNodeProgress(0)).toBe(true);
    expect(isNodeProgress(75)).toBe(true);
    expect(isNodeProgress(60)).toBe(false);
  });

  it('trims, bounds, rejects empty values, and deduplicates tags', () => {
    expect(normalizeNodeTag('  里程碑  ')).toBe('里程碑');
    expect(normalizeNodeTag('   ')).toBeNull();
    expect(normalizeNodeTag('a'.repeat(31))).toBe('a'.repeat(30));
    expect(normalizeNodeTags(['  设计 ', '设计', '', 12, '测试'])).toEqual([
      '设计',
      '测试',
    ]);
  });

  it('uses a shared fixed badge footprint without a progress inset ring', () => {
    const css = readFileSync(resolve('src/styles/global.css'), 'utf8');

    expect(css).toMatch(/\.node-priority-badge,[\s\S]*?\.node-progress-badge,[\s\S]*?width: 16px;[\s\S]*?height: 16px;/);
    expect(css).toMatch(/\.node-progress-badge\s*\{[\s\S]*?background: conic-gradient[\s\S]*?box-shadow: none;/);
    expect(css).toContain('color: var(--node-tag-amber-text, #a16207);');
    expect(css).toContain('background: var(--node-tag-amber-bg, #fff7d6);');
  });

  it('derives reusable candidates from live nodes only', () => {
    const nodes = [{ tags: ['需求'] }, { tags: ['测试', '需求'] }];

    expect(deriveAvailableNodeTags(nodes)).toEqual(['测试', '需求']);
    expect(deriveAvailableNodeTags([{ tags: ['测试'] }])).toEqual(['测试']);
  });

  it('reports all and partial application states for a multi-node selection', () => {
    const nodes = [{ tags: ['需求', '测试'] }, { tags: ['需求'] }];

    expect(deriveSelectedNodeTags(nodes)).toEqual(['测试', '需求']);
    expect(getNodeTagApplicationState(nodes, '需求')).toBe('all');
    expect(getNodeTagApplicationState(nodes, '测试')).toBe('partial');
    expect(getNodeTagApplicationState(nodes, '开发')).toBe('none');
  });

  it('adds, reuses, removes, and prevents duplicates without a separate registry', () => {
    const first = mutateNodeTags(
      { id: 'a', text: 'A', remark: '', tags: [], children: [] },
      '  需求 ',
      'add',
    );
    const duplicate = mutateNodeTags(first, '需求', 'add');
    const reused = mutateNodeTags(
      { id: 'b', text: 'B', remark: '', tags: [], children: [] },
      '需求',
      'add',
    );
    const removedFromFirst = mutateNodeTags(duplicate, '需求', 'remove');

    expect(first.tags).toEqual(['需求']);
    expect(duplicate).toBe(first);
    expect(reused.tags).toEqual(['需求']);
    expect(deriveAvailableNodeTags([removedFromFirst, reused])).toEqual(['需求']);
    expect(deriveAvailableNodeTags([removedFromFirst, mutateNodeTags(reused, '需求', 'remove')])).toEqual([]);
    expect(mutateNodeTags(first, '   ', 'add')).toBe(first);
  });

  it('batch-applies partial tags and records one undoable mutation', () => {
    const root: MindmapNode = {
      id: 'root', text: 'root', remark: '', children: [
        { id: 'a', text: 'A', remark: '', tags: ['需求'], children: [] },
        { id: 'b', text: 'B', remark: '', tags: [], children: [] },
      ],
    };
    const before: MindmapProject = { rootNode: root, nodeTypes: [], themeId: 'default-blue' };
    const after: MindmapProject = {
      ...before,
      rootNode: updateSelectedNodes(root, new Set(['a', 'b']), (node) =>
        mutateNodeTags(node, '需求', 'add'),
      ),
    };
    const history = pushHistory(createHistoryState(), before);
    const undone = undoHistory(history, after)!;
    const redone = redoHistory(undone.history, undone.project)!;

    expect(getNodeTagApplicationState(after.rootNode.children, '需求')).toBe('all');
    expect(undone.project.rootNode.children.map((node) => node.tags ?? [])).toEqual([['需求'], []]);
    expect(redone.project.rootNode.children.map((node) => node.tags ?? [])).toEqual([['需求'], ['需求']]);
  });
});
