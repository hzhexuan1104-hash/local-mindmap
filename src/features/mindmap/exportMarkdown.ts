import type { MindmapNode } from './types';
import { downloadTextFile } from './fileUtils';

function normalizeHeadingText(text: string) {
  return text.replace(/\r?\n/g, ' ').trim() || '未命名节点';
}

function renderNodeToMarkdown(node: MindmapNode, depth: number): string {
  const headingDepth = Math.min(depth, 6);
  const marker = `<!-- LMIND_NODE level=${depth} -->`;
  const heading = `${'#'.repeat(headingDepth)} ${normalizeHeadingText(node.text)}`;
  const remark = node.remark.trimEnd();
  const children = node.children.map((child) =>
    renderNodeToMarkdown(child, depth + 1),
  );

  return [marker, heading, remark, ...children].filter(Boolean).join('\n\n');
}

export function serializeMindmapMarkdown(rootNode: MindmapNode) {
  return `${renderNodeToMarkdown(rootNode, 1)}\n`;
}

export function exportMindmapMarkdown(rootNode: MindmapNode) {
  downloadTextFile(
    serializeMindmapMarkdown(rootNode),
    'mindmap.md',
    'text/markdown;charset=utf-8',
  );
}
