import { MapPin, Trash2 } from 'lucide-react';
import type { LocationResponse } from '@/features/editor/api';
import { formatLocationRoundLabel } from '@/features/editor/entities/location/locationEntityAdapter';

// ---------------------------------------------------------------------------
// LocationRow — name + inline round schedule editor + delete.
// Round inputs commit on blur (and on Enter) via useUpdateLocation. Local
// state mirrors the server value so optimistic re-rendering is avoided —
// react-query invalidation handles the refresh.
// ---------------------------------------------------------------------------

interface LocationRowProps {
  themeId: string;
  location: LocationResponse;
  onDelete: (id: string) => void;
}

export function LocationRow({ themeId, location, onDelete }: LocationRowProps) {
  void themeId;

  return (
    <div className="group flex items-center gap-2 rounded-sm border border-slate-800 bg-slate-900 px-3 py-2 hover:border-slate-700">
      <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-600" />
      <span className="flex-1 truncate text-xs font-medium text-slate-300">
        {location.name}
      </span>
      <span className="shrink-0 text-[10px] text-slate-500">{formatLocationRoundLabel(location)}</span>
      <button
        type="button"
        onClick={() => onDelete(location.id)}
        aria-label={`${location.name} 삭제`}
        className="p-0.5 text-slate-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all shrink-0"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}
