import { describe, expect, it } from 'vitest';
import {
  createNodeTypePack,
  exportNodeTypesToPack,
  importNodeTypesFromPack,
  NODE_TYPE_PACK_KIND,
  parseNodeTypePack,
} from '../nodeTypePacks';
import type { MindmapNodeType } from '../types';

const createNodeType = (
  overrides: Partial<MindmapNodeType> = {},
): MindmapNodeType => ({
  id: 'task',
  name: 'Task',
  icon: 'T',
  shape: 'rounded',
  backgroundColor: '#fff7e8',
  borderColor: '#f59f00',
  textColor: '#14315f',
  fontSize: 18,
  bold: true,
  defaultText: 'New task',
  defaultRemark: '### Notes',
  ...overrides,
});

describe('node type packs', () => {
  it('creates a valid node type pack', () => {
    const pack = createNodeTypePack([createNodeType()], {
      name: 'Shared types',
      createdAt: '2026-06-25T00:00:00.000Z',
    });

    expect(pack.version).toBe('1.0');
    expect(pack.kind).toBe(NODE_TYPE_PACK_KIND);
    expect(pack.meta.name).toBe('Shared types');
    expect(pack.nodeTypes).toHaveLength(1);
  });

  it('exports multiple node types', () => {
    const exported = exportNodeTypesToPack([
      createNodeType({ id: 'task' }),
      createNodeType({ id: 'risk', name: 'Risk' }),
    ]);
    const parsed = JSON.parse(exported);

    expect(parsed.kind).toBe(NODE_TYPE_PACK_KIND);
    expect(parsed.nodeTypes).toHaveLength(2);
  });

  it('parses a legal node type pack', () => {
    const pack = parseNodeTypePack(
      JSON.stringify(createNodeTypePack([createNodeType()])),
    );

    expect(pack.kind).toBe(NODE_TYPE_PACK_KIND);
    expect(pack.nodeTypes[0].id).toBe('task');
  });

  it('rejects an illegal kind', () => {
    expect(() =>
      parseNodeTypePack(
        JSON.stringify({
          version: '1.0',
          kind: 'local-mindmap',
          meta: {},
          nodeTypes: [],
        }),
      ),
    ).toThrow('这不是有效的节点类型包');
  });

  it('rejects invalid JSON with a clear message', () => {
    expect(() => parseNodeTypePack('{bad json')).toThrow('文件不是有效 JSON');
  });

  it('rejects nodeTypes when it is not an array', () => {
    expect(() =>
      parseNodeTypePack(
        JSON.stringify({
          version: '1.0',
          kind: NODE_TYPE_PACK_KIND,
          meta: {},
          nodeTypes: {},
        }),
      ),
    ).toThrow('这不是有效的节点类型包');
  });

  it('handles an empty node type pack safely', () => {
    const result = importNodeTypesFromPack([], createNodeTypePack([]));

    expect(result.nodeTypes).toHaveLength(0);
    expect(result.importedCount).toBe(0);
    expect(result.skippedDuplicateCount).toBe(0);
    expect(result.renamedConflictCount).toBe(0);
    expect(result.invalidCount).toBe(0);
  });

  it('skips same-id node types with identical content', () => {
    const existing = [createNodeType()];
    const pack = createNodeTypePack([createNodeType()]);
    const result = importNodeTypesFromPack(existing, pack);

    expect(result.nodeTypes).toHaveLength(1);
    expect(result.importedCount).toBe(0);
    expect(result.skippedDuplicateCount).toBe(1);
  });

  it('generates a new id for same-id node types with different content', () => {
    const existing = [createNodeType()];
    const pack = createNodeTypePack([
      createNodeType({ name: 'Different task', backgroundColor: '#ff0000' }),
    ]);
    const result = importNodeTypesFromPack(existing, pack);

    expect(result.nodeTypes).toHaveLength(2);
    expect(result.nodeTypes[1].id).toBe('task-imported-1');
    expect(result.renamedConflictCount).toBe(1);
  });

  it('skips node types missing required fields', () => {
    const pack = createNodeTypePack([]) as ReturnType<typeof createNodeTypePack>;
    pack.nodeTypes = [
      { name: 'Missing id' } as MindmapNodeType,
      { id: 'missing-name' } as MindmapNodeType,
    ];
    const result = importNodeTypesFromPack([], pack);

    expect(result.nodeTypes).toHaveLength(0);
    expect(result.invalidCount).toBe(2);
  });

  it('does not produce duplicate ids after import', () => {
    const pack = createNodeTypePack([
      createNodeType({ id: 'task', name: 'Task A' }),
      createNodeType({ id: 'task', name: 'Task B', textColor: '#000000' }),
    ]);
    const result = importNodeTypesFromPack([], pack);
    const ids = result.nodeTypes.map((nodeType) => nodeType.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('does not produce duplicate ids when the same pack is imported twice', () => {
    const pack = createNodeTypePack([createNodeType()]);
    const firstResult = importNodeTypesFromPack([], pack);
    const secondResult = importNodeTypesFromPack(firstResult.nodeTypes, pack);
    const ids = secondResult.nodeTypes.map((nodeType) => nodeType.id);

    expect(secondResult.importedCount).toBe(0);
    expect(secondResult.skippedDuplicateCount).toBe(1);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('preserves visual and content fields after import', () => {
    const importedNodeType = createNodeType({
      id: 'decision',
      name: 'Decision',
      icon: 'D',
      shape: 'diamond',
      backgroundColor: '#f0fff4',
      borderColor: '#2f9e44',
      textColor: '#1b4332',
      fontSize: 22,
      bold: false,
      defaultText: 'Choose',
      defaultRemark: '- option A\n- option B',
    });
    const result = importNodeTypesFromPack(
      [],
      createNodeTypePack([importedNodeType]),
    );

    expect(result.nodeTypes[0]).toEqual(importedNodeType);
  });

  it('allows same-name node types with different ids and reports the conflict', () => {
    const result = importNodeTypesFromPack(
      [createNodeType({ id: 'task', name: 'Task' })],
      createNodeTypePack([createNodeType({ id: 'task-v2', name: 'Task' })]),
    );

    expect(result.importedCount).toBe(1);
    expect(result.nameConflictCount).toBe(1);
  });
});
