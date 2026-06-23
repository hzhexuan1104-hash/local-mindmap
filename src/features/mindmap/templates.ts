import type { MindmapNode, MindmapNodeType } from './types';

const TEMPLATE_STORAGE_KEY = 'local-mindmap.templates.v1';

export type MindmapTemplate = {
  id: string;
  name: string;
  createTime: string;
  rootNode: MindmapNode;
  nodeTypes: MindmapNodeType[];
};

function cloneNode<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function loadMindmapTemplates(): MindmapTemplate[] {
  const rawTemplates = window.localStorage.getItem(TEMPLATE_STORAGE_KEY);

  if (!rawTemplates) {
    return [];
  }

  try {
    const parsedTemplates = JSON.parse(rawTemplates);
    return Array.isArray(parsedTemplates) ? parsedTemplates : [];
  } catch {
    return [];
  }
}

function saveTemplates(templates: MindmapTemplate[]) {
  window.localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(templates));
}

export function createTemplateFromMindmap(
  name: string,
  rootNode: MindmapNode,
  nodeTypes: MindmapNodeType[],
): MindmapTemplate {
  return {
    id: crypto.randomUUID(),
    name: name.trim() || '未命名模板',
    createTime: new Date().toISOString(),
    rootNode: cloneNode(rootNode),
    nodeTypes: cloneNode(nodeTypes),
  };
}

export function addMindmapTemplate(template: MindmapTemplate) {
  const templates = loadMindmapTemplates();
  const nextTemplates = [template, ...templates];
  saveTemplates(nextTemplates);
  return nextTemplates;
}

export function deleteMindmapTemplate(templateId: string) {
  const nextTemplates = loadMindmapTemplates().filter(
    (template) => template.id !== templateId,
  );
  saveTemplates(nextTemplates);
  return nextTemplates;
}

export function cloneTemplateProject(template: MindmapTemplate) {
  return {
    rootNode: cloneNode(template.rootNode),
    nodeTypes: cloneNode(template.nodeTypes ?? []),
  };
}
