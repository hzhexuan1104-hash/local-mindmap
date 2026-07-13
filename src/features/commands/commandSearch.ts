import type { CommandCategory, CommandUsage, PaletteResult, PaletteResultType } from './commandTypes';

export type SearchPrefix = 'all' | 'commands' | 'nodes' | 'recent-files' | 'plugins';

export function parseSearchPrefix(query: string): { prefix: SearchPrefix; query: string } {
  const trimmedStart = query.trimStart();
  const marker = trimmedStart[0];
  const prefix: SearchPrefix =
    marker === '>' ? 'commands' :
    marker === '@' ? 'nodes' :
    marker === '#' ? 'recent-files' :
    marker === ':' ? 'plugins' : 'all';
  return { prefix, query: prefix === 'all' ? query.trim() : trimmedStart.slice(1).trim() };
}

function isSubsequence(query: string, value: string) {
  let queryIndex = 0;
  for (let index = 0; index < value.length && queryIndex < query.length; index += 1) {
    if (value[index] === query[queryIndex]) queryIndex += 1;
  }
  return queryIndex === query.length;
}

function typeAllowed(type: PaletteResultType, prefix: SearchPrefix) {
  if (prefix === 'all') return true;
  if (prefix === 'commands') return type === 'command' || type === 'plugin-command';
  if (prefix === 'nodes') return type === 'node';
  if (prefix === 'recent-files') return type === 'recent-file';
  return type === 'plugin-command';
}

function tokenScore(result: PaletteResult, token: string) {
  const title = result.title.toLocaleLowerCase();
  const description = (result.description ?? '').toLocaleLowerCase();
  const keywords = (result.keywords ?? []).map((item) => item.toLocaleLowerCase());
  const category = result.category.toLocaleLowerCase();
  const searchText = (result.searchText ?? '').toLocaleLowerCase();
  if (title === token) return 120;
  if (title.startsWith(token)) return 90;
  if (title.includes(token)) return 70;
  if (keywords.some((item) => item === token)) return 62;
  if (keywords.some((item) => item.includes(token))) return 48;
  if (category.includes(token)) return 34;
  if (description.includes(token)) return 24;
  if (searchText.includes(token)) return 22;
  if (isSubsequence(token, title)) return 12;
  return Number.NEGATIVE_INFINITY;
}

const EMPTY_QUERY_DEFAULT_IDS = new Set([
  'builtin.file.open',
  'builtin.file.new',
  'builtin.file.save',
  'builtin.template.library',
  'builtin.view.outline',
]);

export function searchPaletteResults(
  results: PaletteResult[],
  rawQuery: string,
  options: {
    recentCommands?: CommandUsage[];
    favoriteCommandIds?: string[];
    contextCategories?: CommandCategory[];
    maxResults?: number;
  } = {},
) {
  const { prefix, query } = parseSearchPrefix(rawQuery);
  const tokens = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const recentById = new Map((options.recentCommands ?? []).map((item) => [item.commandId, item]));
  const favorites = new Set(options.favoriteCommandIds ?? []);
  const contextCategories = new Set(options.contextCategories ?? []);
  const maxResults = options.maxResults ?? 50;

  return results
    .filter((result) => typeAllowed(result.type, prefix))
    .map((result, stableIndex) => {
      let score = 0;
      if (tokens.length === 0) {
        const commandId = result.commandId;
        const isRecent = Boolean(commandId && recentById.has(commandId));
        const isFavorite = Boolean(commandId && favorites.has(commandId));
        const isDefault = Boolean(commandId && EMPTY_QUERY_DEFAULT_IDS.has(commandId));
        if (result.type === 'node' || result.type === 'template' || result.type === 'node-type') return null;
        if (result.type === 'plugin-command' && !isRecent && !isFavorite) return null;
        if (result.type !== 'recent-file' && !isRecent && !isFavorite && !isDefault && !contextCategories.has(result.category)) return null;
      } else {
        for (const token of tokens) {
          const next = tokenScore(result, token);
          if (!Number.isFinite(next)) return null;
          score += next;
        }
      }
      const commandId = result.commandId;
      if (commandId && favorites.has(commandId)) score += 18;
      const recent = commandId ? recentById.get(commandId) : undefined;
      if (recent && result.riskLevel !== 'high' && result.riskLevel !== 'critical') {
        score += Math.min(14, 5 + Math.log2(recent.useCount + 1) * 2);
      }
      if (contextCategories.has(result.category)) score += 8;
      if (result.disabledReason) score -= 1000;
      return { result, score, stableIndex };
    })
    .filter((item): item is { result: PaletteResult; score: number; stableIndex: number } => Boolean(item))
    .sort((left, right) => right.score - left.score || left.stableIndex - right.stableIndex || left.result.id.localeCompare(right.result.id))
    .slice(0, maxResults)
    .map((item) => item.result);
}
