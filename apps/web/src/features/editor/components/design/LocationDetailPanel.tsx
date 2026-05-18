import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { GripVertical, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import type { EditorThemeResponse, MapResponse, LocationResponse } from '@/features/editor/api';
import { useEditorClues, useUpdateConfigJson, useUpdateLocation } from '@/features/editor/api';
import { SceneSelectField } from '@/features/editor/components/SceneSelectField';
import {
  type LocationDiscoveryConfig,
  readLocationClueIds,
  readLocationDiscoveries,
  readLocationInvestigationSettings,
  writeLocationDiscoveries,
} from '@/features/editor/editorTypes';
import type { ProgressNodeRevealOption } from '@/features/editor/entities/reveal/revealTimingOptions';
import { toLocationEditorViewModel } from '@/features/editor/entities/location/locationEntityAdapter';
import { readLocationMeta } from '@/features/editor/utils/entityMeta';
import { AddNameInput } from './AddNameInput';
import { ConfirmDialog } from '@/shared/components/ui';
import { LocationAccessPolicyPanel } from './LocationAccessPolicyPanel';
import { LocationClueAssignPanel } from './LocationClueAssignPanel';
import { LocationHierarchyList } from './LocationHierarchyList';
import { LocationImageMediaField } from './LocationImageMediaField';
import { LocationStructurePanel } from './LocationStructurePanel';
import { useEditorAutosaveToast } from '@/features/editor/hooks/useEditorAutosaveToast';
import { showUnknownErrorToast } from '@/lib/show-error-toast';

interface LocationDetailPanelProps {
  themeId: string;
  theme: EditorThemeResponse;
  selectedMap: MapResponse | null;
  selectedLocation: LocationResponse | null;
  mapLocations: LocationResponse[];
  sceneOptions?: ProgressNodeRevealOption[];
  addingLocationParentId: string | null | 'top';
  isCreatingLocation: boolean;
  onStartAddTopLevel: () => void;
  onStartAddChild: (parentId: string) => void;
  onCancelAdd: () => void;
  onAddLocation: (name: string, parentLocationId?: string | null) => void;
  onSelectLocation: (locationId: string) => void;
  onDeleteLocation: (locationId: string) => void;
}

interface LocationBasicDraft {
  name: string;
  publicDescription: string;
  entryMessage: string;
}

export function LocationDetailPanel({
  themeId,
  theme,
  selectedMap,
  selectedLocation,
  mapLocations,
  sceneOptions = [],
  addingLocationParentId,
  isCreatingLocation,
  onStartAddTopLevel,
  onStartAddChild,
  onCancelAdd,
  onAddLocation,
  onSelectLocation,
  onDeleteLocation,
}: LocationDetailPanelProps) {
  const [pendingDeleteLocation, setPendingDeleteLocation] = useState<LocationResponse | null>(null);
  const updateLocation = useUpdateLocation(themeId);

  if (!selectedMap) return <LocationEmptyState message="좌측에서 맵을 선택하세요" />;

  function renderAddInput(parentId: string | null | 'top') {
    if (addingLocationParentId !== parentId) return null;
    const parentLocationId = parentId === 'top' ? null : parentId;
    return (
      <div className="mb-3 rounded-md border border-amber-500/30 bg-slate-900 p-2">
        <AddNameInput
          placeholder={parentLocationId ? '하위장소 이름' : '장소 이름'}
          onAdd={(name) => onAddLocation(name, parentLocationId)}
          onCancel={onCancelAdd}
          isPending={isCreatingLocation}
        />
      </div>
    );
  }

  function moveLocation(locationId: string, parentLocationId: string | null, sortOrder: number) {
    const target = mapLocations.find((candidate) => candidate.id === locationId);
    if (!target) return;
    updateLocation.mutate(
      {
        locationId,
        body: {
          name: target.name,
          restricted_characters: target.restricted_characters,
          image_url: target.image_url,
          public_description: target.public_description ?? null,
          entry_message: target.entry_message ?? null,
          parent_location_id: parentLocationId,
          sort_order: sortOrder,
          appearance_scene_id: target.appearance_scene_id ?? null,
          hide_scene_id: target.hide_scene_id ?? null,
          ...(target.image_media_id !== undefined
            ? { image_media_id: target.image_media_id ?? null }
            : {}),
        },
      },
      {
        onSuccess: () => toast.success('장소 위치가 저장되었습니다'),
        onError: (error) => showUnknownErrorToast(error, '장소 위치 저장에 실패했습니다'),
      }
    );
  }

  return (
    <>
      <div className="grid min-h-0 gap-4 pb-4 md:h-full md:grid-cols-[minmax(16rem,0.34fr)_minmax(0,1fr)] md:overflow-hidden md:pb-0 lg:grid-cols-[minmax(16rem,0.32fr)_minmax(0,1fr)]">
        <LocationHierarchyList
          locations={mapLocations}
          theme={theme}
          selectedId={selectedLocation?.id}
          onSelect={onSelectLocation}
          onDelete={setPendingDeleteLocation}
          onStartAddTopLevel={onStartAddTopLevel}
          onStartAddChild={onStartAddChild}
          renderAddTopLevelInput={() => renderAddInput('top')}
          renderAddChildInput={(parentId) => renderAddInput(parentId)}
          onMoveLocation={moveLocation}
        />
        <div className="min-w-0 md:min-h-0 md:overflow-y-auto">
          {selectedLocation ? (
            <SelectedLocationDetail
              themeId={themeId}
              theme={theme}
              map={selectedMap}
              location={selectedLocation}
              mapLocations={mapLocations}
              sceneOptions={sceneOptions}
              onStartAddChild={onStartAddChild}
            />
          ) : (
            <LocationEmptyState message="장소를 선택하세요" compact />
          )}
        </div>
      </div>
      <ConfirmDialog
        isOpen={pendingDeleteLocation != null}
        title="장소를 삭제할까요?"
        description={`${pendingDeleteLocation?.name ?? '선택한 장소'} 장소를 삭제합니다.`}
        confirmLabel="장소 삭제"
        tone="danger"
        onCancel={() => setPendingDeleteLocation(null)}
        onConfirm={() => {
          if (!pendingDeleteLocation) return;
          onDeleteLocation(pendingDeleteLocation.id);
          setPendingDeleteLocation(null);
        }}
      />
    </>
  );
}
function SelectedLocationDetail({
  themeId,
  theme,
  map,
  location,
  mapLocations,
  sceneOptions,
  onStartAddChild,
}: {
  themeId: string;
  theme: EditorThemeResponse;
  map: MapResponse;
  location: LocationResponse;
  mapLocations: LocationResponse[];
  sceneOptions: ProgressNodeRevealOption[];
  onStartAddChild: (parentId: string) => void;
}) {
  const updateLocation = useUpdateLocation(themeId);
  const updateConfig = useUpdateConfigJson(themeId);
  const { data: clues } = useEditorClues(themeId);
  const [appearanceSceneId, setAppearanceSceneId] = useState(location.appearance_scene_id ?? null);
  const [hideSceneId, setHideSceneId] = useState(location.hide_scene_id ?? null);
  const skipNextBasicAutosaveRef = useRef(true);
  const locationMeta = useMemo(
    () => readLocationMeta(theme.config_json, location.id),
    [theme.config_json, location.id]
  );
  const [basicDraft, setBasicDraft] = useState({
    name: location.name,
    publicDescription: location.public_description ?? locationMeta.publicDescription ?? '',
    entryMessage: location.entry_message ?? locationMeta.entryMessage ?? '',
  });
  const assignedCount = useMemo(
    () => readLocationClueIds(theme.config_json, location.id).length,
    [theme.config_json, location.id]
  );
  const discoveries = useMemo(
    () => readLocationDiscoveries(theme.config_json, location.id),
    [theme.config_json, location.id]
  );
  const investigationSettings = useMemo(
    () => readLocationInvestigationSettings(theme.config_json),
    [theme.config_json]
  );
  const clueNameById = useMemo(
    () => new Map((clues ?? []).map((clue) => [clue.id, clue.name])),
    [clues]
  );
  const viewModel = toLocationEditorViewModel(location, {
    clueCount: assignedCount,
    mapName: map.name,
    locationMeta,
    allLocations: mapLocations,
  });

  function saveLocation(
    patch: Partial<LocationResponse>,
    options: {
      onSuccess?: () => void;
      onError?: (error?: unknown) => void;
      onErrorMessage?: string;
      suppressErrorToast?: boolean;
    } = {}
  ) {
    const nextAppearanceSceneId =
      patch.appearance_scene_id !== undefined
        ? (patch.appearance_scene_id ?? null)
        : (appearanceSceneId ?? location.appearance_scene_id ?? null);
    const nextHideSceneId =
      patch.hide_scene_id !== undefined
        ? (patch.hide_scene_id ?? null)
        : (hideSceneId ?? location.hide_scene_id ?? null);
    const nextImageUrl = Object.prototype.hasOwnProperty.call(patch, 'image_url')
      ? (patch.image_url ?? null)
      : location.image_url;
    const hasImageMediaPatch = Object.prototype.hasOwnProperty.call(patch, 'image_media_id');
    const body = {
      name: patch.name ?? location.name,
      restricted_characters: patch.restricted_characters ?? location.restricted_characters,
      image_url: nextImageUrl,
      public_description: patch.public_description ?? location.public_description ?? null,
      entry_message: patch.entry_message ?? location.entry_message ?? null,
      parent_location_id:
        patch.parent_location_id !== undefined
          ? patch.parent_location_id
          : (location.parent_location_id ?? null),
      sort_order: patch.sort_order ?? location.sort_order,
      appearance_scene_id: nextAppearanceSceneId,
      hide_scene_id: nextHideSceneId,
      ...(hasImageMediaPatch ? { image_media_id: patch.image_media_id ?? null } : {}),
    };
    updateLocation.mutate(
      {
        locationId: location.id,
        body,
      },
      {
        onSuccess: options.onSuccess,
        onError: (error) => {
          options.onError?.(error);
          if (!options.suppressErrorToast) {
            showUnknownErrorToast(error, options.onErrorMessage ?? '장소 저장에 실패했습니다');
          }
        },
      }
    );
  }

  const { schedule: scheduleBasicInfoSave, cancel: cancelBasicInfoSave } = useEditorAutosaveToast<
    Partial<LocationResponse>
  >({
    debounceMs: 1000,
    messages: {
      toastId: `location-basic-autosave-${location.id}`,
      loading: '장소 기본 정보를 저장 중입니다',
      success: '장소 기본 정보가 저장되었습니다',
      error: '장소 기본 정보 저장에 실패했습니다',
    },
    mutate: (body, opts) =>
      saveLocation(body, {
        onSuccess: opts.onSuccess,
        onError: opts.onError,
        suppressErrorToast: true,
      }),
  });

  useEffect(() => {
    cancelBasicInfoSave();
    skipNextBasicAutosaveRef.current = true;
    setAppearanceSceneId(location.appearance_scene_id ?? null);
    setHideSceneId(location.hide_scene_id ?? null);
    setBasicDraft({
      name: location.name,
      publicDescription: location.public_description ?? locationMeta.publicDescription ?? '',
      entryMessage: location.entry_message ?? locationMeta.entryMessage ?? '',
    });
  }, [
    location.id,
    location.name,
    location.appearance_scene_id,
    location.hide_scene_id,
    location.public_description,
    location.entry_message,
    locationMeta,
    cancelBasicInfoSave,
  ]);

  const isBasicInfoDirty = useMemo(() => {
    const currentPublicDescription =
      location.public_description ?? locationMeta.publicDescription ?? '';
    const currentEntryMessage = location.entry_message ?? locationMeta.entryMessage ?? '';
    return (
      basicDraft.name !== location.name ||
      basicDraft.publicDescription !== currentPublicDescription ||
      basicDraft.entryMessage !== currentEntryMessage
    );
  }, [
    basicDraft.entryMessage,
    basicDraft.name,
    basicDraft.publicDescription,
    location.entry_message,
    location.name,
    location.public_description,
    locationMeta.entryMessage,
    locationMeta.publicDescription,
  ]);

  useEffect(() => {
    if (skipNextBasicAutosaveRef.current) {
      skipNextBasicAutosaveRef.current = false;
      return;
    }
    if (!isBasicInfoDirty) return;
    const nextName = basicDraft.name.trim();
    if (!nextName) return;
    scheduleBasicInfoSave({
      name: nextName,
      public_description: basicDraft.publicDescription.trim() || null,
      entry_message: basicDraft.entryMessage.trim() || null,
    });
  }, [
    basicDraft.entryMessage,
    basicDraft.name,
    basicDraft.publicDescription,
    isBasicInfoDirty,
    scheduleBasicInfoSave,
  ]);

  function saveDiscoveryOrder(nextDiscoveries: LocationDiscoveryConfig[]) {
    const nextConfig = writeLocationDiscoveries(
      theme.config_json,
      location.id,
      nextDiscoveries.map((discovery, index) => ({ ...discovery, order: index }))
    );
    updateConfig.mutate(nextConfig, {
      onSuccess: () => toast.success('장소 단서 순서가 저장되었습니다'),
      onError: (error) => showUnknownErrorToast(error, '장소 단서 순서 저장에 실패했습니다'),
    });
  }

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-amber-300/80">
              장소 상세
            </p>
            <h3 className="mt-1 text-xl font-semibold text-slate-100">{viewModel.name}</h3>
            <p className="mt-1 text-xs text-slate-500">소속 맵: {map.name}</p>
            <p className="mt-1 text-xs text-slate-400">{viewModel.roundLabel}</p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-xs text-slate-400">
            {viewModel.clueShortLabel}
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(12rem,0.42fr)_minmax(0,1fr)]">
          <LocationImageMediaField
            themeId={themeId}
            imageMediaId={location.image_media_id}
            legacyImageUrl={viewModel.imageUrl}
            onSelect={(media) => saveLocation({ image_media_id: media.id, image_url: null })}
            onClear={() => saveLocation({ image_media_id: null })}
          />
          <div className="space-y-3">
            <LocationBasicInfoFields
              locationName={location.name}
              draft={basicDraft}
              onDraftChange={setBasicDraft}
            />
            <SceneVisibilityFields
              location={location}
              sceneOptions={sceneOptions}
              appearanceSceneId={appearanceSceneId}
              hideSceneId={hideSceneId}
              setAppearanceSceneId={setAppearanceSceneId}
              setHideSceneId={setHideSceneId}
              onCommit={saveLocation}
            />
            <LocationStructurePanel
              location={location}
              locations={mapLocations}
              isSaving={updateLocation.isPending}
              onStartAddChild={onStartAddChild}
              onChangeParent={(parentLocationId) =>
                saveLocation(
                  { parent_location_id: parentLocationId },
                  {
                    onSuccess: () => toast.success('장소 구조가 저장되었습니다'),
                    onErrorMessage: '장소 구조 저장에 실패했습니다',
                  }
                )
              }
            />
            <LocationInvestigationStructurePanel
              location={location}
              settings={investigationSettings}
              discoveries={discoveries}
              clueNameById={clueNameById}
              isSaving={updateConfig.isPending}
              onReorder={saveDiscoveryOrder}
            />
            <LocationValidationPanel
              location={location}
              settings={investigationSettings}
              discoveries={discoveries}
            />
          </div>
        </div>
      </section>
      <LocationAccessPolicyPanel themeId={themeId} location={location} />
      <LocationClueAssignPanel
        themeId={themeId}
        theme={theme}
        location={location}
        allLocations={mapLocations}
        allClues={clues}
      />
    </div>
  );
}

