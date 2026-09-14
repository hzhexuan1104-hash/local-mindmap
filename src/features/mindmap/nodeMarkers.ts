import type { MindmapNode, MindmapNodePriority, MindmapNodeProgress } from './types';

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

export type NodeTagMutation = 'add' | 'remove';

/** Applies one normalized tag mutation to a node without creating a tag registry. */
export function mutateNodeTags(
  node: MindmapNode,
  value: string,
  mutation: NodeTagMutation,
): MindmapNode {
  const tag = normalizeNodeTag(value);
  if (!tag) return node;

  const currentTags = normalizeNodeTags(node.tags);
  const hasTag = currentTags.includes(tag);

  if ((mutation === 'add' && hasTag) || (mutation === 'remove' && !hasTag)) {
    return node;
  }

  return {
    ...node,
    tags: mutation === 'add'
      ? [...currentTags, tag]
      : currentTags.filter((currentTag) => currentTag !== tag),
  };
}

export type NodeTagApplicationState = 'none' | 'partial' | 'all';

/** Returns the selection-aware application state used by the batch tag UI. */
export function getNodeTagApplicationState(
  nodes: readonly Pick<MindmapNode, 'tags'>[],
  value: string,
): NodeTagApplicationState {
  const tag = normalizeNodeTag(value);
  if (!tag || nodes.length === 0) return 'none';

  const appliedCount = nodes.filter((node) =>
    normalizeNodeTags(node.tags).includes(tag),
  ).length;

  if (appliedCount === 0) return 'none';
  return appliedCount === nodes.length ? 'all' : 'partial';
}

/** Tags are derived from live nodes only, so an unused tag automatically vanishes. */
export function deriveAvailableNodeTags(
  nodes: Iterable<Pick<MindmapNode, 'tags'>>,
): string[] {
  const tags = new Set<string>();
  for (const node of nodes) {
    normalizeNodeTags(node.tags).forEach((tag) => tags.add(tag));
  }
  return Array.from(tags).sort((left, right) => left.localeCompare(right, 'zh-CN'));
}

/** The union is the "current tags" set for a multi-node selection. */
export function deriveSelectedNodeTags(
  nodes: readonly Pick<MindmapNode, 'tags'>[],
): string[] {
  return deriveAvailableNodeTags(nodes);
}
