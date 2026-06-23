import { serializeLmindDocument } from './saveMindmap';
import type { MindmapNode, MindmapNodeType } from './types';
import { downloadTextFile } from './fileUtils';

export function exportMindmapJson(
  rootNode: MindmapNode,
  nodeTypes: MindmapNodeType[] = [],
) {
  downloadTextFile(
    serializeLmindDocument(rootNode, nodeTypes),
    'mindmap.json',
    'application/json;charset=utf-8',
  );
}
