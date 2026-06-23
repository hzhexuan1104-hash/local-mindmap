import { selectLocalFile } from './fileUtils';
import type { MindmapNode } from './types';

type ImportStackItem = {
  level: number;
  node: MindmapNode;
};

const headingPattern = /^(#{1,6})\s+(.+?)\s*$/;
const lmindMarkerPattern = /^<!--\s*LMIND_NODE\s+level=(\d+)\s*-->\s*$/;

function createImportedNode(text: string, remark = ''): MindmapNode {
  return {
    id: crypto.randomUUID(),
    text: text.trim() || '未命名节点',
    remark,
    children: [],
  };
}

function getFileNameWithoutExtension(fileName: string) {
  return fileName.replace(/\.[^.]+$/, '').trim();
}

function appendNodeByLevel(
  rootNode: MindmapNode | null,
  stack: ImportStackItem[],
  node: MindmapNode,
  level: number,
) {
  if (!rootNode) {
    stack.splice(0, stack.length, { level, node });
    return node;
  }

  while (stack.length > 1 && stack[stack.length - 1].level >= level) {
    stack.pop();
  }

  const parentNode = level <= stack[0].level ? rootNode : stack[stack.length - 1].node;
  parentNode.children.push(node);
  stack.push({ level, node });

  return rootNode;
}

function parseLmindMarkedMarkdown(
  markdown: string,
  fallbackRootText = '导入的 Markdown',
): MindmapNode {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const stack: ImportStackItem[] = [];
  let rootNode: MindmapNode | null = null;
  let currentNode: MindmapNode | null = null;
  let remarkLines: string[] = [];
  let pendingLevel: number | null = null;

  const flushRemark = () => {
    if (currentNode) {
      currentNode.remark = remarkLines.join('\n').trim();
    }

    remarkLines = [];
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const markerMatch = line.match(lmindMarkerPattern);

    if (!markerMatch) {
      if (currentNode) {
        remarkLines.push(line);
      }
      continue;
    }

    flushRemark();
    pendingLevel = Math.max(1, Number(markerMatch[1]));

    let headingText = '未命名节点';

    for (index += 1; index < lines.length; index += 1) {
      const possibleHeading = lines[index];
      const headingMatch = possibleHeading.match(headingPattern);

      if (headingMatch) {
        headingText = headingMatch[2];
        break;
      }
    }

    const newNode = createImportedNode(headingText);
    rootNode = appendNodeByLevel(rootNode, stack, newNode, pendingLevel);
    currentNode = newNode;
    pendingLevel = null;
  }

  flushRemark();

  return rootNode ?? createImportedNode(fallbackRootText || '导入的 Markdown');
}

function parsePlainMarkdownToMindmap(
  markdown: string,
  fallbackRootText = '导入的 Markdown',
): MindmapNode {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const rootNode = createImportedNode(fallbackRootText || '导入的 Markdown');
  const stack: ImportStackItem[] = [{ level: 1, node: rootNode }];
  let hasExplicitRoot = false;
  let currentNode: MindmapNode = rootNode;
  let remarkLines: string[] = [];
  let isInCodeFence = false;

  const flushRemark = () => {
    currentNode.remark = remarkLines.join('\n').trim();
    remarkLines = [];
  };

  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      isInCodeFence = !isInCodeFence;
      remarkLines.push(line);
      continue;
    }

    const headingMatch = isInCodeFence ? null : line.match(headingPattern);

    if (!headingMatch) {
      remarkLines.push(line);
      continue;
    }

    flushRemark();

    const headingLevel = headingMatch[1].length;
    const headingText = headingMatch[2];

    if (headingLevel === 1 && !hasExplicitRoot && rootNode.text === fallbackRootText) {
      rootNode.text = headingText.trim() || fallbackRootText;
      hasExplicitRoot = true;
      currentNode = rootNode;
      stack.splice(0, stack.length, { level: 1, node: rootNode });
      continue;
    }

    const newNode = createImportedNode(headingText);

    while (stack.length > 1 && stack[stack.length - 1].level >= headingLevel) {
      stack.pop();
    }

    const parentNode = stack[stack.length - 1]?.node ?? rootNode;
    parentNode.children.push(newNode);
    stack.push({ level: headingLevel, node: newNode });
    currentNode = newNode;
  }

  flushRemark();

  return rootNode;
}

export function parseMarkdownToMindmap(
  markdown: string,
  fallbackRootText = '导入的 Markdown',
): MindmapNode {
  if (lmindMarkerPattern.test(markdown.split(/\r?\n/, 1)[0] ?? '')) {
    return parseLmindMarkedMarkdown(markdown, fallbackRootText);
  }

  if (markdown.split(/\r?\n/).some((line) => lmindMarkerPattern.test(line))) {
    return parseLmindMarkedMarkdown(markdown, fallbackRootText);
  }

  return parsePlainMarkdownToMindmap(markdown, fallbackRootText);
}

export async function importMindmapMarkdown(): Promise<MindmapNode | null> {
  const selectedFile = await selectLocalFile('.md,.markdown,text/markdown,text/plain');

  if (!selectedFile) {
    return null;
  }

  const fallbackRootText =
    getFileNameWithoutExtension(selectedFile.name) || '导入的 Markdown';

  return parseMarkdownToMindmap(await selectedFile.text(), fallbackRootText);
}
