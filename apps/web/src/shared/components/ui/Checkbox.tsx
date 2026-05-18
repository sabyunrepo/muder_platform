import { useId, type InputHTMLAttributes } from 'react';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  description?: string;
  error?: string;
}

export function Checkbox({
  label,
  description,
  error,
  id,
  className = '',
  ...rest
}: CheckboxProps) {
  const generatedId = useId();
  const checkboxId = id ?? `checkbox-${generatedId}`;
  const describedBy = [
    description ? `${checkboxId}-description` : null,
    error ? `${checkboxId}-error` : null,
  ].filter(Boolean).join(' ') || undefined;

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label className="flex items-start gap-3 text-sm text-[var(--mmp-color-charcoal)]" htmlFor={checkboxId}>
        <input
          {...rest}
          id={checkboxId}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className="mt-0.5 h-4 w-4 rounded border-[var(--mmp-color-hairline)] bg-[var(--mmp-color-surface-soft)] text-[var(--mmp-color-primary)] focus-visible:ring-2 focus-visible:ring-[var(--mmp-color-primary)] disabled:cursor-not-allowed disabled:opacity-50"
        />
        <span>
          <span className="block font-medium">{label}</span>
          {description && !error && (
            <span id={`${checkboxId}-description`} className="mt-0.5 block text-xs leading-5 text-[var(--mmp-color-steel)]">
              {description}
            </span>
          )}
        </span>
      </label>
      {error && (
        <p id={`${checkboxId}-error`} className="pl-7 text-xs leading-5 text-[var(--mmp-color-error)]">
          {error}
        </p>
      )}
    </div>
  );
}