function LocationBasicInfoFields({
  locationName,
  draft,
  onDraftChange,
}: {
  locationName: string;
  draft: LocationBasicDraft;
  onDraftChange: Dispatch<SetStateAction<LocationBasicDraft>>;
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-slate-300">기본 정보</p>
      </div>
      <div className="mt-3 grid gap-3">
        <label className="text-xs text-slate-500">
          장소 이름
          <input
            type="text"
            aria-label={`${locationName} 장소 이름`}
            value={draft.name}
            onChange={(event) =>
              onDraftChange((current) => ({ ...current, name: event.target.value }))
            }
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
          />
        </label>
        <label className="text-xs text-slate-500">
          공개 설명
          <textarea
            aria-label={`${locationName} 공개 설명`}
            value={draft.publicDescription}
            onChange={(event) =>
              onDraftChange((current) => ({
                ...current,
                publicDescription: event.target.value,
              }))
            }
            rows={3}
            className="mt-1 w-full resize-none rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-sm leading-5 text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
            placeholder="플레이어에게 항상 보이는 장소 설명"
          />
        </label>
        <label className="text-xs text-slate-500">
          진입 메시지
          <textarea
            aria-label={`${locationName} 진입 메시지`}
            value={draft.entryMessage}
            onChange={(event) =>
              onDraftChange((current) => ({ ...current, entryMessage: event.target.value }))
            }
            rows={3}
            className="mt-1 w-full resize-none rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-sm leading-5 text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
            placeholder="플레이어가 이 장소에 들어왔을 때 보여줄 분위기 텍스트"
          />
        </label>
      </div>
    </div>
  );
}

