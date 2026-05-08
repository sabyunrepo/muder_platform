import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { Info, MapPin, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { EditorThemeResponse, MapResponse, LocationResponse } from '@/features/editor/api';
import { useUpdateConfigJson, useUpdateLocation } from '@/features/editor/api';
import { EntityTriggerPlacementCard } from '@/features/editor/components/triggers/EntityTriggerPlacementCard';
import { readLocationClueIds } from '@/features/editor/editorTypes';
import type { EditorConfig } from '@/features/editor/utils/configShape';
import {
  buildLocationParentOptions,
  toLocationEditorViewModel,
} from '@/features/editor/entities/location/locationEntityAdapter';
import { readLocationMeta, writeLocationMeta } from '@/features/editor/utils/entityMeta';
import { AddNameInput } from './AddNameInput';
import { EntityEditorShell } from '@/features/editor/entities/shell/EntityEditorShell';
import { LocationAccessPolicyPanel } from './LocationAccessPolicyPanel';
import { LocationClueAssignPanel } from './LocationClueAssignPanel';
import { LocationImageMediaField } from './LocationImageMediaField';

interface LocationDetailPanelProps {
  themeId: string;
  theme: EditorThemeResponse;
  selectedMap: MapResponse | null;
  selectedLocation: LocationResponse | null;
  mapLocations: LocationResponse[];
  addingLocation: boolean;
  isCreatingLocation: boolean;
  onStartAdd: () => void;
  onCancelAdd: () => void;
  onAddLocation: (name: string) => void;
  onSelectLocation: (locationId: string) => void;
  onDeleteLocation: (locationId: string) => void;
}

function parseRound(raw: string): number | null | undefined {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 1) return undefined;
  return Math.floor(n);
}

function roundToInput(value: number | null | undefined) {
  return value == null ? '' : String(value);
}

interface LocationBasicDraft {
  name: string;
  publicDescription: string;
  entryMessage: string;
  parentLocationId: string;
}

