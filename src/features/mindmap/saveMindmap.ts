import type { LmindDocument, MindmapNode } from './types';

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
  const fileContent = serializeLmindDocument(rootNode);
  const blob = new Blob([fileContent], {
    type: 'application/json;charset=utf-8',
  });
  const objectUrl = URL.createObjectURL(blob);
  const downloadLink = document.createElement('a');

  downloadLink.href = objectUrl;
  downloadLink.download = fileName;
  downloadLink.style.display = 'none';
  document.body.appendChild(downloadLink);
  downloadLink.click();
  downloadLink.remove();
  URL.revokeObjectURL(objectUrl);
}
