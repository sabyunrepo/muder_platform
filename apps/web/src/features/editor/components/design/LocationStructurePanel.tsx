import { Plus } from 'lucide-react';
import type { LocationResponse } from '@/features/editor/api';
import { buildLocationParentOptions } from '@/features/editor/entities/location/locationHierarchy';

interface LocationStructurePanelProps {
  location: LocationResponse;
  locations: LocationResponse[];
  onChangeParent: (parentLocationId: string | null) => void;
  onStartAddChild: (parentId: string) => void;
  isSaving: boolean;
}

export function LocationStructurePanel({
  location,
  locations,
  onChangeParent,
  onStartAddChild,
  isSaving,
}: LocationStructurePanelProps) {
  const options = buildLocationParentOptions(location.id, locations);
  const selectedParentId = location.parent_location_id ?? '';

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-slate-300">장소 구조</p>
        {location.parent_location_id ? (
          <button
            type="button"
            onClick={() => onChangeParent(null)}
            disabled={isSaving}
            className="rounded-md border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 transition hover:border-amber-500/50 hover:text-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            최상위로 이동
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onStartAddChild(location.id)}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 transition hover:border-amber-500/50 hover:text-amber-100"
          >
            <Plus className="h-3.5 w-3.5" />
            {location.name} 하위장소 추가
          </button>
        )}
      </div>
      <label className="text-xs text-slate-500">
        상위 장소
        <select
          aria-label={`${location.name} 상위 장소`}
          value={selectedParentId}
          onChange={(event) => onChangeParent(event.target.value || null)}
          disabled={isSaving}
          className="mt-1 h-9 w-full rounded-md border border-slate-700 bg-slate-950 px-2 text-sm text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {options.map((option) => (
            <option key={option.id ?? 'top'} value={option.id ?? ''}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </section>
  );
}
