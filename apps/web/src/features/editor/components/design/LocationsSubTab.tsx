import { useState } from 'react';
import { toast } from 'sonner';
import { Map, Plus, Trash2 } from 'lucide-react';
import { Spinner } from '@/shared/components/ui/Spinner';
import type { EditorThemeResponse } from '@/features/editor/api';
import {
  useEditorMaps,
  useCreateMap,
  useDeleteMap,
  useEditorLocations,
  useCreateLocation,
  useDeleteLocation,
} from '@/features/editor/api';
import { AddNameInput } from './AddNameInput';
import { LocationDetailPanel } from './LocationDetailPanel';
import { LocationClueAssignPanel } from './LocationClueAssignPanel';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface LocationsSubTabProps {
  themeId: string;
  theme: EditorThemeResponse;
}

// ---------------------------------------------------------------------------
// LocationsSubTab
// ---------------------------------------------------------------------------

export function LocationsSubTab({ themeId, theme }: LocationsSubTabProps) {
  const { data: maps, isLoading: mapsLoading } = useEditorMaps(themeId);
  const { data: locations, isLoading: locsLoading } = useEditorLocations(themeId);
  const createMap = useCreateMap(themeId);
  const deleteMap = useDeleteMap(themeId);
  const createLocation = useCreateLocation(themeId);
  const deleteLocation = useDeleteLocation(themeId);

  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [addingMap, setAddingMap] = useState(false);
  const [addingLocation, setAddingLocation] = useState(false);

  const selectedMap = maps?.find((m) => m.id === selectedMapId) ?? null;
  const mapLocations = locations?.filter((l) => l.map_id === selectedMapId) ?? [];
  const selectedLocation =
    mapLocations.find((l) => l.id === selectedLocationId) ?? null;

  function handleAddMap(name: string) {
    createMap.mutate(
      { name },
      {
        onSuccess: (newMap) => {
          toast.success('맵이 추가되었습니다');
          setAddingMap(false);
          setSelectedMapId(newMap.id);
        },
        onError: () => toast.error('맵 추가에 실패했습니다'),
      },
    );
  }

  function handleDeleteMap(mapId: string) {
    deleteMap.mutate(mapId, {
      onSuccess: () => {
        toast.success('맵이 삭제되었습니다');
        if (selectedMapId === mapId) {
          setSelectedMapId(null);
          setSelectedLocationId(null);
        }
      },
      onError: () => toast.error('맵 삭제에 실패했습니다'),
    });
  }

  function handleAddLocation(name: string) {
    if (!selectedMapId) return;
    createLocation.mutate(
      { mapId: selectedMapId, body: { name } },
      {
        onSuccess: () => {
          toast.success('장소가 추가되었습니다');
          setAddingLocation(false);
        },
        onError: () => toast.error('장소 추가에 실패했습니다'),
      },
    );
  }

  function handleDeleteLocation(locationId: string) {
    deleteLocation.mutate(locationId, {
      onSuccess: () => toast.success('장소가 삭제되었습니다'),
      onError: () => toast.error('장소 삭제에 실패했습니다'),
    });
  }

  if (mapsLoading || locsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col md:flex-row">
      {/* ── Map list (full-width on mobile, 240px on md+) ── */}
      <aside className="shrink-0 overflow-y-auto border-b border-slate-800 bg-slate-950 py-2 md:w-60 md:border-b-0 md:border-r">
        <div className="flex items-center justify-between px-3 pb-2">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">
            맵
          </span>
          <button
            type="button"
            onClick={() => setAddingMap(true)}
            aria-label="맵 추가"
            className="rounded-sm p-0.5 text-slate-600 hover:bg-slate-800 hover:text-amber-400 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        {addingMap && (
          <AddNameInput
            placeholder="맵 이름"
            onAdd={handleAddMap}
            onCancel={() => setAddingMap(false)}
            isPending={createMap.isPending}
          />
        )}

        {!maps || maps.length === 0 ? (
          <div className="px-3 py-4 text-center">
            <Map className="mx-auto mb-1.5 h-5 w-5 text-slate-800" />
            <p className="text-[10px] font-mono uppercase tracking-widest text-slate-700">
              맵 없음
            </p>
          </div>
        ) : (
          maps.map((map) => {
            const isSelected = selectedMapId === map.id;
            return (
              <div
                key={map.id}
                role="button"
                tabIndex={0}
                onClick={() => {
                  setSelectedMapId(isSelected ? null : map.id);
                  setSelectedLocationId(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setSelectedMapId(isSelected ? null : map.id);
                    setSelectedLocationId(null);
                  }
                }}
                className={`group flex w-full cursor-pointer items-center gap-2 border-l-2 px-3 py-1.5 text-left transition-colors ${
                  isSelected
                    ? 'border-amber-500 bg-slate-900 text-slate-200'
                    : 'border-transparent text-slate-500 hover:bg-slate-900/50 hover:text-slate-300'
                }`}
              >
                <Map className="h-3.5 w-3.5 shrink-0" />
                <span className="flex-1 truncate text-xs font-medium">{map.name}</span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleDeleteMap(map.id); }}
                  aria-label={`${map.name} 삭제`}
                  className="p-0.5 text-slate-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            );
          })
        )}
      </aside>

      {/* ── Location detail ── */}
      <div className="flex-1 overflow-y-auto px-5 py-5">
        <LocationDetailPanel
          themeId={themeId}
          selectedMap={selectedMap}
          mapLocations={mapLocations}
          addingLocation={addingLocation}
          isCreatingLocation={createLocation.isPending}
          onStartAdd={() => setAddingLocation(true)}
          onCancelAdd={() => setAddingLocation(false)}
          onAddLocation={handleAddLocation}
          onDeleteLocation={handleDeleteLocation}
        />

        {/* ── Location → Clue assignment ── */}
        {selectedMap && mapLocations.length > 0 && (
          <div className="mt-5 max-w-lg">
            <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
              <span>단서 배정 — 장소 선택</span>
            </div>
            <div className="mb-3 flex flex-wrap gap-1.5" role="listbox" aria-label="단서 배정할 장소 선택">
              {mapLocations.map((loc) => {
                const selected = selectedLocationId === loc.id;
                return (
                  <button
                    type="button"
                    key={loc.id}
                    role="option"
                    aria-selected={selected}
                    onClick={() =>
                      setSelectedLocationId(selected ? null : loc.id)
                    }
                    className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs transition-colors ${
                      selected
                        ? 'border-amber-500/50 bg-amber-500/10 text-amber-300'
                        : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    {loc.name}
                  </button>
                );
              })}
            </div>
            {selectedLocation && (
              <LocationClueAssignPanel
                themeId={themeId}
                theme={theme}
                location={selectedLocation}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
