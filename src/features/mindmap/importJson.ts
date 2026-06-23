import { parseLmindDocument } from './openMindmap';
import { selectLocalFile } from './fileUtils';
import type { MindmapNode } from './types';

export async function importMindmapJson(): Promise<MindmapNode | null> {
  const selectedFile = await selectLocalFile('.json,application/json');

  if (!selectedFile) {
    return null;
  }

  return parseLmindDocument(await selectedFile.text());
}
