import type { ReactNode } from 'react';

export interface AlertProps {
  title?: ReactNode;
  children: ReactNode;
  tone?: 'info' | 'success' | 'warning' | 'error';
  icon?: ReactNode;
  className?: string;
}

const toneClasses = {
  info:
    'border-[color-mix(in_oklab,var(--mmp-color-info)_35%,transparent)] bg-[color-mix(in_oklab,var(--mmp-color-info)_10%,transparent)] text-[var(--mmp-color-info)]',
  success:
    'border-[color-mix(in_oklab,var(--mmp-color-success)_35%,transparent)] bg-[color-mix(in_oklab,var(--mmp-color-success)_10%,transparent)] text-[var(--mmp-color-success)]',
  warning:
    'border-[color-mix(in_oklab,var(--mmp-color-warning)_35%,transparent)] bg-[color-mix(in_oklab,var(--mmp-color-warning)_10%,transparent)] text-[var(--mmp-color-warning)]',
  error:
    'border-[color-mix(in_oklab,var(--mmp-color-error)_35%,transparent)] bg-[color-mix(in_oklab,var(--mmp-color-error)_10%,transparent)] text-[var(--mmp-color-error)]',
} as const;

export function Alert({ title, children, tone = 'info', icon, className = '' }: AlertProps) {
  return (
    <div className={`rounded-lg border p-4 ${toneClasses[tone]} ${className}`} role="status">
      <div className="flex gap-3">
        {icon && <div className="shrink-0" aria-hidden="true">{icon}</div>}
        <div className="min-w-0">
          {title && <p className="font-medium">{title}</p>}
          <div className={`text-sm leading-6 ${title ? 'mt-1' : ''}`}>{children}</div>
        </div>
      </div>
    </div>
  );
}
