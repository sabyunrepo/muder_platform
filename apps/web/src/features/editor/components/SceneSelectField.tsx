import type { ProgressNodeRevealOption } from '@/features/editor/entities/reveal/revealTimingOptions';

interface SceneSelectFieldProps {
  label: string;
  selectedId?: string | null;
  options: ProgressNodeRevealOption[];
  onChange: (sceneId: string | null) => void;
  emptyLabel?: string;
  allowClear?: boolean;
  disabled?: boolean;
}

export function SceneSelectField({
  label,
  selectedId,
  options,
  onChange,
  emptyLabel = '장면 선택',
  allowClear = true,
  disabled = false,
}: SceneSelectFieldProps) {
  return (
    <label className="mt-3 block text-sm font-medium text-slate-300">
      {label}
      <select
        aria-label={label}
        value={selectedId ?? ''}
        disabled={disabled}
        onChange={(event) => {
          const nextValue = event.currentTarget.value;
          onChange(nextValue ? nextValue : null);
        }}
        className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950 px-2 py-1.5 text-xs text-slate-200 disabled:opacity-60"
      >
        {allowClear || options.length === 0 ? (
          <option value="">{emptyLabel}</option>
        ) : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