function SceneVisibilityFields({
  location,
  sceneOptions,
  appearanceSceneId,
  hideSceneId,
  setAppearanceSceneId,
  setHideSceneId,
  onCommit,
}: {
  location: LocationResponse;
  sceneOptions: ProgressNodeRevealOption[];
  appearanceSceneId: string | null;
  hideSceneId: string | null;
  setAppearanceSceneId: (value: string | null) => void;
  setHideSceneId: (value: string | null) => void;
  onCommit: (patch: Partial<LocationResponse>) => void;
}) {
  const sceneDraftRef = useRef({ appearanceSceneId, hideSceneId });

  useEffect(() => {
    sceneDraftRef.current = { appearanceSceneId, hideSceneId };
  }, [appearanceSceneId, hideSceneId]);

  function changeAppearance(sceneId: string | null) {
    setAppearanceSceneId(sceneId);
    sceneDraftRef.current = { ...sceneDraftRef.current, appearanceSceneId: sceneId };
    onCommit({
      appearance_scene_id: sceneDraftRef.current.appearanceSceneId,
      hide_scene_id: sceneDraftRef.current.hideSceneId,
    });
  }

  function changeHide(sceneId: string | null) {
    setHideSceneId(sceneId);
    sceneDraftRef.current = { ...sceneDraftRef.current, hideSceneId: sceneId };
    onCommit({
      appearance_scene_id: sceneDraftRef.current.appearanceSceneId,
      hide_scene_id: sceneDraftRef.current.hideSceneId,
    });
  }

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
      <p className="mb-2 text-xs font-semibold text-slate-300">공개 장면</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <SceneSelectField
          label={`${location.name} 출현 장면`}
          selectedId={appearanceSceneId}
          options={sceneOptions}
          onChange={changeAppearance}
          emptyLabel="처음부터 공개"
        />
        <SceneSelectField
          label={`${location.name} 숨김 장면`}
          selectedId={hideSceneId}
          options={sceneOptions}
          onChange={changeHide}
          emptyLabel="마지막 장면까지"
        />
      </div>
    </div>
  );
}

