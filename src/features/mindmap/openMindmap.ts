import type {
  LmindDocument,
  MindmapNode,
  MindmapNodeType,
  MindmapProject,
} from './types';
import { selectLocalFile } from './fileUtils';

const OPEN_FILE_ACCEPT = '.lmind,application/json';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isRawMindmapNode(value: unknown): value is {
  id: string;
  text: string;
  remark?: unknown;
  nodeTypeId?: unknown;
  children: unknown[];
} {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    typeof value.text === 'string' &&
    Array.isArray(value.children) &&
    (value.remark === undefined || typeof value.remark === 'string') &&
    (value.nodeTypeId === undefined || typeof value.nodeTypeId === 'string') &&
    value.children.every(isRawMindmapNode)
  );
}

function normalizeMindmapNode(node: {
  id: string;
  text: string;
  remark?: unknown;
  nodeTypeId?: unknown;
  children: unknown[];
}): MindmapNode {
  return {
    id: node.id,
    text: node.text,
    remark: typeof node.remark === 'string' ? node.remark : '',
    ...(typeof node.nodeTypeId === 'string' && node.nodeTypeId
      ? { nodeTypeId: node.nodeTypeId }
      : {}),
    children: node.children.map((child) =>
      normalizeMindmapNode(
        child as {
          id: string;
          text: string;
          remark?: unknown;
          nodeTypeId?: unknown;
          children: unknown[];
        },
      ),
    ),
  };
}

function normalizeNodeTypes(value: unknown): MindmapNodeType[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isRecord)
    .map((item) => ({
      id: typeof item.id === 'string' ? item.id : '',
      name: typeof item.name === 'string' ? item.name : '',
      backgroundColor:
        typeof item.backgroundColor === 'string'
          ? item.backgroundColor
          : '#eef5ff',
      borderColor:
        typeof item.borderColor === 'string' ? item.borderColor : '#1f6feb',
      defaultText:
        typeof item.defaultText === 'string' ? item.defaultText : '新节点',
      defaultRemark:
        typeof item.defaultRemark === 'string' ? item.defaultRemark : '',
    }))
    .filter((item) => item.id && item.name);
}

function isLmindDocument(value: unknown): value is LmindDocument {
  if (!isRecord(value) || !isRecord(value.meta)) {
    return false;
  }

  return (
    typeof value.version === 'string' &&
    typeof value.meta.createTime === 'string' &&
    typeof value.meta.updateTime === 'string' &&
    typeof value.meta.theme === 'string' &&
    isRawMindmapNode(value.rootNode)
  );
}

export function parseLmindProject(fileContent: string): MindmapProject {
  let parsedContent: unknown;

  try {
    parsedContent = JSON.parse(fileContent);
  } catch {
    throw new Error('Invalid JSON');
  }

  if (!isLmindDocument(parsedContent)) {
    throw new Error('Invalid lmind document');
  }

  return {
    rootNode: normalizeMindmapNode(parsedContent.rootNode),
    nodeTypes: normalizeNodeTypes(parsedContent.nodeTypes),
  };
}

export function parseLmindDocument(fileContent: string): MindmapNode {
  return parseLmindProject(fileContent).rootNode;
}

export async function openMindmapFromLocalFile(): Promise<MindmapProject | null> {
  const selectedFile = await selectLocalFile(OPEN_FILE_ACCEPT);

  if (!selectedFile) {
    return null;
  }

  const fileContent = await selectedFile.text();

  return parseLmindProject(fileContent);
}
