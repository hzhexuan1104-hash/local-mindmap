import type { MindmapNode } from './types';

export type SearchScope = 'all' | 'text' | 'remark';

export type SearchMatch = {
  nodeId: string;
  field: 'text' | 'remark';
  start: number;
  end: number;
  text: string;
};

export type SearchCursor = Pick<SearchMatch, 'nodeId' | 'field'> & {
  offset: number;
};

const shouldSearchField = (scope: SearchScope, field: SearchMatch['field']) =>
  scope === 'all' || scope === field;

function collectMatches(
  node: MindmapNode,
  query: string,
  scope: SearchScope,
  matches: SearchMatch[],
) {
  if (!query) {
    return;
  }

  (['text', 'remark'] as const).forEach((field) => {
    if (!shouldSearchField(scope, field)) {
      return;
    }

    let searchFrom = 0;

    while (searchFrom <= node[field].length) {
      const index = node[field].indexOf(query, searchFrom);

      if (index === -1) {
        break;
      }

      matches.push({
        nodeId: node.id,
        field,
        start: index,
        end: index + query.length,
        text: node[field].slice(index, index + query.length),
      });
      searchFrom = index + query.length;
    }
  });

  node.children.forEach((child) => collectMatches(child, query, scope, matches));
}

export function findMindmapMatches(
  rootNode: MindmapNode,
  query: string,
  scope: SearchScope,
) {
  const matches: SearchMatch[] = [];
  collectMatches(rootNode, query.trim(), scope, matches);
  return matches;
}

export function replaceMatchInMindmap(
  rootNode: MindmapNode,
  match: SearchMatch,
  query: string,
  replacement: string,
): MindmapNode {
  if (rootNode.id === match.nodeId) {
    const source = rootNode[match.field];

    if (source.slice(match.start, match.end) !== query) {
      return rootNode;
    }

    return {
      ...rootNode,
      [match.field]:
        source.slice(0, match.start) +
        replacement +
        source.slice(match.end),
    };
  }

  return {
    ...rootNode,
    children: rootNode.children.map((child) =>
      replaceMatchInMindmap(child, match, query, replacement),
    ),
  };
}

function collectFieldOrder(
  node: MindmapNode,
  order: Map<string, number>,
  nextOrder: { value: number },
) {
  (['text', 'remark'] as const).forEach((field) => {
    order.set(`${node.id}:${field}`, nextOrder.value);
    nextOrder.value += 1;
  });
  node.children.forEach((child) => collectFieldOrder(child, order, nextOrder));
}

export function findNextMatchIndex(
  rootNode: MindmapNode,
  matches: SearchMatch[],
  cursor: SearchCursor,
) {
  if (matches.length === 0) {
    return -1;
  }

  const fieldOrder = new Map<string, number>();
  collectFieldOrder(rootNode, fieldOrder, { value: 0 });
  const cursorOrder = fieldOrder.get(`${cursor.nodeId}:${cursor.field}`);

  if (cursorOrder === undefined) {
    return 0;
  }

  const nextIndex = matches.findIndex((match) => {
    const matchOrder = fieldOrder.get(`${match.nodeId}:${match.field}`);
    return (
      matchOrder !== undefined &&
      (matchOrder > cursorOrder ||
        (matchOrder === cursorOrder && match.start >= cursor.offset))
    );
  });

  return nextIndex === -1 ? 0 : nextIndex;
}

export function replaceAllInMindmap(
  rootNode: MindmapNode,
  query: string,
  replacement: string,
  scope: SearchScope,
): MindmapNode {
  const replaceValue = (value: string) => value.split(query).join(replacement);

  return {
    ...rootNode,
    text: shouldSearchField(scope, 'text') ? replaceValue(rootNode.text) : rootNode.text,
    remark: shouldSearchField(scope, 'remark')
      ? replaceValue(rootNode.remark)
      : rootNode.remark,
    children: rootNode.children.map((child) =>
      replaceAllInMindmap(child, query, replacement, scope),
    ),
  };
}
