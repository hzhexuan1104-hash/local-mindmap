type ChevronDirection = 'down' | 'up';

type ChevronIconProps = {
  direction?: ChevronDirection;
  className?: string;
};

/** Shared lightweight disclosure icon for custom dropdown triggers. */
export function ChevronIcon({ direction = 'down', className = '' }: ChevronIconProps) {
  return (
    <svg
      className={`chevron-icon${direction === 'up' ? ' is-up' : ''}${className ? ` ${className}` : ''}`}
      data-chevron-direction={direction}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path d="m3.5 6 4.5 4 4.5-4" />
    </svg>
  );
}
