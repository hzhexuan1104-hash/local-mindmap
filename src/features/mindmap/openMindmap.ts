import type { LmindDocument, MindmapNode } from './types';

const OPEN_FILE_ACCEPT = '.lmind,application/json';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isRawMindmapNode(value: unknown): value is {
  id: string;
  text: string;
  remark?: unknown;
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
    value.children.every(isRawMindmapNode)
  );
}

function normalizeMindmapNode(node: {
  id: string;
  text: string;
  remark?: unknown;
  children: unknown[];
}): MindmapNode {
  return {
    id: node.id,
    text: node.text,
    remark: typeof node.remark === 'string' ? node.remark : '',
    children: node.children.map((child) =>
      normalizeMindmapNode(
        child as {
          id: string;
          text: string;
          remark?: unknown;
          children: unknown[];
        },
      ),
    ),
  };
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

export function parseLmindDocument(fileContent: string): MindmapNode {
  let parsedContent: unknown;

  try {
    parsedContent = JSON.parse(fileContent);
  } catch {
    throw new Error('Invalid JSON');
  }

  if (!isLmindDocument(parsedContent)) {
    throw new Error('Invalid lmind document');
  }

  return normalizeMindmapNode(parsedContent.rootNode);
}

function selectLocalLmindFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const fileInput = document.createElement('input');

    fileInput.type = 'file';
    fileInput.accept = OPEN_FILE_ACCEPT;
    fileInput.style.display = 'none';

    fileInput.addEventListener(
      'change',
      () => {
        resolve(fileInput.files?.[0] ?? null);
        fileInput.remove();
      },
      { once: true },
    );

    document.body.appendChild(fileInput);
    fileInput.click();
  });
}

export async function openMindmapFromLocalFile(): Promise<MindmapNode | null> {
  const selectedFile = await selectLocalLmindFile();

  if (!selectedFile) {
    return null;
  }

  const fileContent = await selectedFile.text();

  return parseLmindDocument(fileContent);
}
