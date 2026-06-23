import type { MindmapNode } from './types';

export type SearchScope = 'all' | 'text' | 'remark';

export type SearchMatch = {
  nodeId: string;
  field: 'text' | 'remark';
  index: number;
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

      matches.push({ nodeId: node.id, field, index });
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

    if (source.slice(match.index, match.index + query.length) !== query) {
      return rootNode;
    }

    return {
      ...rootNode,
      [match.field]:
        source.slice(0, match.index) +
        replacement +
        source.slice(match.index + query.length),
    };
  }

  return {
    ...rootNode,
    children: rootNode.children.map((child) =>
      replaceMatchInMindmap(child, match, query, replacement),
    ),
  };
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
