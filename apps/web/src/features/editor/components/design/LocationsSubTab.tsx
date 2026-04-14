import { useState } from 'react';
import { toast } from 'sonner';
import { Map, MapPin, Plus, Trash2 } from 'lucide-react';
import { Spinner } from '@/shared/components/ui/Spinner';
import { Button } from '@/shared/components/ui/Button';
import type { EditorThemeResponse, MapResponse } from '@/features/editor/api';
import {
  useEditorMaps,
  useCreateMap,
  useDeleteMap,
  useEditorLocations,
  useCreateLocation,
  useDeleteLocation,
} from '@/features/editor/api';
import { AddNameInput } from './AddNameInput';
import { LocationRow } from './LocationRow';

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

export function LocationsSubTab({ themeId }: LocationsSubTabProps) {
  const { data: maps, isLoading: mapsLoading } = useEditorMaps(themeId);
  const { data: locations, isLoading: locsLoading } = useEditorLocations(themeId);
  const createMap = useCreateMap(themeId);
  const deleteMap = useDeleteMap(themeId);
  const createLocation = useCreateLocation(themeId);
  const deleteLocation = useDeleteLocation(themeId);

  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);
  const [addingMap, setAddingMap] = useState(false);
  const [addingLocation, setAddingLocation] = useState(false);

  const selectedMap = maps?.find((m) => m.id === selectedMapId) ?? null;
  const mapLocations = locations?.filter((l) => l.map_id === selectedMapId) ?? [];

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

  function handleDeleteMap(map: MapResponse) {
    deleteMap.mutate(map.id, {
      onSuccess: () => {
        toast.success('맵이 삭제되었습니다');
        if (selectedMapId === map.id) setSelectedMapId(null);
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
    <div className="flex h-full">
      {/* ── Map list (left panel 240px) ── */}
      <aside className="w-60 shrink-0 overflow-y-auto border-r border-slate-800 bg-slate-950 py-2">
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
                onClick={() => setSelectedMapId(isSelected ? null : map.id)}
                onKeyDown={(e) => e.key === 'Enter' && setSelectedMapId(isSelected ? null : map.id)}
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
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteMap(map);
                  }}
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

      {/* ── Location list (right panel) ── */}
      <div className="flex-1 overflow-y-auto px-5 py-5">
        {!selectedMap ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <MapPin className="mx-auto mb-2 h-8 w-8 text-slate-800" />
              <p className="text-xs font-mono uppercase tracking-widest text-slate-700">
                좌측에서 맵을 선택하세요
              </p>
            </div>
          </div>
        ) : (
          <div className="max-w-lg">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-mono font-semibold text-slate-300">
                {selectedMap.name}
              </h3>
              <Button size="sm" onClick={() => setAddingLocation(true)}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                장소 추가
              </Button>
            </div>

            {addingLocation && (
              <div className="mb-3 rounded-sm border border-amber-500/30 bg-slate-900 p-2">
                <AddNameInput
                  placeholder="장소 이름"
                  onAdd={handleAddLocation}
                  onCancel={() => setAddingLocation(false)}
                  isPending={createLocation.isPending}
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
                    onDelete={handleDeleteLocation}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
