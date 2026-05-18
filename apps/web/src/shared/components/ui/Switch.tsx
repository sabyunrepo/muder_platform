import { useId, type InputHTMLAttributes } from 'react';

export interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  description?: string;
}

export function Switch({ label, description, id, className = '', ...rest }: SwitchProps) {
  const generatedId = useId();
  const switchId = id ?? `switch-${generatedId}`;

  return (
    <label
      htmlFor={switchId}
      className={`flex items-center justify-between gap-4 rounded-lg border border-[var(--mmp-color-hairline)] bg-[var(--mmp-color-surface)] px-4 py-3 ${className}`}
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium text-[var(--mmp-color-charcoal)]">{label}</span>
        {description && (
          <span className="mt-0.5 block text-xs leading-5 text-[var(--mmp-color-steel)]">
            {description}
          </span>
        )}
      </span>
      <input
        {...rest}
        id={switchId}
        type="checkbox"
        role="switch"
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className="relative h-5 w-9 shrink-0 rounded-full border border-[var(--mmp-color-hairline)] bg-[var(--mmp-color-muted)] transition peer-checked:bg-[var(--mmp-color-primary)] peer-disabled:opacity-50 peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--mmp-color-primary)] peer-checked:[&>span]:translate-x-4"
      >
        <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition" />
      </span>
    </label>
  );
}
