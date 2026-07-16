import { type KeyboardEvent as ReactKeyboardEvent, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { MenuGroupDefinition, MenuItemDefinition } from '../../features/menu/menuTypes';

export type TopMenuItem = MenuItemDefinition;
export type TopMenuGroup = MenuGroupDefinition;

type TopMenuBarProps = {
  currentTitle: string;
  currentPath?: string | null;
  menus: TopMenuGroup[];
  message?: string;
  messageKind?: 'info' | 'success' | 'warning' | 'error';
  isDirty: boolean;
  saveStatus?: string;
  saveStatusLabel?: string;
  onOpenFileStatus?: () => void;
};

const itemKey = (path: string[]) => path.join('/');
const itemAction = (item: TopMenuItem) => item.execute ?? item.onSelect;

export function TopMenuBar({
  currentTitle, currentPath, menus, message, messageKind = 'info', isDirty,
  saveStatus = isDirty ? 'dirty' : 'saved', saveStatusLabel = isDirty ? '未保存' : '已保存',
  onOpenFileStatus,
}: TopMenuBarProps) {
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [openPath, setOpenPath] = useState<string[]>([]);
  const [flipped, setFlipped] = useState<Record<string, 'left' | 'up' | 'left-up'>>({});
  const menuBarRef = useRef<HTMLElement | null>(null);
  const closeTimerRef = useRef<number | null>(null);

  const clearCloseTimer = () => {
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
  };
  const closeAll = () => { clearCloseTimer(); setOpenPath([]); setActiveMenuId(null); };
  const closeLater = () => {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => setOpenPath([]), 200);
  };

  useEffect(() => {
    const handlePointerDown = (event: globalThis.MouseEvent) => {
      if (activeMenuId && menuBarRef.current && !menuBarRef.current.contains(event.target as Node)) closeAll();
    };
    document.addEventListener('mousedown', handlePointerDown, true);
    return () => { document.removeEventListener('mousedown', handlePointerDown, true); clearCloseTimer(); };
  });

  useLayoutEffect(() => {
    if (!activeMenuId) return;
    const next: Record<string, 'left' | 'up' | 'left-up'> = {};
    document.querySelectorAll<HTMLElement>('[data-submenu-popover]').forEach((popover) => {
      const rect = popover.getBoundingClientRect();
      const key = popover.dataset.submenuPopover;
      if (!key) return;
      const left = rect.right > window.innerWidth - 8;
      const up = rect.bottom > window.innerHeight - 8;
      if (left || up) next[key] = left && up ? 'left-up' : left ? 'left' : 'up';
    });
    setFlipped(next);
  }, [activeMenuId, openPath]);

  const focusSibling = (button: HTMLButtonElement, direction: 1 | -1) => {
    const menu = button.closest<HTMLElement>('[role="menu"]');
    const buttons = menu ? Array.from(menu.querySelectorAll<HTMLButtonElement>(':scope > [data-menu-row] > button:not(:disabled), :scope > button:not(:disabled)')) : [];
    const index = buttons.indexOf(button);
    buttons[(index + direction + buttons.length) % buttons.length]?.focus();
  };
  const focusMenuItem = (path: string[]) => window.requestAnimationFrame(() => Array.from(document.querySelectorAll<HTMLButtonElement>('[data-menu-item-id]')).find((button) => button.dataset.menuItemId === itemKey(path))?.focus());

  const onItemKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, item: TopMenuItem, path: string[]) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); focusSibling(event.currentTarget, event.key === 'ArrowDown' ? 1 : -1); return; }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      const menu = event.currentTarget.closest<HTMLElement>('[role="menu"]');
      const buttons = menu ? Array.from(menu.querySelectorAll<HTMLButtonElement>(':scope > [data-menu-row] > button:not(:disabled), :scope > button:not(:disabled)')) : [];
      buttons[event.key === 'Home' ? 0 : buttons.length - 1]?.focus();
      return;
    }
    if (event.key === 'ArrowRight' && item.children?.length) { event.preventDefault(); setOpenPath(path); focusMenuItem([...path, item.children[0].id]); return; }
    if (event.key === 'ArrowLeft' && path.length > 1) { event.preventDefault(); setOpenPath(path.slice(0, -1)); focusMenuItem(path.slice(0, -1)); return; }
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); handleItem(item, path); return; }
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); if (path.length > 1) { setOpenPath(path.slice(0, -1)); focusMenuItem(path.slice(0, -1)); } else closeAll(); return; }
    if (event.key === 'Tab') { closeAll(); }
  };

  const handleItem = (item: TopMenuItem, path: string[]) => {
    if (item.disabled) return;
    if (item.children?.length) { setOpenPath((current) => itemKey(current) === itemKey(path) ? path.slice(0, -1) : path); return; }
    const action = itemAction(item);
    if (!action) return;
    closeAll();
    void action();
  };

  const renderItem = (item: TopMenuItem, path: string[], depth: number) => {
    const hasChildren = Boolean(item.children?.length);
    const key = itemKey(path);
    const isOpen = hasChildren && openPath.slice(0, path.length).join('/') === key;
    return (
      <div className={`top-menu-submenu ${item.separatorBefore || item.dividerBefore ? 'has-divider' : ''} ${isOpen ? 'is-open' : ''}`} data-menu-row key={key} onMouseEnter={() => { clearCloseTimer(); if (hasChildren) setOpenPath(path); }} onMouseLeave={closeLater}>
        <button type="button" role="menuitem" aria-haspopup={hasChildren ? 'menu' : undefined} aria-expanded={hasChildren ? isOpen : undefined} disabled={item.disabled} title={item.disabledReason ?? item.label} data-menu-item-id={key} className={item.danger ? 'is-danger' : undefined} onClick={() => handleItem(item, path)} onKeyDown={(event) => onItemKeyDown(event, item, path)}>
          <span className="top-menu-item-label">{item.checked ? <span className="menu-check">✓</span> : <span className="menu-check" />}{item.label}</span>
          <span className="top-menu-item-meta">{item.shortcut ? <kbd>{item.shortcut}</kbd> : null}{hasChildren ? <span aria-hidden="true">›</span> : null}</span>
        </button>
        {hasChildren && isOpen ? <div className={`top-menu-submenu-popover ${flipped[key] ? `is-flipped-${flipped[key]}` : ''}`} data-submenu-popover={key} role="menu" onMouseEnter={clearCloseTimer} onMouseLeave={closeLater}>{item.children!.map((child) => renderItem(child, [...path, child.id], depth + 1))}</div> : null}
      </div>
    );
  };

  return <header className="top-menu-bar" aria-label="应用工具栏">
    <nav className="top-menu-nav topbar-left-menus topbar-non-shrink" aria-label="顶部菜单" data-testid="topbar-left-menus" ref={menuBarRef}>
      {menus.map((menu) => {
        const isOpen = activeMenuId === menu.id;
        return <div className="top-menu" key={menu.id}>
          <button type="button" data-menu-item-id={menu.id} className={isOpen ? 'top-menu-trigger is-open' : 'top-menu-trigger'} aria-haspopup="menu" aria-expanded={isOpen} onClick={() => { clearCloseTimer(); setActiveMenuId((current) => current === menu.id ? null : menu.id); setOpenPath([]); }} onKeyDown={(event) => { if (event.nativeEvent.isComposing) return; if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setActiveMenuId(menu.id); setOpenPath([]); focusMenuItem([menu.id, menu.items[0]?.id]); } else if (event.key === 'Escape') closeAll(); }}>{menu.label}<span aria-hidden="true">⌄</span></button>
          {isOpen ? <div className="top-menu-popover has-submenus" role="menu" onMouseEnter={clearCloseTimer} onMouseLeave={closeLater}>{menu.items.map((item) => renderItem(item, [menu.id, item.id], 1))}</div> : null}
        </div>;
      })}
    </nav>
    <div className="topbar-document-status topbar-true-center" data-testid="topbar-document-status"><button type="button" className="top-document-title topbar-title-ellipsis" title={currentPath ?? currentTitle} onClick={onOpenFileStatus}><span className={['document-status-dot', isDirty ? 'is-dirty' : '', `is-${saveStatus}`].filter(Boolean).join(' ')} aria-hidden="true" /><strong>{currentTitle}</strong><span className="document-status-label">{saveStatusLabel}</span></button>{message ? <span className={`top-status-message is-${messageKind}`} role="status" title={message}>{message}</span> : null}</div>
  </header>;
}
