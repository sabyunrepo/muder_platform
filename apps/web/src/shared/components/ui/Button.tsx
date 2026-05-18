import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Spinner } from './Spinner';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export interface IconButtonProps extends Omit<ButtonProps, 'children' | 'leftIcon' | 'rightIcon'> {
  icon: ReactNode;
  label: string;
}

const baseClasses =
  'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mmp-color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--mmp-color-canvas)] disabled:pointer-events-none disabled:opacity-50';

const variantClasses = {
  primary:
    'bg-[var(--mmp-color-primary)] text-[var(--mmp-color-on-primary)] hover:brightness-105',
  secondary:
    'border border-[var(--mmp-color-hairline)] bg-[var(--mmp-color-surface)] text-[var(--mmp-color-ink)] hover:bg-[var(--mmp-color-surface-soft)]',
  ghost:
    'bg-transparent text-[var(--mmp-color-charcoal)] hover:bg-[var(--mmp-color-surface)]',
  danger:
    'bg-[var(--mmp-color-error)] text-white hover:brightness-105',
} as const;

const sizeClasses = {
  sm: 'min-h-8 gap-1.5 px-3 py-1.5 text-sm',
  md: 'min-h-10 gap-2 px-4 py-2 text-sm',
  lg: 'min-h-11 gap-2 px-5 py-2.5 text-base',
} as const;

const iconSizeClasses = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-11 w-11',
} as const;

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  disabled,
  children,
  className = '',
  type = 'button',
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || isLoading;

  return (
    <button
      type={type}
      disabled={isDisabled}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...rest}
    >
      {isLoading ? <Spinner size="sm" /> : leftIcon}
      {children}
      {!isLoading && rightIcon}
    </button>
  );
}

export function IconButton({
  icon,
  label,
  size = 'md',
  variant = 'ghost',
  className = '',
  ...rest
}: IconButtonProps) {
  return (
    <Button
      {...rest}
      variant={variant}
      size={size}
      className={`${iconSizeClasses[size]} px-0 py-0 ${className}`}
      aria-label={label}
    >
      {icon}
    </Button>
  );
}
