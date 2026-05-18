import type { ReactNode } from 'react';

export interface FormFieldProps {
  label?: ReactNode;
  htmlFor?: string;
  description?: ReactNode;
  descriptionId?: string;
  error?: ReactNode;
  errorId?: string;
  children: ReactNode;
  className?: string;
}

export function FormField({
  label,
  htmlFor,
  description,
  descriptionId,
  error,
  errorId,
  children,
  className = '',
}: FormFieldProps) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label htmlFor={htmlFor} className="text-sm font-medium text-[var(--mmp-color-charcoal)]">
          {label}
        </label>
      )}
      {children}
      {description && (
        <p id={descriptionId} className="text-xs leading-5 text-[var(--mmp-color-steel)]">
          {description}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs leading-5 text-[var(--mmp-color-error)]">
          {error}
        </p>
      )}
    </div>
  );
}
