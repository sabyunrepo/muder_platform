import { MapPin, Trash2 } from 'lucide-react';
import type { LocationResponse } from '@/features/editor/api';

// ---------------------------------------------------------------------------
// LocationRow — single location row with delete button
// ---------------------------------------------------------------------------

interface LocationRowProps {
  location: LocationResponse;
  onDelete: (id: string) => void;
}

export function LocationRow({ location, onDelete }: LocationRowProps) {
  return (
    <div className="group flex items-start gap-2 rounded-sm border border-slate-800 bg-slate-900 px-3 py-2 hover:border-slate-700">
      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-600" />
      <div className="flex-1 min-w-0">
        <span className="text-xs font-medium text-slate-300">{location.name}</span>
      </div>
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
