import { downloadTextFile } from './fileUtils';
import type { MindmapNode } from './types';

const indent = (level: number) => '  '.repeat(level);

function nodeToTxtLines(node: MindmapNode, level = 0): string[] {
  const lines = [`${indent(level)}${node.text}`];
  const remark = node.remark.trim();

  if (remark) {
    const remarkLines = remark.split(/\r?\n/);
    lines.push(`${indent(level + 1)}备注：${remarkLines[0] ?? ''}`);

    for (const remarkLine of remarkLines.slice(1)) {
      lines.push(`${indent(level + 2)}${remarkLine}`);
    }
  }

  for (const child of node.children) {
    lines.push(...nodeToTxtLines(child, level + 1));
  }

  return lines;
}

export function serializeMindmapTxt(rootNode: MindmapNode) {
  return `${nodeToTxtLines(rootNode).join('\n')}\n`;
}

export function exportMindmapTxt(rootNode: MindmapNode) {
  downloadTextFile(
    serializeMindmapTxt(rootNode),
    'mindmap.txt',
    'text/plain;charset=utf-8',
  );
}
