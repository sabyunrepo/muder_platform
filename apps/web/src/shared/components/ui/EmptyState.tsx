import type { ReactNode } from 'react';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className = '' }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 text-center ${className}`}>
      {icon && <div className="mb-4 text-[var(--mmp-color-muted)]">{icon}</div>}
      <h3 className="text-lg font-semibold text-[var(--mmp-color-charcoal)]">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm leading-6 text-[var(--mmp-color-steel)]">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
