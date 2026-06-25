import { normalizeImportedNodeType } from './nodeTypePacks';
import {
  createTemplateThumbnail,
  type MindmapTemplate,
} from './templates';
import type { MindmapNode, MindmapNodeType } from './types';

export const TEMPLATE_PACK_KIND = 'local-mindmap-template-pack';
export const TEMPLATE_PACK_VERSION = '1.0';

export type TemplatePack = {
  version: string;
  kind: typeof TEMPLATE_PACK_KIND;
  meta: {
    name: string;
    description: string;
    createdAt: string;
    source: string;
  };
  templates: MindmapTemplate[];
};

export type TemplatePackImportResult = {
  templates: MindmapTemplate[];
  importedCount: number;
  skippedDuplicateCount: number;
  renamedConflictCount: number;
  invalidCount: number;
  nameConflictCount: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asString = (value: unknown, fallback = '') =>
  typeof value === 'string' ? value : fallback;

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeNodePosition(
  value: unknown,
): MindmapNode['position'] | undefined {
  if (
    isRecord(value) &&
    typeof value.x === 'number' &&
    Number.isFinite(value.x) &&
    typeof value.y === 'number' &&
    Number.isFinite(value.y)
  ) {
    return { x: value.x, y: value.y };
  }

  return undefined;
}

function normalizeMindmapNode(value: unknown): MindmapNode | null {
  if (!isRecord(value) || !Array.isArray(value.children)) {
    return null;
  }

  const id = asString(value.id).trim();
  const text = asString(value.text);

  if (!id) {
    return null;
  }

  const children: MindmapNode[] = [];

  for (const child of value.children) {
    const normalizedChild = normalizeMindmapNode(child);

    if (!normalizedChild) {
      return null;
    }

    children.push(normalizedChild);
  }

  const position = normalizeNodePosition(value.position);

  return {
    id,
    text,
    remark: asString(value.remark),
    ...(typeof value.nodeTypeId === 'string' && value.nodeTypeId
      ? { nodeTypeId: value.nodeTypeId }
      : {}),
    ...(typeof value.collapsed === 'boolean' ? { collapsed: value.collapsed } : {}),
    ...(position ? { position } : {}),
    children,
  };
}

function normalizeTemplateNodeTypes(value: unknown): MindmapNodeType[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(normalizeImportedNodeType)
    .filter((nodeType): nodeType is MindmapNodeType => Boolean(nodeType));
}

export function normalizeImportedTemplate(value: unknown): MindmapTemplate | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = asString(value.id).trim();
  const name = asString(value.name).trim();
  const rootNode = normalizeMindmapNode(value.rootNode);

  if (!id || !name || !rootNode) {
    return null;
  }

  return {
    id,
    templateId: asString(value.templateId).trim() || undefined,
    name,
    category: asString(value.category, '未分类').trim() || '未分类',
    description: asString(value.description),
    createTime: asString(value.createTime).trim() || new Date().toISOString(),
    presetOrder:
      typeof value.presetOrder === 'number' && Number.isFinite(value.presetOrder)
        ? value.presetOrder
        : undefined,
    isOfficial: Boolean(value.isOfficial),
    rootNode,
    nodeTypes: normalizeTemplateNodeTypes(value.nodeTypes),
    themeId: asString(value.themeId, 'default-blue').trim() || 'default-blue',
    thumbnail: asString(value.thumbnail).trim() || createTemplateThumbnail(rootNode),
  };
}

export function isSameTemplate(
  firstTemplate: MindmapTemplate,
  secondTemplate: MindmapTemplate,
) {
  const normalizedFirstTemplate = normalizeImportedTemplate(firstTemplate);
  const normalizedSecondTemplate = normalizeImportedTemplate(secondTemplate);

  return (
    Boolean(normalizedFirstTemplate && normalizedSecondTemplate) &&
    JSON.stringify(normalizedFirstTemplate) ===
      JSON.stringify(normalizedSecondTemplate)
  );
}

