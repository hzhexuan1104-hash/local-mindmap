import type { MindmapNode } from './types';

export type SearchScope = 'all' | 'branch' | 'text' | 'remark';

export type SearchOptions = {
  caseSensitive: boolean;
  wholeWord: boolean;
};

/** Preserve the previous exact-match behavior unless the user changes an option. */
export const DEFAULT_SEARCH_OPTIONS: SearchOptions = {
  caseSensitive: true,
  wholeWord: false,
};

export const SEARCH_SCOPE_LABELS: Record<SearchScope, string> = {
  all: '全部节点',
  branch: '当前分支',
  text: '仅节点标题',
  remark: '仅备注',
};

/** Search selection and highlighting are transient and end with the search panel. */
export function shouldResetSearchOnPanelClose(panelId: string | null) {
  return panelId === 'search';
}

export function getSearchPanelStatusText(options: {
  query: string;
  hasRun: boolean;
  matchCount: number;
  activeIndex: number;
}) {
  if (!options.query.trim() || !options.hasRun) {
    return '输入关键词查找节点标题和备注。';
  }

  if (options.matchCount === 0) {
    return '未找到匹配项';
  }

  return `${options.activeIndex + 1} / ${options.matchCount}`;
}

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
  scope === 'all' || scope === 'branch' || scope === field;

const wordCharacterPattern = /[\p{L}\p{N}_]/u;

function isWholeWordMatch(value: string, start: number, end: number) {
  const before = start > 0 ? value[start - 1] : '';
  const after = end < value.length ? value[end] : '';
  return (!before || !wordCharacterPattern.test(before)) &&
    (!after || !wordCharacterPattern.test(after));
}

function collectMatches(
  node: MindmapNode,
  query: string,
  scope: SearchScope,
  matches: SearchMatch[],
  options: SearchOptions,
) {
  if (!query) {
    return;
  }

  (['text', 'remark'] as const).forEach((field) => {
    if (!shouldSearchField(scope, field)) {
      return;
    }

    const searchValue = options.caseSensitive ? node[field] : node[field].toLocaleLowerCase();
    const searchQuery = options.caseSensitive ? query : query.toLocaleLowerCase();
    let searchFrom = 0;

    while (searchFrom <= node[field].length) {
      const index = searchValue.indexOf(searchQuery, searchFrom);

      if (index === -1) {
        break;
      }

      const end = index + query.length;

      if (options.wholeWord && !isWholeWordMatch(node[field], index, end)) {
        searchFrom = index + query.length;
        continue;
      }

      matches.push({
        nodeId: node.id,
        field,
        start: index,
        end,
        text: node[field].slice(index, end),
      });
      searchFrom = index + query.length;
    }
  });

  node.children.forEach((child) => collectMatches(child, query, scope, matches, options));
}

export function findMindmapMatches(
  rootNode: MindmapNode,
  query: string,
  scope: SearchScope,
  options: SearchOptions = DEFAULT_SEARCH_OPTIONS,
) {
  const matches: SearchMatch[] = [];
  collectMatches(rootNode, query.trim(), scope, matches, options);
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
  options: SearchOptions = DEFAULT_SEARCH_OPTIONS,
): MindmapNode {
  const replaceValue = (value: string) => {
    const matches = findMindmapMatches(
      { ...rootNode, text: value, remark: value, children: [] },
      query,
      'all',
      options,
    ).filter((match) => match.field === 'text');

    return matches.reduceRight(
      (nextValue, match) =>
        nextValue.slice(0, match.start) + replacement + nextValue.slice(match.end),
      value,
    );
  };

  return {
    ...rootNode,
    text: shouldSearchField(scope, 'text') ? replaceValue(rootNode.text) : rootNode.text,
    remark: shouldSearchField(scope, 'remark')
      ? replaceValue(rootNode.remark)
      : rootNode.remark,
    children: rootNode.children.map((child) =>
      replaceAllInMindmap(child, query, replacement, scope, options),
    ),
  };
}
