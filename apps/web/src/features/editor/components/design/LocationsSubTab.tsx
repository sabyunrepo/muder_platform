import { useState } from 'react';
import { toast } from 'sonner';
import { Map, Plus, Trash2 } from 'lucide-react';
import { Spinner } from '@/shared/components/ui/Spinner';
import type { EditorThemeResponse } from '@/features/editor/api';
import {
  useEditorMaps,
  useCreateMap,
  useDeleteMap,
  useUpdateMap,
  useEditorLocations,
  useCreateLocation,
  useDeleteLocation,
} from '@/features/editor/api';
import { AddNameInput } from './AddNameInput';
import { LocationDetailPanel } from './LocationDetailPanel';
import { LocationImageMediaField } from './LocationImageMediaField';

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
  const updateMap = useUpdateMap(themeId);
  const createLocation = useCreateLocation(themeId);
  const deleteLocation = useDeleteLocation(themeId);

  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [addingMap, setAddingMap] = useState(false);
  const [addingLocation, setAddingLocation] = useState(false);

  const effectiveSelectedMapId = selectedMapId ?? maps?.[0]?.id ?? null;
  const selectedMap = maps?.find((m) => m.id === effectiveSelectedMapId) ?? null;
  const mapLocations = locations?.filter((l) => l.map_id === effectiveSelectedMapId) ?? [];
  const selectedLocation =
    mapLocations.find((l) => l.id === selectedLocationId) ?? mapLocations[0] ?? null;

  function handleAddMap(name: string) {
    createMap.mutate(
      { name },
      {
        onSuccess: (newMap) => {
          toast.success('맵이 추가되었습니다');
          setAddingMap(false);
          setSelectedMapId(newMap.id);
          setSelectedLocationId(null);
        },
        onError: () => toast.error('맵 추가에 실패했습니다'),
      }
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
    if (!effectiveSelectedMapId) return;
    createLocation.mutate(
      { mapId: effectiveSelectedMapId, body: { name } },
      {
        onSuccess: (newLocation) => {
          toast.success('장소가 추가되었습니다');
          setAddingLocation(false);
          setSelectedLocationId(newLocation.id);
        },
        onError: () => toast.error('장소 추가에 실패했습니다'),
      }
    );
  }

  function handleDeleteLocation(locationId: string) {
    deleteLocation.mutate(locationId, {
      onSuccess: () => {
        toast.success('장소가 삭제되었습니다');
        if (selectedLocationId === locationId) setSelectedLocationId(null);
      },
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
    <div className="flex h-full min-h-0 flex-col overflow-y-auto md:flex-row md:overflow-hidden">
      {/* ── Map list (full-width on mobile, 240px on md+) ── */}
      <aside className="shrink-0 border-b border-slate-800 bg-slate-950 py-2 md:min-h-0 md:w-60 md:overflow-y-auto md:border-b-0 md:border-r">
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
            const isSelected = effectiveSelectedMapId === map.id;
            return (
              <div
                key={map.id}
                className={`group flex w-full items-center gap-1 border-l-2 px-2 py-1.5 transition-colors ${
                  isSelected
                    ? 'border-amber-500 bg-slate-900 text-slate-200'
                    : 'border-transparent text-slate-500 hover:bg-slate-900/50 hover:text-slate-300'
                }`}
              >
                <button
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => {
                    setSelectedMapId(map.id);
                    setSelectedLocationId(null);
                  }}
                  className="flex min-h-8 min-w-0 flex-1 items-center gap-2 rounded-md px-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
                >
                  <Map className="h-3.5 w-3.5 shrink-0" />
                  <span className="flex-1 truncate text-xs font-medium">{map.name}</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    if (
                      window.confirm(
                        `${map.name} 맵을 삭제할까요? 하위 장소 편집 흐름도 함께 영향을 받습니다.`
                      )
                    ) {
                      handleDeleteMap(map.id);
                    }
                  }}
                  aria-label={`${map.name} 삭제`}
                  className="shrink-0 rounded-md p-2 text-slate-600 transition hover:bg-red-950/40 hover:text-red-300 md:text-slate-700 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            );
          })
        )}
      </aside>

      {/* ── Location detail ── */}
      <div className="min-h-0 flex-1 px-5 py-5 md:overflow-y-auto">
        {selectedMap ? (
          <div className="mb-4 rounded-lg border border-slate-800 bg-slate-950/70 p-4">
            <div className="mb-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-amber-300/80">
                토론방 배경
              </p>
              <h3 className="mt-1 text-base font-semibold text-slate-100">{selectedMap.name}</h3>
            </div>
            <LocationImageMediaField
              themeId={themeId}
              label="지도 이미지"
              pickerTitle="지도 이미지 선택"
              emptyLabel="미디어에서 지도 선택"
              legacyMessage="기존 지도 이미지 URL이 있습니다. 미디어 관리 이미지로 교체하면 이후 한 곳에서 관리할 수 있습니다."
              imageMediaId={selectedMap.image_media_id}
              legacyImageUrl={selectedMap.image_url}
              onSelect={(media) =>
                updateMap.mutate(
                  {
                    mapId: selectedMap.id,
                    body: {
                      name: selectedMap.name,
                      image_url: null,
                      image_media_id: media.id,
                      sort_order: selectedMap.sort_order,
                    },
                  },
                  { onError: () => toast.error('지도 이미지 저장에 실패했습니다') }
                )
              }
              onClear={() =>
                updateMap.mutate(
                  {
                    mapId: selectedMap.id,
                    body: {
                      name: selectedMap.name,
                      image_media_id: null,
                      sort_order: selectedMap.sort_order,
                    },
                  },
                  { onError: () => toast.error('지도 이미지 저장에 실패했습니다') }
                )
              }
            />
          </div>
        ) : null}
        <LocationDetailPanel
          themeId={themeId}
          theme={theme}
          selectedMap={selectedMap}
          selectedLocation={selectedLocation}
          mapLocations={mapLocations}
          addingLocation={addingLocation}
          isCreatingLocation={createLocation.isPending}
          onStartAdd={() => setAddingLocation(true)}
          onCancelAdd={() => setAddingLocation(false)}
          onAddLocation={handleAddLocation}
          onSelectLocation={setSelectedLocationId}
          onDeleteLocation={handleDeleteLocation}
        />
      </div>
    </div>
  );
}
