import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { NODE_PROGRESS_VALUES } from '../../features/mindmap/nodeMarkers';
import type { MindmapNodeProgress } from '../../features/mindmap/types';
import { ChevronIcon } from './ChevronIcon';

const OPTIONS = ['none', ...NODE_PROGRESS_VALUES] as const;
type ProgressOption = (typeof OPTIONS)[number];
type ProgressValue = ProgressOption | 'mixed';

const progressLabels: Record<ProgressValue, string> = {
  none: '无', mixed: '混合', 0: '0%', 25: '25%', 50: '50%', 75: '75%', 100: '100%',
};

const progressSectors = {
  25: 'M8 8V2a6 6 0 0 1 6 6Z',
  50: 'M8 2a6 6 0 0 1 0 12Z',
  75: 'M8 8V2a6 6 0 1 1-6 6Z',
};

function ProgressIcon({ value }: { value: ProgressValue }) {
  return (
    <svg className="node-quick-progress-icon" width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      {value === 100 ? (
        <>
          <circle cx="8" cy="8" r="6" fill="#218457" stroke="#218457" strokeWidth="1.25" />
          <path d="m5.2 8 1.8 1.8 3.8-3.8" fill="none" stroke="#fff" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : (
        <>
          <circle cx="8" cy="8" r="6" fill="#f0f4fa" />
          {(value === 25 || value === 50 || value === 75) && <path d={progressSectors[value]} fill="var(--accent-strong)" />}
          <circle cx="8" cy="8" r="6" fill="none" stroke="#8190a6" strokeWidth="1.25" strokeDasharray={value === 'none' ? '2 1.35' : undefined} />
          {value === 'none' && <path d="M6 8h4" stroke="#687991" strokeWidth="1.25" strokeLinecap="round" />}
          {value === 'mixed' && <path d="M5.8 6.5h4.4m-4.4 3h4.4" stroke="#687991" strokeWidth="1.25" strokeLinecap="round" />}
        </>
      )}
    </svg>
  );
}

export function NodeProgressSelect({
  value,
  disabled,
  onChange,
}: {
  value: ProgressValue;
  disabled: boolean;
  onChange: (progress?: MindmapNodeProgress) => void;
}) {
  const listId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const isOpen = activeIndex !== null && !disabled;
  const selectedIndex = value === 'mixed' ? -1 : OPTIONS.indexOf(value);
  const optionId = (index: number) => `${listId}-${index}`;

  useLayoutEffect(() => {
    const trigger = triggerRef.current;
    const list = listRef.current;
    if (!isOpen || !trigger || !list) return;
    const scrollArea = trigger.closest('.node-quick-toolbar-scroll');
    const close = () => setActiveIndex(null);
    const position = () => {
      const rect = trigger.getBoundingClientRect();
      const row = scrollArea?.getBoundingClientRect();
      if (row && (rect.right <= row.left || rect.left >= row.right)) {
        close();
        return;
      }
      const gutter = 8;
      const gap = 5;
      list.style.left = `${Math.max(gutter, Math.min(rect.left, window.innerWidth - list.offsetWidth - gutter))}px`;
      const below = rect.bottom + gap;
      const above = rect.top - gap - list.offsetHeight;
      list.style.top = `${below + list.offsetHeight <= window.innerHeight - gutter ? below : Math.max(gutter, above)}px`;
    };
    const dismissOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !trigger.contains(event.target) && !list.contains(event.target)) close();
    };

    position();
    document.addEventListener('pointerdown', dismissOutside, true);
    window.addEventListener('resize', position);
    scrollArea?.addEventListener('scroll', position);
    window.addEventListener('mindmap:close-transient-ui', close);
    return () => {
      document.removeEventListener('pointerdown', dismissOutside, true);
      window.removeEventListener('resize', position);
      scrollArea?.removeEventListener('scroll', position);
      window.removeEventListener('mindmap:close-transient-ui', close);
    };
  }, [isOpen]);

  const choose = (option: ProgressOption) => {
    setActiveIndex(null);
    if (option !== value) onChange(option === 'none' ? undefined : option);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        const step = event.key === 'ArrowDown' ? 1 : -1;
        const start = selectedIndex >= 0 ? selectedIndex : step > 0 ? 0 : OPTIONS.length - 1;
        setActiveIndex((index) => index === null ? start : Math.max(0, Math.min(index + step, OPTIONS.length - 1)));
        break;
      }
      case 'Home':
      case 'End':
        setActiveIndex(event.key === 'Home' ? 0 : OPTIONS.length - 1);
        break;
      case 'Enter':
      case ' ':
        if (activeIndex === null) setActiveIndex(Math.max(0, selectedIndex));
        else choose(OPTIONS[activeIndex]);
        break;
      case 'Escape':
        if (!isOpen) return;
        setActiveIndex(null);
        break;
      default:
        return;
    }
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <div className="node-quick-select" title="完成度">
      <span className="node-quick-select-label" aria-hidden="true">完成度</span>
      <button
        ref={triggerRef}
        type="button"
        className="node-quick-progress-trigger"
        role="combobox"
        aria-label="设置完成度"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listId : undefined}
        aria-activedescendant={isOpen ? optionId(activeIndex) : undefined}
        disabled={disabled}
        onClick={(event) => {
          event.currentTarget.focus({ preventScroll: true });
          setActiveIndex(isOpen ? null : Math.max(0, selectedIndex));
        }}
        onKeyDown={handleKeyDown}
        onBlur={() => setActiveIndex(null)}
      >
        <ProgressIcon value={value} />
        <span>{progressLabels[value]}</span>
        <ChevronIcon direction={isOpen ? 'up' : 'down'} />
      </button>
      {isOpen && createPortal(
        <div
          ref={listRef}
          id={listId}
          className="node-quick-progress-list"
          role="listbox"
          aria-label="完成度"
          onMouseDown={(event) => event.preventDefault()}
        >
          {OPTIONS.map((option, index) => (
            <div
              key={option}
              id={optionId(index)}
              className={`node-quick-progress-option${activeIndex === index ? ' is-active' : ''}`}
              role="option"
              aria-selected={option === value}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => choose(option)}
            >
              <ProgressIcon value={option} />
              <span>{progressLabels[option]}</span>
              {option === value && (
                <svg className="node-quick-progress-check" width="13" height="13" viewBox="0 0 16 16" aria-hidden="true">
                  <path d="m3.8 8 2.7 2.7 5.7-5.7" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}
