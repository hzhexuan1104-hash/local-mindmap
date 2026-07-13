import { useEffect, useRef, useState } from 'react';

export type TopMenuItem = {
  label: string;
  onSelect?: () => void;
  children?: TopMenuItem[];
  disabled?: boolean;
  dividerBefore?: boolean;
};

export type TopMenuGroup = {
  id: string;
  label: string;
  items: TopMenuItem[];
};

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
  onUndo: () => void;
  onRedo: () => void;
  onQuickSave: () => void;
};

export function TopMenuBar({
  currentTitle,
  currentPath,
  menus,
  message,
  messageKind = 'info',
  isDirty,
  saveStatus = isDirty ? 'dirty' : 'saved',
  saveStatusLabel = isDirty ? '未保存' : '已保存',
  onOpenFileStatus,
  onUndo,
  onRedo,
  onQuickSave,
}: TopMenuBarProps) {
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const menuBarRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const handlePointerDown = (event: globalThis.MouseEvent) => {
      if (
        activeMenuId &&
        menuBarRef.current &&
        !menuBarRef.current.contains(event.target as Node)
      ) {
        setActiveMenuId(null);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !activeMenuId) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
      setActiveMenuId(null);
    };

    document.addEventListener('mousedown', handlePointerDown, true);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown, true);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeMenuId]);

  const runMenuItem = (item: TopMenuItem) => {
    if (!item.onSelect) {
      return;
    }
    setActiveMenuId(null);
    item.onSelect();
  };

  const renderMenuItem = (
    menuId: string,
    item: TopMenuItem,
    index: number,
  ) => {
    if (item.children?.length) {
      return (
        <div
          className={[
            'top-menu-submenu',
            item.dividerBefore ? 'has-divider' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          key={`${menuId}-${item.label}-${index}`}
        >
          <button type="button" role="menuitem" aria-haspopup="menu">
            <span>{item.label}</span>
            <span aria-hidden="true">›</span>
          </button>
          <div className="top-menu-submenu-popover" role="menu">
            {item.children.map((child, childIndex) =>
              renderMenuItem(
                `${menuId}-${item.label}`,
                child,
                childIndex,
              ),
            )}
          </div>
        </div>
      );
    }

    return (
      <button
        key={`${menuId}-${item.label}-${index}`}
        type="button"
        role="menuitem"
        disabled={item.disabled}
        className={item.dividerBefore ? 'has-divider' : undefined}
        onClick={() => runMenuItem(item)}
      >
        {item.label}
      </button>
    );
  };

  return (
    <header className="top-menu-bar" aria-label="应用工具栏">
      <nav
        className="top-menu-nav topbar-left-menus topbar-non-shrink"
        aria-label="顶部菜单"
        data-testid="topbar-left-menus"
        ref={menuBarRef}
      >
        {menus.map((menu) => {
          const isOpen = activeMenuId === menu.id;

          return (
            <div className="top-menu" key={menu.id}>
              <button
                type="button"
                className={isOpen ? 'top-menu-trigger is-open' : 'top-menu-trigger'}
                aria-haspopup="menu"
                aria-expanded={isOpen}
                title={menu.items.map((item) => item.label).join(' / ')}
                onClick={() =>
                  setActiveMenuId((currentId) =>
                    currentId === menu.id ? null : menu.id,
                  )
                }
              >
                {menu.label}
                <span aria-hidden="true">⌄</span>
              </button>
              {isOpen ? (
                <div
                  className={
                    menu.items.some((item) => item.children?.length)
                      ? 'top-menu-popover has-submenus'
                      : 'top-menu-popover'
                  }
                  role="menu"
                >
                  {menu.items.map((item, index) =>
                    renderMenuItem(menu.id, item, index),
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>

      <div
        className="topbar-document-status topbar-true-center"
        data-testid="topbar-document-status"
      >
        <button
          type="button"
          className="top-document-title topbar-title-ellipsis"
          title={currentPath ?? currentTitle}
          onClick={onOpenFileStatus}
        >
          <span
            className={[
              'document-status-dot',
              isDirty ? 'is-dirty' : '',
              `is-${saveStatus}`,
            ]
              .filter(Boolean)
              .join(' ')}
            aria-hidden="true"
          />
          <strong>{currentTitle}</strong>
          <span className="document-status-label">{saveStatusLabel}</span>
        </button>
        {message ? (
          <span
            className={`top-status-message is-${messageKind}`}
            role="status"
            title={message}
          >
            {message}
          </span>
        ) : null}
      </div>

      <div
        className="top-menu-actions topbar-right-actions topbar-non-shrink"
        aria-label="高频操作"
        data-testid="topbar-right-actions"
      >
        <button type="button" className="icon-action" onClick={onUndo} title="撤销">
          ↶
          <span className="sr-only">撤销</span>
        </button>
        <button type="button" className="icon-action" onClick={onRedo} title="重做">
          ↷
          <span className="sr-only">重做</span>
        </button>
        <button
          type="button"
          className="compact-primary-action"
          onClick={onQuickSave}
        >
          保存
        </button>
      </div>
    </header>
  );
}
