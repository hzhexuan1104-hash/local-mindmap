import { serializeLmindDocument } from './saveMindmap';
import type { MindmapNode, MindmapNodeType } from './types';
import { downloadTextFile } from './fileUtils';

export function exportMindmapJson(
  rootNode: MindmapNode,
  nodeTypes: MindmapNodeType[] = [],
  themeId = 'default-blue',
) {
  downloadTextFile(
    serializeLmindDocument(rootNode, nodeTypes, themeId),
    'mindmap.json',
    'application/json;charset=utf-8',
  );
}
