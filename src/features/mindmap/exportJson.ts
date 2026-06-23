import { serializeLmindDocument } from './saveMindmap';
import type { MindmapNode } from './types';
import { downloadTextFile } from './fileUtils';

export function exportMindmapJson(rootNode: MindmapNode) {
  downloadTextFile(
    serializeLmindDocument(rootNode),
    'mindmap.json',
    'application/json;charset=utf-8',
  );
}
