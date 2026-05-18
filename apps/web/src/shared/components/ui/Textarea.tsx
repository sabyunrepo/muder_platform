import { useId, type TextareaHTMLAttributes } from 'react';
import { FormField } from './FormField';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  description?: string;
}

export function Textarea({
  label,
  error,
  description,
  id,
  className = '',
  ...rest
}: TextareaProps) {
  const generatedId = useId();
  const textareaId = id ?? `textarea-${generatedId}`;
  const describedBy = [
    description ? `${textareaId}-description` : null,
    error ? `${textareaId}-error` : null,
  ].filter(Boolean).join(' ') || undefined;

  const textarea = (
    <textarea
      id={textareaId}
      className={`min-h-24 w-full rounded-lg border border-[var(--mmp-color-hairline)] bg-[var(--mmp-color-surface-soft)] px-3 py-2 text-sm text-[var(--mmp-color-ink)] placeholder:text-[var(--mmp-color-muted)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mmp-color-primary)] disabled:cursor-not-allowed disabled:opacity-50 ${error ? 'border-[var(--mmp-color-error)]' : ''} ${className}`}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy}
      {...rest}
    />
  );

  if (!label && !description && !error) return textarea;

  return (
    <FormField
      label={label}
      htmlFor={textareaId}
      description={description}
      descriptionId={`${textareaId}-description`}
      error={error}
      errorId={`${textareaId}-error`}
    >
      {textarea}
    </FormField>
  );
}
