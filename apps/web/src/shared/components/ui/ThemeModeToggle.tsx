import { Moon, Monitor, Sun } from 'lucide-react';
import { useAppearance, type AppearancePreference } from '@/shared/appearance';

export interface ThemeModeToggleProps {
  className?: string;
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

export function ThemeModeToggle({ className = '' }: ThemeModeToggleProps) {
  const { preference, setPreference } = useAppearance();

  return (
    <div
      className={`inline-flex rounded-lg border border-[var(--mmp-color-hairline)] bg-[var(--mmp-color-surface)] p-1 ${className}`}
      role="group"
      aria-label="화면 모드"
    >
      {options.map((option) => {
        const Icon = option.icon;
        const selected = preference === option.value;
        return (
          <button
            key={option.value}
            type="button"
            className={`inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mmp-color-primary)] ${
              selected
                ? 'bg-[var(--mmp-color-primary)] text-[var(--mmp-color-on-primary)]'
                : 'text-[var(--mmp-color-charcoal)] hover:bg-[var(--mmp-color-surface-soft)]'
            }`}
            aria-pressed={selected}
            onClick={() => setPreference(option.value)}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
