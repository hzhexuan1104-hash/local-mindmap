import type {
  LmindDocument,
  MindmapNode,
  MindmapNodeStyle,
  MindmapNodeType,
  MindmapProject,
} from './types';
import { selectLocalFile } from './fileUtils';

const OPEN_FILE_ACCEPT = '.lmind,application/json';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isRawNodePosition(value: unknown): value is { x: number; y: number } {
  return (
    isRecord(value) &&
    typeof value.x === 'number' &&
    Number.isFinite(value.x) &&
    typeof value.y === 'number' &&
    Number.isFinite(value.y)
  );
}

function normalizeNodeStyle(value: unknown): MindmapNodeStyle | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const shape =
    value.shape === 'rectangle' ||
    value.shape === 'pill' ||
    value.shape === 'diamond' ||
    value.shape === 'rounded'
      ? value.shape
      : undefined;
  const style: MindmapNodeStyle = {
    ...(shape ? { shape } : {}),
    ...(typeof value.backgroundColor === 'string'
      ? { backgroundColor: value.backgroundColor }
      : {}),
    ...(typeof value.borderColor === 'string'
      ? { borderColor: value.borderColor }
      : {}),
    ...(typeof value.textColor === 'string'
      ? { textColor: value.textColor }
      : {}),
    ...(typeof value.fontSize === 'number' && Number.isFinite(value.fontSize)
      ? { fontSize: value.fontSize }
      : {}),
    ...(typeof value.bold === 'boolean' ? { bold: value.bold } : {}),
  };

  return Object.keys(style).length > 0 ? style : undefined;
}

function isRawMindmapNode(value: unknown): value is {
  id: string;
  text: string;
  remark?: unknown;
  nodeTypeId?: unknown;
  style?: unknown;
  collapsed?: unknown;
  position?: unknown;
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
    (value.style === undefined || isRecord(value.style)) &&
    (value.collapsed === undefined || typeof value.collapsed === 'boolean') &&
    (value.position === undefined || isRawNodePosition(value.position)) &&
    value.children.every(isRawMindmapNode)
  );
}

function normalizeMindmapNode(node: {
  id: string;
  text: string;
  remark?: unknown;
  nodeTypeId?: unknown;
  style?: unknown;
  collapsed?: unknown;
  position?: unknown;
  children: unknown[];
}): MindmapNode {
  const style = normalizeNodeStyle(node.style);

  return {
    id: node.id,
    text: node.text,
    remark: typeof node.remark === 'string' ? node.remark : '',
    ...(typeof node.nodeTypeId === 'string' && node.nodeTypeId
      ? { nodeTypeId: node.nodeTypeId }
      : {}),
    ...(style ? { style } : {}),
    ...(typeof node.collapsed === 'boolean' ? { collapsed: node.collapsed } : {}),
    ...(isRawNodePosition(node.position)
      ? { position: { x: node.position.x, y: node.position.y } }
      : {}),
    children: node.children.map((child) =>
      normalizeMindmapNode(
        child as {
          id: string;
          text: string;
          remark?: unknown;
          nodeTypeId?: unknown;
          style?: unknown;
          collapsed?: unknown;
          position?: unknown;
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
    .map((item) => {
      const shape: MindmapNodeType['shape'] =
        item.shape === 'rectangle' ||
        item.shape === 'pill' ||
        item.shape === 'diamond'
          ? item.shape
          : 'rounded';

      return {
      id: typeof item.id === 'string' ? item.id : '',
      name: typeof item.name === 'string' ? item.name : '',
      icon: typeof item.icon === 'string' ? item.icon : '✅',
      shape,
      backgroundColor:
        typeof item.backgroundColor === 'string'
          ? item.backgroundColor
          : '#eef5ff',
      borderColor:
        typeof item.borderColor === 'string' ? item.borderColor : '#1f6feb',
      textColor: typeof item.textColor === 'string' ? item.textColor : '#14315f',
      fontSize:
        typeof item.fontSize === 'number' && Number.isFinite(item.fontSize)
          ? item.fontSize
          : 18,
      bold: typeof item.bold === 'boolean' ? item.bold : true,
      defaultText:
        typeof item.defaultText === 'string' ? item.defaultText : '新节点',
      defaultRemark:
        typeof item.defaultRemark === 'string' ? item.defaultRemark : '',
      };
    })
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
    themeId: parsedContent.meta.theme || 'default-blue',
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
