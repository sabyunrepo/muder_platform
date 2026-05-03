import { type ReactNode, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { clueSelectOptions, type ClueSelectOption } from './Phase24ClueEntityPreviewData';

export function SearchableCluePicker({
  label,
  placeholder,
  selectedId,
  excludeIds = [],
  lockedOnly = false,
  onSelect,
}: {
  label: string;
  placeholder: string;
  selectedId: string | null;
  excludeIds?: string[];
  lockedOnly?: boolean;
  onSelect: (option: ClueSelectOption) => void;
}) {
  const [query, setQuery] = useState('');
  const selected = clueSelectOptions.find((option) => option.id === selectedId);
  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return clueSelectOptions
      .filter((option) => !excludeIds.includes(option.id))
      .filter((option) => !lockedOnly || option.locked)
      .filter((option) => {
        if (!normalized) return true;
        return `${option.name} ${option.meta} ${option.tags.join(' ')}`.toLowerCase().includes(normalized);
      })
      .slice(0, 4);
  }, [excludeIds, lockedOnly, query]);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      {selected && (
        <div className="mt-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs">
          <p className="font-semibold text-amber-100">선택됨: {selected.name}</p>
          <p className="mt-1 text-amber-100/60">{selected.meta}</p>
        </div>
      )}
      <label className="mt-2 flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-500">
        <Search className="h-3.5 w-3.5 shrink-0" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-slate-200 outline-none placeholder:text-slate-600" placeholder={placeholder} />
      </label>
      <div className="mt-2 grid gap-2">
        {results.map((option) => (
          <button key={option.id} type="button" aria-label={`${label}: ${option.name}`} onClick={() => onSelect(option)} className="rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-left hover:border-amber-500/40">
            <span className="block text-xs font-semibold text-slate-100">{option.name}{option.locked ? ' · 잠김' : ''}</span>
            <span className="mt-0.5 block text-[11px] text-slate-500">{option.meta}</span>
          </button>
        ))}
        {results.length === 0 && <p className="rounded-xl bg-slate-900/70 px-3 py-2 text-xs text-slate-500">검색 결과가 없습니다.</p>}
      </div>
    </div>
  );
}

export function SegmentedChoice<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (value: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <div className="grid gap-2">
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(option.value)}
              className={`rounded-xl border px-3 py-2 text-left text-xs font-semibold transition ${selected ? 'border-amber-400/60 bg-amber-500/15 text-amber-100' : 'border-slate-800 bg-slate-950/70 text-slate-400 hover:border-slate-700'}`}
            >
              <span className="flex items-center justify-between gap-2">
                <span>{option.label}</span>
                {selected && <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] text-amber-100">선택됨</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ToggleCard({ checked, onChange, title, desc, compact = false }: { checked: boolean; onChange: (checked: boolean) => void; title: string; desc: string; compact?: boolean }) {
  return (
    <label className={`flex cursor-pointer gap-3 rounded-2xl border bg-slate-950/70 ${compact ? 'p-3' : 'p-4'} ${checked ? 'border-sky-400/50' : 'border-slate-800'}`}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-1 h-4 w-4 accent-sky-400" />
      <span>
        <span className="block text-sm font-semibold text-slate-100">{title}</span>
        <span className="mt-1 block text-xs leading-5 text-slate-500">{desc}</span>
      </span>
    </label>
  );
}

export function LabeledInput({ label, defaultValue, helper }: { label: string; defaultValue: string; helper?: string }) {
  return (
    <label className="text-xs font-medium text-slate-400">
      {label}
      <input defaultValue={defaultValue} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60" />
      {helper && <span className="mt-1 block text-[11px] text-slate-500">{helper}</span>}
    </label>
  );
}

export function LabeledSelect({ label, defaultValue, options }: { label: string; defaultValue: string; options: string[] }) {
  return (
    <label className="text-xs font-medium text-slate-400">
      {label}
      <select defaultValue={defaultValue} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60">
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
    </label>
  );
}

export function SectionTitle({ icon, title, desc }: { icon: ReactNode; title: string; desc: string }) {
  return (
    <div>
      <p className="flex items-center gap-2 text-sm font-semibold text-slate-100">{icon}{title}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{desc}</p>
    </div>
  );
}