function LocationInvestigationStructurePanel({
  location,
  settings,
  discoveries,
  clueNameById,
  isSaving,
  onReorder,
}: {
  location: LocationResponse;
  settings: ReturnType<typeof readLocationInvestigationSettings>;
  discoveries: ReturnType<typeof readLocationDiscoveries>;
  clueNameById: Map<string, string>;
  isSaving: boolean;
  onReorder: (discoveries: LocationDiscoveryConfig[]) => void;
}) {
  const [draggingClueId, setDraggingClueId] = useState<string | null>(null);
  const sortedDiscoveries = discoveries
    .map((discovery, index) => ({ discovery, index }))
    .sort((a, b) => {
      const left = typeof a.discovery.order === 'number' ? a.discovery.order : 9999;
      const right = typeof b.discovery.order === 'number' ? b.discovery.order : 9999;
      return left === right ? a.index - b.index : left - right;
    })
    .map(({ discovery }) => discovery);

  function moveDiscovery(sourceClueId: string, targetClueId: string) {
    if (sourceClueId === targetClueId || isSaving) return;
    const sourceIndex = sortedDiscoveries.findIndex(
      (discovery) => discovery.clueId === sourceClueId
    );
    const targetIndex = sortedDiscoveries.findIndex(
      (discovery) => discovery.clueId === targetClueId
    );
    if (sourceIndex < 0 || targetIndex < 0) return;
    const next = [...sortedDiscoveries];
    const [moved] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, moved);
    onReorder(next);
  }

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
      <div className="mb-3">
        <p className="text-xs font-semibold text-slate-200">
          {settings.investigationMode === 'list' ? '장소 단서 목록' : '장소 덱 단서'}
        </p>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          {settings.investigationMode === 'list'
            ? `${location.name}에 배치한 단서를 플레이어가 목록에서 확인하고 획득하는 방식입니다.`
            : `${location.name}에 추가한 단서를 ${
                settings.deckOrder === 'random' ? '랜덤' : '설정 순서'
              }으로 한 장씩 획득하는 방식입니다.`}
        </p>
      </div>
      {sortedDiscoveries.length > 0 ? (
        <ol className="space-y-2">
          {sortedDiscoveries.map((discovery, index) => (
            <li
              key={`${discovery.locationId}:${discovery.clueId}`}
              draggable={!isSaving}
              onDragStart={(event) => {
                setDraggingClueId(discovery.clueId);
                const dataTransfer = event.dataTransfer as DataTransfer | undefined;
                if (dataTransfer) {
                  dataTransfer.effectAllowed = 'move';
                  dataTransfer.setData('text/plain', discovery.clueId);
                }
              }}
              onDragEnter={(event) => {
                event.preventDefault();
              }}
              onDragOver={(event) => {
                event.preventDefault();
                const dataTransfer = event.dataTransfer as DataTransfer | undefined;
                if (dataTransfer) dataTransfer.dropEffect = 'move';
              }}
              onDrop={(event) => {
                event.preventDefault();
                const sourceClueId =
                  draggingClueId ||
                  (event.dataTransfer as DataTransfer | undefined)?.getData('text/plain');
                setDraggingClueId(null);
                if (sourceClueId) moveDiscovery(sourceClueId, discovery.clueId);
              }}
              onDragEnd={() => setDraggingClueId(null)}
              aria-label={`${clueNameById.get(discovery.clueId) ?? '알 수 없는 단서'} 순서 이동`}
              className={`flex items-center gap-3 rounded-md border px-3 py-2 transition ${
                draggingClueId === discovery.clueId
                  ? 'border-amber-400/50 bg-amber-500/10 opacity-70'
                  : 'border-slate-800 bg-slate-950'
              } ${isSaving ? 'cursor-wait opacity-60' : 'cursor-grab active:cursor-grabbing'}`}
            >
              <GripVertical className="h-4 w-4 shrink-0 text-slate-600" aria-hidden="true" />
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-amber-500/40 bg-amber-500/10 text-xs font-semibold text-amber-200">
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-200">
                  {clueNameById.get(discovery.clueId) ?? '알 수 없는 단서'}
                </p>
                <p className="text-xs text-slate-500">
                  {settings.investigationMode === 'list'
                    ? '장소 배치 단서'
                    : settings.deckOrder === 'random'
                      ? '랜덤 후보 카드'
                      : '순차 획득 카드'}
                </p>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="rounded-md border border-dashed border-slate-800 px-3 py-4 text-xs leading-5 text-slate-500">
          아직 배치된 단서가 없습니다. 아래 단서 배치에서 단서를 추가하면 이 장소에서 획득할 수
          있습니다.
        </p>
      )}
    </section>
  );
}

function LocationValidationPanel({
  location,
  discoveries,
}: {
  location: LocationResponse;
  discoveries: ReturnType<typeof readLocationDiscoveries>;
}) {
  const messages: string[] = [];
  if (!location.appearance_scene_id) messages.push('출현 장면 미선택: 게임 시작부터 공개됩니다.');
  if (!location.hide_scene_id) messages.push('숨김 장면 미선택: 마지막 장면까지 공개됩니다.');
  if (discoveries.length === 0) messages.push('이 장소에서 획득할 단서가 아직 없습니다.');

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
      <p className="text-xs font-semibold text-slate-200">장소 검수</p>
      <div className="mt-2 space-y-1">
        {messages.length > 0 ? (
          messages.map((message) => (
            <p
              key={message}
              className="rounded-md border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100"
            >
              {message}
            </p>
          ))
        ) : (
          <p className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
            공개 시점과 단서 배치가 기본 조건을 만족합니다.
          </p>
        )}
      </div>
    </section>
  );
}

function LocationEmptyState({ message, compact = false }: { message: string; compact?: boolean }) {
  return (
    <div
      className={`flex items-center justify-center rounded-lg border border-dashed border-slate-800 ${compact ? 'py-8' : 'min-h-64 py-12'}`}
    >
      <div className="text-center">
        <MapPin className="mx-auto mb-2 h-6 w-6 text-slate-800" />
        <p className="text-xs font-mono uppercase tracking-widest text-slate-700">{message}</p>
      </div>
    </div>
  );
}
