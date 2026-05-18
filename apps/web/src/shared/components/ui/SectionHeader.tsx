import type { ReactNode } from 'react';

export interface SectionHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function SectionHeader({ title, description, action, className = '' }: SectionHeaderProps) {
  return (
    <div className={`flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between ${className}`}>
      <div className="min-w-0">
        <h2 className="text-xl font-semibold tracking-normal text-[var(--mmp-color-ink)]">{title}</h2>
        {description && (
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--mmp-color-steel)]">
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
