import type { ReactNode } from 'react';

export interface BadgeProps {
  children: ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'error' | 'info';
  size?: 'sm' | 'md';
}

const variantClasses = {
  default:
    'border-[var(--mmp-color-hairline)] bg-[var(--mmp-color-surface)] text-[var(--mmp-color-charcoal)]',
  success:
    'border-[color-mix(in_oklab,var(--mmp-color-success)_35%,transparent)] bg-[color-mix(in_oklab,var(--mmp-color-success)_12%,transparent)] text-[var(--mmp-color-success)]',
  warning:
    'border-[color-mix(in_oklab,var(--mmp-color-warning)_35%,transparent)] bg-[color-mix(in_oklab,var(--mmp-color-warning)_12%,transparent)] text-[var(--mmp-color-warning)]',
  danger:
    'border-[color-mix(in_oklab,var(--mmp-color-error)_35%,transparent)] bg-[color-mix(in_oklab,var(--mmp-color-error)_12%,transparent)] text-[var(--mmp-color-error)]',
  error:
    'border-[color-mix(in_oklab,var(--mmp-color-error)_35%,transparent)] bg-[color-mix(in_oklab,var(--mmp-color-error)_12%,transparent)] text-[var(--mmp-color-error)]',
  info:
    'border-[color-mix(in_oklab,var(--mmp-color-info)_35%,transparent)] bg-[color-mix(in_oklab,var(--mmp-color-info)_12%,transparent)] text-[var(--mmp-color-info)]',
} as const;

const sizeClasses = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
} as const;

export function Badge({ children, variant = 'default', size = 'sm' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border font-medium ${variantClasses[variant]} ${sizeClasses[size]}`}
    >
      {children}
    </span>
  );
}
