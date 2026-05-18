import type { HTMLAttributes, ReactNode } from 'react';

export interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  interactive?: boolean;
}

export interface CardProps extends PanelProps {
  hoverable?: boolean;
  onClick?: () => void;
}

const paddingClasses = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
} as const;

export function Panel({
  children,
  padding = 'md',
  interactive = false,
  className = '',
  ...rest
}: PanelProps) {
  const interactiveClasses = interactive
    ? 'transition hover:border-[var(--mmp-color-hairline-strong)] hover:shadow-[var(--mmp-shadow-card)]'
    : '';

  return (
    <div
      className={`rounded-lg border border-[var(--mmp-color-hairline)] bg-[var(--mmp-color-surface)] text-[var(--mmp-color-ink)] ${paddingClasses[padding]} ${interactiveClasses} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

export function Card({
  children,
  className = '',
  hoverable = false,
  onClick,
  ...rest
}: CardProps) {
  return (
    <Panel
      {...rest}
      interactive={hoverable || Boolean(onClick)}
      className={`${onClick ? 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mmp-color-primary)]' : ''} ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : rest.role}
      tabIndex={onClick ? 0 : rest.tabIndex}
      onKeyDown={
        onClick
          ? (event) => {
              rest.onKeyDown?.(event);
              if (event.defaultPrevented) return;
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onClick();
              }
            }
          : rest.onKeyDown
      }
    >
      {children}
    </Panel>
  );
}
