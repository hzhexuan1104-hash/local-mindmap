import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import { searchPaletteResults } from '../../features/commands/commandSearch';
import type {
  CommandCategory,
  CommandUsage,
  PaletteResult,
} from '../../features/commands/commandTypes';

const CATEGORY_LABELS: Record<CommandCategory, string> = {
  file: '文件',
  edit: '编辑',
  node: '节点',
  view: '视图',
  navigation: '导航',
  template: '模板',
  'node-type': '节点类型',
  plugin: '插件',
  history: '历史',
  developer: '开发者',
  help: '帮助',
};

type CommandPaletteProps = {
  results: PaletteResult[];
  recentCommands: CommandUsage[];
  favoriteCommandIds: string[];
  contextCategories: CommandCategory[];
  closeAfterExecute: boolean;
  onClose: () => void;
  onRecordCommand: (commandId: string) => void | Promise<void>;
  onToggleFavorite: (commandId: string) => void | Promise<void>;
  onDisabled: (reason: string) => void;
  onError: (message: string) => void;
};

export function CommandPalette({
  results,
  recentCommands,
  favoriteCommandIds,
  contextCategories,
  closeAfterExecute,
  onClose,
  onRecordCommand,
  onToggleFavorite,
  onDisabled,
  onError,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [executingId, setExecutingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const isComposingRef = useRef(false);
  const executionLockRef = useRef(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query), 100);
    return () => window.clearTimeout(timer);
  }, [query]);

  const visibleResults = useMemo(
    () =>
      searchPaletteResults(results, debouncedQuery, {
        recentCommands,
        favoriteCommandIds,
        contextCategories,
        maxResults: 50,
      }),
    [
      contextCategories,
      debouncedQuery,
      favoriteCommandIds,
      recentCommands,
      results,
    ],
  );

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    inputRef.current?.focus({ preventScroll: true });
    return () => {
      const previous = previousFocusRef.current;
      if (previous?.isConnected) {
        requestAnimationFrame(() => previous.focus({ preventScroll: true }));
      }
    };
  }, []);

  useEffect(() => {
    setSelectedIndex((current) =>
      visibleResults.length === 0 ? 0 : Math.min(current, visibleResults.length - 1),
    );
  }, [visibleResults.length]);

  useEffect(() => {
    dialogRef.current
      ?.querySelector<HTMLElement>(`[data-palette-index="${selectedIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const executeResult = async (result: PaletteResult) => {
    if (result.disabledReason) {
      onDisabled(result.disabledReason);
      return;
    }
    if (executionLockRef.current) return;
    executionLockRef.current = true;
    setExecutingId(result.id);
    try {
      await result.execute();
      if (result.commandId) await onRecordCommand(result.commandId);
      if (closeAfterExecute) onClose();
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error));
    } finally {
      executionLockRef.current = false;
      setExecutingId(null);
    }
  };

  const trapTab = (event: KeyboardEvent<HTMLElement>) => {
    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        'input:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    );
    if (focusable.length === 0) return;
    const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);
    const nextIndex = event.shiftKey
      ? (currentIndex <= 0 ? focusable.length : currentIndex) - 1
      : (currentIndex + 1) % focusable.length;
    event.preventDefault();
    focusable[nextIndex]?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation();
    if (isComposingRef.current || event.nativeEvent.isComposing) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === 'k') {
      event.preventDefault();
      inputRef.current?.focus();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === 'Tab') {
      trapTab(event);
      return;
    }
    if (visibleResults.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedIndex((index) => (index + 1) % visibleResults.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedIndex((index) => (index - 1 + visibleResults.length) % visibleResults.length);
    } else if (event.key === 'Home') {
      event.preventDefault();
      setSelectedIndex(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setSelectedIndex(visibleResults.length - 1);
    } else if (event.key === 'PageDown') {
      event.preventDefault();
      setSelectedIndex((index) => Math.min(visibleResults.length - 1, index + 8));
    } else if (event.key === 'PageUp') {
      event.preventDefault();
      setSelectedIndex((index) => Math.max(0, index - 8));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const current = visibleResults[selectedIndex];
      if (current) void executeResult(current);
    }
  };

  const handleBackdropMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose();
  };

  return (
    <div
      className="command-palette-backdrop"
      role="presentation"
      onMouseDown={handleBackdropMouseDown}
      onWheel={(event) => event.stopPropagation()}
    >
      <section
        ref={dialogRef}
        className="command-palette-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="command-palette-title"
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <h2 id="command-palette-title" className="sr-only">命令面板</h2>
        <div className="command-palette-search">
          <span aria-hidden="true">⌕</span>
          <input
            ref={inputRef}
            type="search"
            value={query}
            aria-label="搜索命令、节点、最近文件、模板和插件"
            aria-controls="command-palette-results"
            aria-activedescendant={visibleResults[selectedIndex] ? `palette-option-${visibleResults[selectedIndex].id}` : undefined}
            placeholder="搜索命令、节点、文件…  可用 > @ # : 过滤"
            onChange={(event) => {
              setQuery(event.target.value);
              setSelectedIndex(0);
            }}
            onCompositionStart={() => { isComposingRef.current = true; }}
            onCompositionEnd={() => { isComposingRef.current = false; }}
          />
          <kbd>Ctrl K</kbd>
        </div>

        <div
          id="command-palette-results"
          className="command-palette-results"
          role="listbox"
          aria-label="命令面板结果"
        >
          {visibleResults.length === 0 ? (
            <div className="command-palette-empty">
              <strong>没有匹配结果</strong>
              <span>试试更短的关键词，或使用 &gt; @ # : 过滤范围。</span>
            </div>
          ) : (
            visibleResults.map((result, index) => {
              const selected = index === selectedIndex;
              const favorite = Boolean(result.commandId && favoriteCommandIds.includes(result.commandId));
              const canFavorite = Boolean(result.commandId && (result.type === 'command' || result.type === 'plugin-command'));
              return (
                <div
                  id={`palette-option-${result.id}`}
                  key={result.id}
                  role="option"
                  aria-selected={selected}
                  aria-disabled={Boolean(result.disabledReason)}
                  data-palette-index={index}
                  className={[
                    'command-palette-result',
                    selected ? 'is-selected' : '',
                    result.disabledReason ? 'is-disabled' : '',
                  ].filter(Boolean).join(' ')}
                  onMouseEnter={() => setSelectedIndex(index)}
                  onClick={() => void executeResult(result)}
                >
                  <span className="command-palette-icon" aria-hidden="true">{result.icon ?? (result.type === 'node' ? '◇' : result.type === 'recent-file' ? '▤' : '⌘')}</span>
                  <span className="command-palette-copy">
                    <span className="command-palette-title-row">
                      <strong>{result.title}</strong>
                      <small>{CATEGORY_LABELS[result.category]}</small>
                      {result.pluginName ? <small>来源：{result.pluginName}</small> : null}
                      {result.riskLevel && result.riskLevel !== 'low' ? (
                        <small className={`risk-badge is-${result.riskLevel}`}>风险：{result.riskLevel}</small>
                      ) : null}
                    </span>
                    {result.disabledReason ? (
                      <span className="command-disabled-reason">不可用：{result.disabledReason}</span>
                    ) : result.description ? (
                      <span>{result.description}</span>
                    ) : null}
                  </span>
                  {executingId === result.id ? <span className="command-running">执行中…</span> : null}
                  {result.shortcut ? <kbd>{result.shortcut}</kbd> : null}
                  {canFavorite ? (
                    <button
                      type="button"
                      className={favorite ? 'command-favorite is-active' : 'command-favorite'}
                      aria-label={favorite ? `取消收藏 ${result.title}` : `收藏 ${result.title}`}
                      aria-pressed={favorite}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (result.commandId) void onToggleFavorite(result.commandId);
                      }}
                    >
                      {favorite ? '★' : '☆'}
                    </button>
                  ) : null}
                </div>
              );
            })
          )}
          {visibleResults.length >= 50 ? <p className="command-palette-limit">继续输入以缩小范围</p> : null}
        </div>

        <footer className="command-palette-footer">
          <span><kbd>↑↓</kbd> 选择</span>
          <span><kbd>Enter</kbd> 执行</span>
          <span><kbd>Esc</kbd> 关闭</span>
          <span><kbd>&gt;</kbd> 命令 <kbd>@</kbd> 节点 <kbd>#</kbd> 文件 <kbd>:</kbd> 插件</span>
        </footer>
      </section>
    </div>
  );
}
