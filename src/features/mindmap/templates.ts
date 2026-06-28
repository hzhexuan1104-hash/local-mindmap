import type { MindmapNode, MindmapNodeType } from './types';
import type { TemplatePack } from './templatePacks';
import {
  isDesktopRuntime,
  isDirectUserJsonFile,
  listUserFiles,
  loadUserTemplates,
  readUserJson,
  saveUserTemplates,
  USER_DATA_PATHS,
  writeUserJson,
} from '../storage/userDataStorage';

export type MindmapTemplate = {
  id: string;
  templateId?: string;
  name: string;
  category: string;
  description: string;
  createTime: string;
  presetOrder?: number;
  isOfficial?: boolean;
  rootNode: MindmapNode;
  nodeTypes: MindmapNodeType[];
  themeId: string;
  thumbnail: string;
};

export type TemplateSortMode =
  | 'preset-asc'
  | 'created-desc'
  | 'created-asc'
  | 'name-asc';

export type TemplateFilterOptions = {
  keyword: string;
  category: string;
  sortMode: TemplateSortMode;
};

function cloneNode<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function countNodes(node: MindmapNode): number {
  return 1 + node.children.reduce((sum, child) => sum + countNodes(child), 0);
}

export function createTemplateThumbnail(rootNode: MindmapNode) {
  return `${rootNode.text || '未命名导图'}\n${countNodes(rootNode)} 个节点`;
}

export function normalizeTemplate(value: unknown): MindmapTemplate | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }

  const item = value as Partial<MindmapTemplate>;

  if (!item.id || !item.rootNode) {
    return null;
  }

  return {
    id: String(item.id),
    templateId: item.templateId ? String(item.templateId) : undefined,
    name: item.name || '未命名模板',
    category: item.category || '未分类',
    description: item.description || '',
    createTime: item.createTime || new Date().toISOString(),
    presetOrder:
      typeof item.presetOrder === 'number' ? item.presetOrder : undefined,
    isOfficial: Boolean(item.isOfficial),
    rootNode: item.rootNode,
    nodeTypes: item.nodeTypes ?? [],
    themeId: item.themeId ?? 'default-blue',
    thumbnail: item.thumbnail || createTemplateThumbnail(item.rootNode),
  };
}

export function normalizeUserTemplates(value: unknown): MindmapTemplate[] {
  return Array.isArray(value)
    ? value
        .map(normalizeTemplate)
        .filter((template): template is MindmapTemplate => Boolean(template))
    : [];
}

export async function loadMindmapTemplates(): Promise<MindmapTemplate[]> {
  const templates = normalizeUserTemplates(await loadUserTemplates());
  console.info('[user-data][templates] custom templates normalized', {
    desktop: isDesktopRuntime(),
    count: templates.length,
    names: templates.map((template) => template.name),
  });
  return templates;
}

export async function saveMindmapTemplates(templates: MindmapTemplate[]) {
  await saveUserTemplates(templates);
}

export function createTemplateFromMindmap(
  name: string,
  category: string,
  description: string,
  rootNode: MindmapNode,
  nodeTypes: MindmapNodeType[],
  themeId = 'default-blue',
): MindmapTemplate {
  return {
    id: crypto.randomUUID(),
    name: name.trim() || '未命名模板',
    category: category.trim() || '未分类',
    description: description.trim(),
    createTime: new Date().toISOString(),
    rootNode: cloneNode(rootNode),
    nodeTypes: cloneNode(nodeTypes),
    themeId,
    thumbnail: createTemplateThumbnail(rootNode),
  };
}

export async function addMindmapTemplate(template: MindmapTemplate) {
  const templates = await loadMindmapTemplates();
  const nextTemplates = [template, ...templates];
  await saveMindmapTemplates(nextTemplates);
  return nextTemplates;
}

export async function deleteMindmapTemplate(templateId: string) {
  const nextTemplates = (await loadMindmapTemplates()).filter(
    (template) => template.id !== templateId,
  );
  await saveMindmapTemplates(nextTemplates);
  return nextTemplates;
}

export async function loadStoredTemplatePacks(): Promise<TemplatePack[]> {
  const { parseTemplatePack } = await import('./templatePacks');
  const files = await listUserFiles(USER_DATA_PATHS.templatePacks);
  const packFiles = files.filter((path) =>
    isDirectUserJsonFile(path, USER_DATA_PATHS.templatePacks),
  );
  const packs: TemplatePack[] = [];

  for (const file of packFiles) {
    const value = await readUserJson<unknown | null>(file, null);
    if (value === null) {
      continue;
    }
    try {
      packs.push(parseTemplatePack(JSON.stringify(value)));
    } catch (error) {
      console.error('[user-data][templates] template pack ignored', {
        file,
        error,
      });
    }
  }

  console.info('[user-data][templates] packs loaded', {
    desktop: isDesktopRuntime(),
    fileCount: packFiles.length,
    packCount: packs.length,
  });
  return packs;
}

export async function saveImportedTemplatePack(pack: TemplatePack) {
  const safeName =
    pack.meta.name
      .trim()
      .replace(/[^A-Za-z0-9\u4e00-\u9fff._-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'templates';
  const suffix = new Date().toISOString().replace(/[:.]/g, '-');
  await writeUserJson(
    `${USER_DATA_PATHS.templatePacks}/${safeName}-${suffix}.json`,
    pack,
  );
}

export async function loadAllUserTemplates() {
  const { importTemplatesFromPack } = await import('./templatePacks');
  let templates = await loadMindmapTemplates();
  const packs = await loadStoredTemplatePacks();
  for (const pack of packs) {
    templates = importTemplatesFromPack(templates, pack).templates;
  }
  console.info('[user-data][templates] final user templates', {
    desktop: isDesktopRuntime(),
    count: templates.length,
    names: templates.map((template) => template.name),
  });
  return templates;
}

export function cloneTemplateProject(template: MindmapTemplate) {
  return {
    rootNode: cloneNode(template.rootNode),
    nodeTypes: cloneNode(template.nodeTypes ?? []),
    themeId: template.themeId ?? 'default-blue',
  };
}

export function getTemplateCategories(templates: MindmapTemplate[]) {
  return Array.from(
    new Set(templates.map((template) => template.category || '未分类')),
  ).sort((left, right) => left.localeCompare(right, 'zh-Hans-CN'));
}

export function filterAndSortTemplates(
  templates: MindmapTemplate[],
  options: TemplateFilterOptions,
) {
  const keyword = options.keyword.trim().toLowerCase();

  return templates
    .filter((template) => {
      const matchesKeyword =
        !keyword ||
        [template.name, template.category, template.description]
          .join(' ')
          .toLowerCase()
          .includes(keyword);
      const matchesCategory =
        !options.category || template.category === options.category;

      return matchesKeyword && matchesCategory;
    })
    .sort((left, right) => {
      if (options.sortMode === 'preset-asc') {
        const leftOrder = left.presetOrder ?? Number.MAX_SAFE_INTEGER;
        const rightOrder = right.presetOrder ?? Number.MAX_SAFE_INTEGER;

        if (leftOrder !== rightOrder) {
          return leftOrder - rightOrder;
        }

        return left.name.localeCompare(right.name, 'zh-Hans-CN');
      }

      if (options.sortMode === 'name-asc') {
        return left.name.localeCompare(right.name, 'zh-Hans-CN');
      }

      const leftTime = new Date(left.createTime).getTime();
      const rightTime = new Date(right.createTime).getTime();

      return options.sortMode === 'created-asc'
        ? leftTime - rightTime
        : rightTime - leftTime;
    });
}
