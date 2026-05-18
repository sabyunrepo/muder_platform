import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { FormField } from './FormField';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  description?: string;
  leftIcon?: ReactNode;
}

export function Input({
  label,
  error,
  description,
  leftIcon,
  id,
  className = '',
  ...rest
}: InputProps) {
  const generatedId = useId();
  const inputId = id ?? `input-${generatedId}`;
  const describedBy = [
    description ? `${inputId}-description` : null,
    error ? `${inputId}-error` : null,
  ].filter(Boolean).join(' ') || undefined;

  const input = (
    <div className="relative">
      {leftIcon && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--mmp-color-muted)]">
          {leftIcon}
        </span>
      )}
      <input
        id={inputId}
        className={`min-h-10 w-full rounded-lg border border-[var(--mmp-color-hairline)] bg-[var(--mmp-color-surface-soft)] px-3 py-2 text-sm text-[var(--mmp-color-ink)] placeholder:text-[var(--mmp-color-muted)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mmp-color-primary)] disabled:cursor-not-allowed disabled:opacity-50 ${leftIcon ? 'pl-10' : ''} ${error ? 'border-[var(--mmp-color-error)]' : ''} ${className}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...rest}
      />
    </div>
  );

  if (!label && !description && !error) return input;

  return (
    <FormField
      label={label}
      htmlFor={inputId}
      description={description}
      descriptionId={`${inputId}-description`}
      error={error}
      errorId={`${inputId}-error`}
    >
      {input}
    </FormField>
  );
}
