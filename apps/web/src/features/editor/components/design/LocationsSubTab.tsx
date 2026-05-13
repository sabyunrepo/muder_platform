import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Map, Plus, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '@/shared/components/ui';
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
import { useFlowGraph } from '@/features/editor/flowApi';
import { buildProgressNodeRevealOptions } from '@/features/editor/entities/reveal/revealTimingOptions';
import { AddNameInput } from './AddNameInput';
import { LocationDetailPanel } from './LocationDetailPanel';

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
  const { data: flowGraph } = useFlowGraph(themeId);
  const createMap = useCreateMap(themeId);
  const deleteMap = useDeleteMap(themeId);
  const createLocation = useCreateLocation(themeId);
  const deleteLocation = useDeleteLocation(themeId);

  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [addingMap, setAddingMap] = useState(false);
  const [addingLocation, setAddingLocation] = useState(false);
  const [pendingDeleteMapId, setPendingDeleteMapId] = useState<string | null>(null);

  const effectiveSelectedMapId = selectedMapId ?? maps?.[0]?.id ?? null;
  const selectedMap = maps?.find((m) => m.id === effectiveSelectedMapId) ?? null;
  const pendingDeleteMap = maps?.find((m) => m.id === pendingDeleteMapId) ?? null;
  const mapLocations = locations?.filter((l) => l.map_id === effectiveSelectedMapId) ?? [];
  const selectedLocation =
    mapLocations.find((l) => l.id === selectedLocationId) ?? mapLocations[0] ?? null;
  const sceneOptions = useMemo(
    () =>
      buildProgressNodeRevealOptions(
        flowGraph?.nodes,
        locations?.flatMap((location) => [
          location.appearance_scene_id ?? null,
          location.hide_scene_id ?? null,
        ]) ?? []
      ),
    [flowGraph?.nodes, locations]
  );
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
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-slate-950/40">
      <div className="border-b border-slate-800 bg-slate-950/80 px-5 py-3">
        <LocationMapToolbar
          maps={maps ?? []}
          selectedMap={selectedMap}
          effectiveSelectedMapId={effectiveSelectedMapId}
          addingMap={addingMap}
          isCreatingMap={createMap.isPending}
          isDeletingMap={deleteMap.isPending}
          onSelectMap={(mapId) => {
            setSelectedMapId(mapId);
            setSelectedLocationId(null);
          }}
          onStartAddMap={() => setAddingMap(true)}
          onCancelAddMap={() => setAddingMap(false)}
          onAddMap={handleAddMap}
          onDeleteSelectedMap={() => {
            if (!selectedMap) return;
            setPendingDeleteMapId(selectedMap.id);
          }}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-hidden px-5 py-5">
        <LocationDetailPanel
          themeId={themeId}
          theme={theme}
          selectedMap={selectedMap}
          selectedLocation={selectedLocation}
          mapLocations={mapLocations}
          sceneOptions={sceneOptions}
          addingLocation={addingLocation}
          isCreatingLocation={createLocation.isPending}
          onStartAdd={() => setAddingLocation(true)}
          onCancelAdd={() => setAddingLocation(false)}
          onAddLocation={handleAddLocation}
          onSelectLocation={setSelectedLocationId}
          onDeleteLocation={handleDeleteLocation}
        />
      </div>
      <ConfirmDialog
        isOpen={pendingDeleteMap != null}
        title="맵을 삭제할까요?"
        description={`${pendingDeleteMap?.name ?? '선택한 맵'} 맵과 하위 장소 편집 흐름도 함께 영향을 받습니다.`}
        confirmLabel="맵 삭제"
        isConfirming={deleteMap.isPending}
        tone="danger"
        onCancel={() => setPendingDeleteMapId(null)}
        onConfirm={() => {
          if (!pendingDeleteMap) return;
          handleDeleteMap(pendingDeleteMap.id);
          setPendingDeleteMapId(null);
        }}
      />
    </div>
  );
}

function LocationMapToolbar({
  maps,
  selectedMap,
  effectiveSelectedMapId,
  addingMap,
  isCreatingMap,
  isDeletingMap,
  onSelectMap,
  onStartAddMap,
  onCancelAddMap,
  onAddMap,
  onDeleteSelectedMap,
}: {
  maps: NonNullable<ReturnType<typeof useEditorMaps>['data']>;
  selectedMap: NonNullable<ReturnType<typeof useEditorMaps>['data']>[number] | null;
  effectiveSelectedMapId: string | null;
  addingMap: boolean;
  isCreatingMap: boolean;
  isDeletingMap: boolean;
  onSelectMap: (mapId: string) => void;
  onStartAddMap: () => void;
  onCancelAddMap: () => void;
  onAddMap: (name: string) => void;
  onDeleteSelectedMap: () => void;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
          <Map className="h-3.5 w-3.5 text-amber-400" />
          맵
        </div>
        {maps.length > 0 ? (
          <select
            aria-label="맵 선택"
            value={effectiveSelectedMapId ?? ''}
            onChange={(event) => onSelectMap(event.target.value)}
            className="h-9 min-w-0 rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 sm:w-64"
          >
            {maps.map((map) => (
              <option key={map.id} value={map.id}>
                {map.name}
              </option>
            ))}
          </select>
        ) : (
          <span className="rounded-md border border-dashed border-slate-700 px-3 py-2 text-xs text-slate-500">
            맵 없음
          </span>
        )}
      </div>

      {addingMap ? (
        <div className="min-w-0 sm:w-72">
          <AddNameInput
            placeholder="맵 이름"
            onAdd={onAddMap}
            onCancel={onCancelAddMap}
            isPending={isCreatingMap}
          />
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onStartAddMap}
            aria-label="맵 추가"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-700 px-3 text-xs font-medium text-slate-300 transition hover:border-amber-500/50 hover:text-amber-100"
          >
            <Plus className="h-3.5 w-3.5" />
            맵 추가
          </button>
          <button
            type="button"
            onClick={onDeleteSelectedMap}
            disabled={!selectedMap || isDeletingMap}
            aria-label={selectedMap ? `${selectedMap.name} 삭제` : '맵 삭제'}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-800 px-3 text-xs font-medium text-slate-500 transition hover:border-red-500/40 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5" />
            삭제
          </button>
        </div>
      )}
    </section>
  );
}
