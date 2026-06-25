import { describe, expect, it } from 'vitest';
import {
  createTemplatePack,
  exportTemplatesToPack,
  importTemplatesFromPack,
  parseTemplatePack,
  TEMPLATE_PACK_KIND,
} from '../templatePacks';
import type { MindmapTemplate } from '../templates';

const createTemplate = (
  overrides: Partial<MindmapTemplate> = {},
): MindmapTemplate => ({
  id: 'project-plan',
  name: 'Project Plan',
  category: 'Planning',
  description: 'Plan a project from kickoff to delivery.',
  createTime: '2026-06-25T00:00:00.000Z',
  rootNode: {
    id: 'root',
    text: 'Project',
    remark: '# Project',
    children: [
      {
        id: 'task-1',
        text: 'Tasks',
        remark: '- task',
        nodeTypeId: 'task',
        children: [],
      },
    ],
  },
  nodeTypes: [
    {
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
    },
  ],
  themeId: 'default-blue',
  thumbnail: 'Project Plan\n2 nodes',
  ...overrides,
});

describe('template packs', () => {
  it('creates a valid template pack', () => {
    const pack = createTemplatePack([createTemplate()], {
      name: 'Shared templates',
      createdAt: '2026-06-25T01:00:00.000Z',
    });

    expect(pack.version).toBe('1.0');
    expect(pack.kind).toBe(TEMPLATE_PACK_KIND);
    expect(pack.meta.name).toBe('Shared templates');
    expect(pack.templates).toHaveLength(1);
  });

  it('exports multiple templates', () => {
    const exported = exportTemplatesToPack([
      createTemplate({ id: 'project-plan' }),
      createTemplate({ id: 'meeting-notes', name: 'Meeting Notes' }),
    ]);
    const parsed = JSON.parse(exported);

    expect(parsed.kind).toBe(TEMPLATE_PACK_KIND);
    expect(parsed.templates).toHaveLength(2);
  });

  it('parses a legal template pack', () => {
    const pack = parseTemplatePack(
      JSON.stringify(createTemplatePack([createTemplate()])),
    );

    expect(pack.kind).toBe(TEMPLATE_PACK_KIND);
    expect(pack.templates[0].id).toBe('project-plan');
  });

  it('rejects an illegal kind', () => {
    expect(() =>
      parseTemplatePack(
        JSON.stringify({
          version: '1.0',
          kind: 'local-mindmap-template',
          meta: {},
          templates: [],
        }),
      ),
    ).toThrow('这不是有效的模板包');
  });

  it('rejects invalid JSON with a clear message', () => {
    expect(() => parseTemplatePack('{bad json')).toThrow('文件不是有效 JSON');
  });

  it('rejects templates when it is not an array', () => {
    expect(() =>
      parseTemplatePack(
        JSON.stringify({
          version: '1.0',
          kind: TEMPLATE_PACK_KIND,
          meta: {},
          templates: {},
        }),
      ),
    ).toThrow('这不是有效的模板包');
  });

  it('handles an empty template pack safely', () => {
    const result = importTemplatesFromPack([], createTemplatePack([]));

    expect(result.templates).toHaveLength(0);
    expect(result.importedCount).toBe(0);
    expect(result.skippedDuplicateCount).toBe(0);
    expect(result.renamedConflictCount).toBe(0);
    expect(result.invalidCount).toBe(0);
  });

  it('skips same-id templates with identical content', () => {
    const existing = [createTemplate()];
    const result = importTemplatesFromPack(
      existing,
      createTemplatePack([createTemplate()]),
    );

    expect(result.templates).toHaveLength(1);
    expect(result.importedCount).toBe(0);
    expect(result.skippedDuplicateCount).toBe(1);
  });

  it('generates a new id for same-id templates with different content', () => {
    const existing = [createTemplate()];
    const result = importTemplatesFromPack(
      existing,
      createTemplatePack([
        createTemplate({
          name: 'Different Project Plan',
          description: 'Different content.',
        }),
      ]),
    );

    expect(result.templates).toHaveLength(2);
    expect(result.templates[1].id).toBe('project-plan-imported-1');
    expect(result.renamedConflictCount).toBe(1);
  });

  it('skips templates missing required fields', () => {
    const pack = createTemplatePack([]);
    pack.templates = [
      { name: 'Missing id', rootNode: createTemplate().rootNode } as MindmapTemplate,
      { id: 'missing-name', rootNode: createTemplate().rootNode } as MindmapTemplate,
      { id: 'missing-root', name: 'Missing root' } as MindmapTemplate,
    ];
    const result = importTemplatesFromPack([], pack);

    expect(result.templates).toHaveLength(0);
    expect(result.invalidCount).toBe(3);
  });

  it('does not produce duplicate ids after import', () => {
    const result = importTemplatesFromPack(
      [],
      createTemplatePack([
        createTemplate({ id: 'project-plan', name: 'Project A' }),
        createTemplate({
          id: 'project-plan',
          name: 'Project B',
          description: 'Different template.',
        }),
      ]),
    );
    const ids = result.templates.map((template) => template.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('does not produce duplicate ids when the same pack is imported twice', () => {
    const pack = createTemplatePack([createTemplate()]);
    const firstResult = importTemplatesFromPack([], pack);
    const secondResult = importTemplatesFromPack(firstResult.templates, pack);
    const ids = secondResult.templates.map((template) => template.id);

    expect(secondResult.importedCount).toBe(0);
    expect(secondResult.skippedDuplicateCount).toBe(1);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('preserves template fields after import', () => {
    const importedTemplate = createTemplate({
      id: 'roadmap',
      name: 'Roadmap',
      category: 'Product',
      description: 'Product roadmap template.',
      themeId: 'fresh-green',
      thumbnail: 'Roadmap\n2 nodes',
      rootNode: {
        id: 'roadmap-root',
        text: 'Roadmap',
        remark: '# Roadmap',
        position: { x: 80, y: 120 },
        children: [
          {
            id: 'milestone',
            text: 'Milestone',
            remark: 'Q1',
            nodeTypeId: 'task',
            collapsed: false,
            children: [],
          },
        ],
      },
    });
    const result = importTemplatesFromPack(
      [],
      createTemplatePack([importedTemplate]),
    );

    expect(result.templates[0]).toMatchObject(importedTemplate);
    expect(result.templates[0].rootNode).toEqual(importedTemplate.rootNode);
    expect(result.templates[0].nodeTypes).toEqual(importedTemplate.nodeTypes);
  });

  it('allows same-name templates with different ids and reports the conflict', () => {
    const result = importTemplatesFromPack(
      [createTemplate({ id: 'project-plan', name: 'Project Plan' })],
      createTemplatePack([
        createTemplate({ id: 'project-plan-v2', name: 'Project Plan' }),
      ]),
    );

    expect(result.importedCount).toBe(1);
    expect(result.nameConflictCount).toBe(1);
  });
});
