import { useEffect, useRef, useState } from 'react';

export type TopMenuItem = {
  label: string;
  onSelect: () => void;
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
  onUndo: () => void;
  onRedo: () => void;
};

export function TopMenuBar({
  currentTitle,
  currentPath,
  menus,
  message,
  onUndo,
  onRedo,
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
    setActiveMenuId(null);
    item.onSelect();
  };

  return (
    <header className="top-menu-bar" aria-labelledby="app-title">
      <div className="top-brand">
        <span className="top-brand-mark" aria-hidden="true">
          LM
        </span>
        <div className="top-brand-copy">
          <strong id="app-title">本地化思维导图工具</strong>
          <span>Local Mindmap</span>
        </div>
      </div>

      <div className="top-document-title" title={currentPath ?? currentTitle}>
        <span className="document-status-dot" aria-hidden="true" />
        <strong>{currentTitle}</strong>
      </div>

      <nav className="top-menu-nav" aria-label="顶部菜单" ref={menuBarRef}>
        {menus.map((menu) => {
          const isOpen = activeMenuId === menu.id;

          return (
            <div className="top-menu" key={menu.id}>
              <button
                type="button"
                className={isOpen ? 'top-menu-trigger is-open' : 'top-menu-trigger'}
                aria-haspopup="menu"
                aria-expanded={isOpen}
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
                <div className="top-menu-popover" role="menu">
                  {menu.items.map((item, index) => (
                    <button
                      key={`${menu.id}-${item.label}-${index}`}
                      type="button"
                      role="menuitem"
                      disabled={item.disabled}
                      className={item.dividerBefore ? 'has-divider' : undefined}
                      onClick={() => runMenuItem(item)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>

      <div className="top-menu-actions" aria-label="高频操作">
        {message ? (
          <span className="top-status-message" role="status" title={message}>
            {message}
          </span>
        ) : null}
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
          onClick={() =>
            setActiveMenuId((currentId) =>
              currentId === 'import-export' ? null : 'import-export',
            )
          }
        >
          导出
        </button>
      </div>
    </header>
  );
}
