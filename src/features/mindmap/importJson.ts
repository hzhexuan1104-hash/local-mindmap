import { parseLmindProject } from './openMindmap';
import { selectLocalFile } from './fileUtils';
import type { MindmapProject } from './types';

export async function importMindmapJson(): Promise<MindmapProject | null> {
  const selectedFile = await selectLocalFile('.json,application/json');

  if (!selectedFile) {
    return null;
  }

  return parseLmindProject(await selectedFile.text());
}
