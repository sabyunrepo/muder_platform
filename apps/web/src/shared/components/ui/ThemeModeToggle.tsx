import { Moon, Monitor, Sun } from 'lucide-react';
import { useAppearance, type AppearancePreference } from '@/shared/appearance';

export interface ThemeModeToggleProps {
  className?: string;
  compact?: boolean;
  ariaLabel?: string;
}

const options: Array<{
  value: AppearancePreference;
  label: string;
  icon: typeof Monitor;
}> = [
  { value: 'system', label: '시스템', icon: Monitor },
  { value: 'light', label: '라이트', icon: Sun },
  { value: 'dark', label: '다크', icon: Moon },
];

export function ThemeModeToggle({
  className = '',
  compact = false,
  ariaLabel = '화면 모드',
}: ThemeModeToggleProps) {
  const { preference, setPreference } = useAppearance();

  return (
    <div
      className={`inline-flex rounded-lg border border-[var(--mmp-color-hairline)] bg-[var(--mmp-color-surface)] p-1 ${className}`}
      role="group"
      aria-label={ariaLabel}
    >
      {options.map((option) => {
        const Icon = option.icon;
        const selected = preference === option.value;
        return (
          <button
            key={option.value}
            type="button"
            className={`inline-flex h-8 items-center justify-center rounded-md text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mmp-color-primary)] ${
              compact ? 'w-8 px-0' : 'gap-1.5 px-2.5'
            } ${
              selected
                ? 'bg-[var(--mmp-color-primary)] text-[var(--mmp-color-on-primary)]'
                : 'text-[var(--mmp-color-charcoal)] hover:bg-[var(--mmp-color-surface-soft)]'
            }`}
            aria-label={compact ? option.label : undefined}
            aria-pressed={selected}
            onClick={() => setPreference(option.value)}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {!compact && <span>{option.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
