import type { MindmapNodePriority, MindmapNodeProgress } from './types';

export const NODE_PRIORITY_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
export const NODE_PROGRESS_VALUES = [0, 25, 50, 75, 100] as const satisfies readonly MindmapNodeProgress[];
export const MAX_NODE_TAG_LENGTH = 30;

export function isNodePriority(value: unknown): value is MindmapNodePriority {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 9
  );
}

export function isNodeProgress(value: unknown): value is MindmapNodeProgress {
  return NODE_PROGRESS_VALUES.includes(value as MindmapNodeProgress);
}

export function normalizeNodeTag(value: string): string | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  return Array.from(trimmed).slice(0, MAX_NODE_TAG_LENGTH).join('');
}

export function normalizeNodeTags(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const tags: string[] = [];

  value.forEach((item) => {
    if (typeof item !== 'string') {
      return;
    }

    const tag = normalizeNodeTag(item);
    if (!tag || seen.has(tag)) {
      return;
    }

    seen.add(tag);
    tags.push(tag);
  });

  return tags;
}
