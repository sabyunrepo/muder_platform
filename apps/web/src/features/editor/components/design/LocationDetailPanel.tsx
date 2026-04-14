import { Plus } from 'lucide-react';
import { MapPin } from 'lucide-react';
import { Button } from '@/shared/components/ui/Button';
import type { MapResponse, LocationResponse } from '@/features/editor/api';
import { AddNameInput } from './AddNameInput';
import { LocationRow } from './LocationRow';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface LocationDetailPanelProps {
  selectedMap: MapResponse | null;
  mapLocations: LocationResponse[];
  addingLocation: boolean;
  isCreatingLocation: boolean;
  onStartAdd: () => void;
  onCancelAdd: () => void;
  onAddLocation: (name: string) => void;
  onDeleteLocation: (locationId: string) => void;
}

// ---------------------------------------------------------------------------
// LocationDetailPanel
// ---------------------------------------------------------------------------

export function LocationDetailPanel({
  selectedMap,
  mapLocations,
  addingLocation,
  isCreatingLocation,
  onStartAdd,
  onCancelAdd,
  onAddLocation,
  onDeleteLocation,
}: LocationDetailPanelProps) {
  if (!selectedMap) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <MapPin className="mx-auto mb-2 h-8 w-8 text-slate-800" />
          <p className="text-xs font-mono uppercase tracking-widest text-slate-700">
            좌측에서 맵을 선택하세요
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-mono font-semibold text-slate-300">
          {selectedMap.name}
        </h3>
        <Button size="sm" onClick={onStartAdd}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          장소 추가
        </Button>
      </div>

      {addingLocation && (
        <div className="mb-3 rounded-sm border border-amber-500/30 bg-slate-900 p-2">
          <AddNameInput
            placeholder="장소 이름"
            onAdd={onAddLocation}
            onCancel={onCancelAdd}
            isPending={isCreatingLocation}
          />
        </div>
      )}

      {mapLocations.length === 0 ? (
        <div className="rounded-sm border border-dashed border-slate-800 py-10 text-center">
          <MapPin className="mx-auto mb-2 h-5 w-5 text-slate-800" />
          <p className="text-[10px] font-mono uppercase tracking-widest text-slate-700">
            장소 없음
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {mapLocations.map((loc) => (
            <LocationRow
              key={loc.id}
              location={loc}
              onDelete={onDeleteLocation}
            />
          ))}
        </div>
      )}
    </div>
  );
}
