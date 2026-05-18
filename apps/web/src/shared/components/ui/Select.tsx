import { useId, type SelectHTMLAttributes } from 'react';
import { FormField } from './FormField';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  description?: string;
  options: SelectOption[];
  placeholder?: string;
}

export function Select({
  label,
  error,
  description,
  options,
  placeholder,
  id,
  className = '',
  ...rest
}: SelectProps) {
  const generatedId = useId();
  const selectId = id ?? `select-${generatedId}`;
  const describedBy = [
    description ? `${selectId}-description` : null,
    error ? `${selectId}-error` : null,
  ].filter(Boolean).join(' ') || undefined;

  const select = (
    <select
      id={selectId}
      className={`min-h-10 w-full rounded-lg border border-[var(--mmp-color-hairline)] bg-[var(--mmp-color-surface-soft)] px-3 py-2 text-sm text-[var(--mmp-color-ink)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mmp-color-primary)] disabled:cursor-not-allowed disabled:opacity-50 ${error ? 'border-[var(--mmp-color-error)]' : ''} ${className}`}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy}
      {...rest}
    >
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options.map((option) => (
        <option key={option.value} value={option.value} disabled={option.disabled}>
          {option.label}
        </option>
      ))}
    </select>
  );

  if (!label && !description && !error) return select;

  return (
    <FormField
      label={label}
      htmlFor={selectId}
      description={description}
      descriptionId={`${selectId}-description`}
      error={error}
      errorId={`${selectId}-error`}
    >
      {select}
    </FormField>
  );
}