export function LocationDetailPanel({
  themeId,
  theme,
  selectedMap,
  selectedLocation,
  mapLocations,
  addingLocation,
  isCreatingLocation,
  onStartAdd,
  onCancelAdd,
  onAddLocation,
  onSelectLocation,
  onDeleteLocation,
}: LocationDetailPanelProps) {
  if (!selectedMap) return <LocationEmptyState message="좌측에서 맵을 선택하세요" />;

  return (
    <EntityEditorShell
      title="장소"
      items={mapLocations}
      selectedId={selectedLocation?.id}
      onSelect={onSelectLocation}
      onCreate={onStartAdd}
      createLabel="장소 추가"
      emptyMessage="장소 없음"
      emptyDescription="이 맵에 배치할 장소를 추가하세요."
      listAccessory={
        addingLocation ? (
          <div className="mb-3 rounded-md border border-amber-500/30 bg-slate-900 p-2">
            <AddNameInput
              placeholder="장소 이름"
              onAdd={onAddLocation}
              onCancel={onCancelAdd}
              isPending={isCreatingLocation}
            />
          </div>
        ) : null
      }
      getItemId={(location) => location.id}
      getItemTitle={(location) => location.name}
      getItemDescription={(location) =>
        toLocationEditorViewModel(location, {
          clueCount: readLocationClueIds(theme.config_json, location.id).length,
          mapName: selectedMap.name,
        }).roundLabel
      }
      getItemBadges={(location) =>
        toLocationEditorViewModel(location, {
          clueCount: readLocationClueIds(theme.config_json, location.id).length,
          mapName: selectedMap.name,
        }).badges
      }
      renderItemActions={(location) => (
        <button
          type="button"
          onClick={() => {
            if (window.confirm(`${location.name} 장소를 삭제할까요?`))
              onDeleteLocation(location.id);
          }}
          aria-label={`${location.name} 삭제`}
          className="rounded-md p-2 text-slate-700 opacity-100 transition hover:bg-red-950/40 hover:text-red-300 md:opacity-0 md:group-hover:opacity-100"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
      renderDetail={(location) => (
        <SelectedLocationDetail
          themeId={themeId}
          theme={theme}
          map={selectedMap}
          location={location}
          mapLocations={mapLocations}
        />
      )}
    />
  );
}
function SelectedLocationDetail({
  themeId,
  theme,
  map,
  location,
  mapLocations,
}: {
  themeId: string;
  theme: EditorThemeResponse;
  map: MapResponse;
  location: LocationResponse;
  mapLocations: LocationResponse[];
}) {
  const updateLocation = useUpdateLocation(themeId);
  const updateConfig = useUpdateConfigJson(themeId);
  const [fromRoundInput, setFromRoundInput] = useState(roundToInput(location.from_round));
  const [untilRoundInput, setUntilRoundInput] = useState(roundToInput(location.until_round));
  const [visibilityMode, setVisibilityMode] = useState<VisibilityMode>(
    getVisibilityMode(roundToInput(location.from_round), roundToInput(location.until_round))
  );
  const locationMeta = useMemo(
    () => readLocationMeta(theme.config_json, location.id),
    [theme.config_json, location.id]
  );
  const locationMetaById = useMemo(
    () =>
      Object.fromEntries(
        mapLocations.map((item) => [item.id, readLocationMeta(theme.config_json, item.id)])
      ),
    [mapLocations, theme.config_json]
  );
  const [basicDraft, setBasicDraft] = useState({
    name: location.name,
    publicDescription: locationMeta.publicDescription ?? '',
    entryMessage: locationMeta.entryMessage ?? '',
    parentLocationId: locationMeta.parentLocationId ?? '',
  });
  const assignedCount = useMemo(
    () => readLocationClueIds(theme.config_json, location.id).length,
    [theme.config_json, location.id]
  );
  const viewModel = toLocationEditorViewModel(location, {
    clueCount: assignedCount,
    mapName: map.name,
    locationMeta,
    allLocations: mapLocations,
  });
  const parentOptions = useMemo(
    () => buildLocationParentOptions(location.id, mapLocations, locationMetaById),
    [location.id, locationMetaById, mapLocations]
  );

  useEffect(() => {
    setFromRoundInput(roundToInput(location.from_round));
    setUntilRoundInput(roundToInput(location.until_round));
    setVisibilityMode(
      getVisibilityMode(roundToInput(location.from_round), roundToInput(location.until_round))
    );
    setBasicDraft({
      name: location.name,
      publicDescription: locationMeta.publicDescription ?? '',
      entryMessage: locationMeta.entryMessage ?? '',
      parentLocationId: locationMeta.parentLocationId ?? '',
    });
  }, [location.id, location.name, location.from_round, location.until_round, locationMeta]);

  function saveLocation(patch: Partial<LocationResponse>) {
    const currentFrom = parseRound(fromRoundInput);
    const currentUntil = parseRound(untilRoundInput);
    const nextFrom =
      patch.from_round !== undefined
        ? patch.from_round
        : currentFrom === undefined
          ? (location.from_round ?? null)
          : currentFrom;
    const nextUntil =
      patch.until_round !== undefined
        ? patch.until_round
        : currentUntil === undefined
          ? (location.until_round ?? null)
          : currentUntil;
    if (nextFrom != null && nextUntil != null && nextFrom > nextUntil) {
      toast.error('등장 라운드는 퇴장 라운드보다 클 수 없습니다');
      setFromRoundInput(roundToInput(location.from_round));
      setUntilRoundInput(roundToInput(location.until_round));
      return;
    }
    const nextImageUrl = Object.prototype.hasOwnProperty.call(patch, 'image_url')
      ? (patch.image_url ?? null)
      : location.image_url;
    const hasImageMediaPatch = Object.prototype.hasOwnProperty.call(patch, 'image_media_id');
    const body = {
      name: patch.name ?? location.name,
      restricted_characters: patch.restricted_characters ?? location.restricted_characters,
      image_url: nextImageUrl,
      sort_order: patch.sort_order ?? location.sort_order,
      from_round: nextFrom,
      until_round: nextUntil,
      ...(hasImageMediaPatch ? { image_media_id: patch.image_media_id ?? null } : {}),
    };
    updateLocation.mutate(
      {
        locationId: location.id,
        body,
      },
      { onError: () => toast.error('장소 저장에 실패했습니다') }
    );
  }

  function saveTriggerConfig(nextConfig: EditorConfig) {
    updateConfig.mutate(nextConfig, {
      onSuccess: () => toast.success('장소 트리거가 저장되었습니다'),
      onError: () => toast.error('장소 트리거 저장에 실패했습니다'),
    });
  }

  function saveBasicInfo() {
    const nextName = basicDraft.name.trim();
    if (!nextName) {
      toast.error('장소 이름을 입력해 주세요');
      return;
    }

    const nextParentId = basicDraft.parentLocationId || null;
    saveLocation({ name: nextName });
    updateConfig.mutate(
      writeLocationMeta(theme.config_json, location.id, {
        publicDescription: basicDraft.publicDescription.trim(),
        entryMessage: basicDraft.entryMessage.trim(),
        parentLocationId: nextParentId,
      }),
      {
        onSuccess: () => toast.success('장소 기본 정보가 저장되었습니다'),
        onError: () => toast.error('장소 기본 정보 저장에 실패했습니다'),
      }
    );
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
            <p className="mt-1 text-xs text-slate-500">
              트리 경로: {map.name} /{' '}
              {viewModel.parentLabel === '최상위 장소'
                ? location.name
                : `${viewModel.parentLabel} / ${location.name}`}
            </p>
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
              onSave={saveBasicInfo}
              isSaving={updateLocation.isPending || updateConfig.isPending}
            />
            <LocationStructureFields
              location={location}
              mapName={map.name}
              parentLabel={viewModel.parentLabel}
              parentOptions={parentOptions}
              selectedParentId={basicDraft.parentLocationId}
              onParentChange={(parentLocationId) =>
                setBasicDraft((current) => ({ ...current, parentLocationId }))
              }
            />
            <RoundFields
              location={location}
              fromRoundInput={fromRoundInput}
              untilRoundInput={untilRoundInput}
              setFromRoundInput={setFromRoundInput}
              setUntilRoundInput={setUntilRoundInput}
              visibilityMode={visibilityMode}
              setVisibilityMode={setVisibilityMode}
              onCommit={saveLocation}
            />
          </div>
        </div>
      </section>
      <EntityTriggerPlacementCard
        themeId={themeId}
        entityKind="location"
        entityId={location.id}
        entityName={location.name}
        configJson={theme.config_json}
        onConfigChange={saveTriggerConfig}
        isSaving={updateConfig.isPending}
      />
      <LocationAccessPolicyPanel themeId={themeId} location={location} />
      <LocationClueAssignPanel themeId={themeId} theme={theme} location={location} />
    </div>
  );
}

function LocationBasicInfoFields({
  locationName,
  draft,
  onDraftChange,
  onSave,
  isSaving,
}: {
  locationName: string;
  draft: LocationBasicDraft;
  onDraftChange: Dispatch<SetStateAction<LocationBasicDraft>>;
  onSave: () => void;
  isSaving: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-slate-300">기본 정보</p>
        <button
          type="button"
          onClick={onSave}
          disabled={isSaving}
          className="rounded-md border border-amber-500/40 px-3 py-1.5 text-xs font-medium text-amber-100 transition hover:bg-amber-500/10 disabled:cursor-not-allowed disabled:opacity-60"
        >
          저장
        </button>
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

function LocationStructureFields({
  location,
  mapName,
  parentLabel,
  parentOptions,
  selectedParentId,
  onParentChange,
}: {
  location: LocationResponse;
  mapName: string;
  parentLabel: string;
  parentOptions: Array<{ id: string; label: string; depth: number }>;
  selectedParentId: string;
  onParentChange: (parentLocationId: string) => void;
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
      <div className="mb-2 flex items-center gap-1.5 font-semibold text-slate-300">
        <Info className="h-3.5 w-3.5 text-amber-400" />
        장소 구조
      </div>
      <label className="text-xs text-slate-500">
        부모 장소
        <select
          aria-label={`${location.name} 부모 장소`}
          value={selectedParentId}
          onChange={(event) => onParentChange(event.target.value)}
          className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
        >
          <option value="">최상위 장소</option>
          {parentOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {`${'· '.repeat(option.depth)}${option.label}`}
            </option>
          ))}
        </select>
      </label>
      <p className="mt-2 text-xs leading-5 text-slate-500">
        현재 경로: {mapName} /{' '}
        {parentLabel === '최상위 장소' ? location.name : `${parentLabel} / ${location.name}`}
      </p>
    </div>
  );
}

function RoundFields({
  location,
  fromRoundInput,
  untilRoundInput,
  setFromRoundInput,
  setUntilRoundInput,
  visibilityMode,
  setVisibilityMode,
  onCommit,
}: {
  location: LocationResponse;
  fromRoundInput: string;
  untilRoundInput: string;
  setFromRoundInput: (value: string) => void;
  setUntilRoundInput: (value: string) => void;
  visibilityMode: VisibilityMode;
  setVisibilityMode: (value: VisibilityMode) => void;
  onCommit: (patch: Partial<LocationResponse>) => void;
}) {
  function commitVisibility(nextFrom: string, nextUntil: string) {
    const parsedFrom = parseRound(nextFrom);
    const parsedUntil = parseRound(nextUntil);
    if (parsedFrom === undefined || parsedUntil === undefined) {
      toast.error('라운드는 1 이상의 숫자로 입력해 주세요');
      setFromRoundInput(roundToInput(location.from_round));
      setUntilRoundInput(roundToInput(location.until_round));
      return;
    }
    onCommit({ from_round: parsedFrom, until_round: parsedUntil });
  }

  function commitRound(kind: 'from_round' | 'until_round', raw: string) {
    const nextFrom = kind === 'from_round' ? raw : fromRoundInput;
    const nextUntil = kind === 'until_round' ? raw : untilRoundInput;
    const parsed = parseRound(raw);
    if (parsed === undefined) {
      toast.error('라운드는 1 이상의 숫자로 입력해 주세요');
      if (kind === 'from_round') setFromRoundInput(roundToInput(location.from_round));
      else setUntilRoundInput(roundToInput(location.until_round));
      return;
    }
    commitVisibility(nextFrom, nextUntil);
  }

  function selectMode(nextMode: VisibilityMode) {
    setVisibilityMode(nextMode);
    if (nextMode === 'always') {
      setFromRoundInput('');
      setUntilRoundInput('');
      onCommit({ from_round: null, until_round: null });
      return;
    }
    const fallbackFrom = fromRoundInput || '1';
    const fallbackUntil = untilRoundInput || fallbackFrom;
    if (nextMode === 'from') {
      setFromRoundInput(fallbackFrom);
      setUntilRoundInput('');
      commitVisibility(fallbackFrom, '');
    } else if (nextMode === 'until') {
      setFromRoundInput('');
      setUntilRoundInput(fallbackUntil);
      commitVisibility('', fallbackUntil);
    } else {
      setFromRoundInput(fallbackFrom);
      setUntilRoundInput(fallbackUntil);
      commitVisibility(fallbackFrom, fallbackUntil);
    }
  }

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
      <p className="mb-2 text-xs font-semibold text-slate-300">공개 시점</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {[
          ['always', '처음부터 끝까지'],
          ['from', '특정 라운드부터'],
          ['until', '특정 라운드까지'],
          ['range', '특정 구간만'],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => selectMode(value as 'always' | 'from' | 'until' | 'range')}
            className={`rounded-md border px-3 py-2 text-left text-xs transition ${
              visibilityMode === value
                ? 'border-amber-500/60 bg-amber-500/10 text-amber-100'
                : 'border-slate-700 bg-slate-950 text-slate-400 hover:border-slate-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {visibilityMode !== 'always' ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {visibilityMode === 'from' || visibilityMode === 'range' ? (
            <label className="text-xs text-slate-500">
              시작 라운드
              <input
                type="number"
                min={1}
                aria-label={`${location.name} 시작 라운드`}
                value={fromRoundInput}
                onChange={(e) => setFromRoundInput(e.target.value)}
                onBlur={() => commitRound('from_round', fromRoundInput)}
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
              />
            </label>
          ) : null}
          {visibilityMode === 'until' || visibilityMode === 'range' ? (
            <label className="text-xs text-slate-500">
              종료 라운드
              <input
                type="number"
                min={1}
                aria-label={`${location.name} 종료 라운드`}
                value={untilRoundInput}
                onChange={(e) => setUntilRoundInput(e.target.value)}
                onBlur={() => commitRound('until_round', untilRoundInput)}
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
              />
            </label>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

type VisibilityMode = 'always' | 'from' | 'until' | 'range';

function getVisibilityMode(fromRoundInput: string, untilRoundInput: string): VisibilityMode {
  const hasFrom = fromRoundInput.trim() !== '';
  const hasUntil = untilRoundInput.trim() !== '';
  if (hasFrom && hasUntil) return 'range';
  if (hasFrom) return 'from';
  if (hasUntil) return 'until';
  return 'always';
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
