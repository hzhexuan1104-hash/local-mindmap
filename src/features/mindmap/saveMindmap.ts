import type { LmindDocument, MindmapNode } from './types';
import { downloadTextFile } from './fileUtils';

const DEFAULT_FILE_NAME = 'mindmap.lmind';

export function createLmindDocument(rootNode: MindmapNode): LmindDocument {
  const currentTime = new Date().toISOString();

  return {
    version: '1.0',
    meta: {
      createTime: currentTime,
      updateTime: currentTime,
      theme: 'default',
    },
    rootNode,
  };
}

export function serializeLmindDocument(rootNode: MindmapNode): string {
  return JSON.stringify(createLmindDocument(rootNode), null, 2);
}

export function saveMindmapAsLmind(
  rootNode: MindmapNode,
  fileName = DEFAULT_FILE_NAME,
) {
  downloadTextFile(
    serializeLmindDocument(rootNode),
    fileName,
    'application/json;charset=utf-8',
  );
}
