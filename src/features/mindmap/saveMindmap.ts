import type { LmindDocument, MindmapNode, MindmapNodeType } from './types';
import { downloadTextFile } from './fileUtils';

const DEFAULT_FILE_NAME = 'mindmap.lmind';

export function createLmindDocument(
  rootNode: MindmapNode,
  nodeTypes: MindmapNodeType[] = [],
): LmindDocument {
  const currentTime = new Date().toISOString();

  return {
    version: '1.0',
    meta: {
      createTime: currentTime,
      updateTime: currentTime,
      theme: 'default',
    },
    nodeTypes,
    rootNode,
  };
}

export function serializeLmindDocument(
  rootNode: MindmapNode,
  nodeTypes: MindmapNodeType[] = [],
): string {
  return JSON.stringify(createLmindDocument(rootNode, nodeTypes), null, 2);
}

export function saveMindmapAsLmind(
  rootNode: MindmapNode,
  fileName = DEFAULT_FILE_NAME,
  nodeTypes: MindmapNodeType[] = [],
) {
  downloadTextFile(
    serializeLmindDocument(rootNode, nodeTypes),
    fileName,
    'application/json;charset=utf-8',
  );
}