export function resolveTemplateIdConflict(
  templateId: string,
  existingTemplates: MindmapTemplate[],
) {
  const usedIds = new Set(existingTemplates.map((template) => template.id));
  let nextIndex = 1;
  let nextId = `${templateId}-imported-${nextIndex}`;

  while (usedIds.has(nextId)) {
    nextIndex += 1;
    nextId = `${templateId}-imported-${nextIndex}`;
  }

  return nextId;
}

export function createTemplatePack(
  templates: MindmapTemplate[],
  meta?: Partial<TemplatePack['meta']>,
): TemplatePack {
  return {
    version: TEMPLATE_PACK_VERSION,
    kind: TEMPLATE_PACK_KIND,
    meta: {
      name: meta?.name ?? '模板包',
      description: meta?.description ?? 'Local Mindmap 自定义模板包',
      createdAt: meta?.createdAt ?? new Date().toISOString(),
      source: meta?.source ?? 'local-mindmap',
    },
    templates: templates.map((template) => cloneValue(template)),
  };
}

export function validateTemplatePack(value: unknown): value is TemplatePack {
  return (
    isRecord(value) &&
    value.kind === TEMPLATE_PACK_KIND &&
    typeof value.version === 'string' &&
    isRecord(value.meta) &&
    Array.isArray(value.templates)
  );
}

export function parseTemplatePack(fileContent: string): TemplatePack {
  let parsedContent: unknown;

  try {
    parsedContent = JSON.parse(fileContent);
  } catch {
    throw new Error('Invalid JSON');
  }

  if (!validateTemplatePack(parsedContent)) {
    throw new Error('Invalid template pack');
  }

  return {
    version: parsedContent.version,
    kind: TEMPLATE_PACK_KIND,
    meta: {
      name: asString(parsedContent.meta.name, '模板包'),
      description: asString(parsedContent.meta.description),
      createdAt: asString(parsedContent.meta.createdAt, new Date().toISOString()),
      source: asString(parsedContent.meta.source, 'local-mindmap'),
    },
    templates: parsedContent.templates as MindmapTemplate[],
  };
}

export function exportTemplatesToPack(
  templates: MindmapTemplate[],
  meta?: Partial<TemplatePack['meta']>,
) {
  return JSON.stringify(createTemplatePack(templates, meta), null, 2);
}

export function importTemplatesFromPack(
  existingTemplates: MindmapTemplate[],
  pack: TemplatePack,
): TemplatePackImportResult {
  const nextTemplates = existingTemplates.map((template) => cloneValue(template));
  let importedCount = 0;
  let skippedDuplicateCount = 0;
  let renamedConflictCount = 0;
  let invalidCount = 0;
  let nameConflictCount = 0;

  if (!validateTemplatePack(pack)) {
    throw new Error('Invalid template pack');
  }

  for (const rawTemplate of pack.templates) {
    const normalizedTemplate = normalizeImportedTemplate(rawTemplate);

    if (!normalizedTemplate) {
      invalidCount += 1;
      continue;
    }

    const matchedById = nextTemplates.find(
      (template) => template.id === normalizedTemplate.id,
    );

    if (matchedById) {
      if (isSameTemplate(matchedById, normalizedTemplate)) {
        skippedDuplicateCount += 1;
        continue;
      }

      nextTemplates.push({
        ...normalizedTemplate,
        id: resolveTemplateIdConflict(normalizedTemplate.id, nextTemplates),
        isOfficial: false,
        presetOrder: undefined,
      });
      renamedConflictCount += 1;
      importedCount += 1;
      continue;
    }

    if (
      nextTemplates.some(
        (template) =>
          template.name === normalizedTemplate.name &&
          template.id !== normalizedTemplate.id,
      )
    ) {
      nameConflictCount += 1;
    }

    nextTemplates.push({
      ...normalizedTemplate,
      isOfficial: false,
      presetOrder: undefined,
    });
    importedCount += 1;
  }

  return {
    templates: nextTemplates,
    importedCount,
    skippedDuplicateCount,
    renamedConflictCount,
    invalidCount,
    nameConflictCount,
  };
}
