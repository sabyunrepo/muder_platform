import { useEffect, useMemo, useState } from 'react';
import { Image, Info, MapPin, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/shared/components/ui/Button';
import type { EditorThemeResponse, MapResponse, LocationResponse } from '@/features/editor/api';
import { useUpdateLocation } from '@/features/editor/api';
import { ImageUpload } from '@/features/editor/components/ImageUpload';
import { readLocationClueIds } from '@/features/editor/editorTypes';
import { AddNameInput } from './AddNameInput';
import { LocationAccessPolicyPanel } from './LocationAccessPolicyPanel';
import { LocationClueAssignPanel } from './LocationClueAssignPanel';

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

function getPathLabel(map: MapResponse, location: LocationResponse) {
  return `${map.name} / ${location.name}`;
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
    <div className="grid gap-4 xl:grid-cols-[minmax(16rem,0.42fr)_minmax(0,1fr)]">
      <section className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-600">
              장소 트리
            </p>
            <h3 className="mt-1 truncate text-sm font-semibold text-slate-200">
              {selectedMap.name}
            </h3>
          </div>
          <Button size="sm" onClick={onStartAdd}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            장소 추가
          </Button>
        </div>
        {addingLocation && (
          <div className="mb-3 rounded-md border border-amber-500/30 bg-slate-900 p-2">
            <AddNameInput
              placeholder="장소 이름"
              onAdd={onAddLocation}
              onCancel={onCancelAdd}
              isPending={isCreatingLocation}
            />
          </div>
        )}
        {mapLocations.length === 0 ? (
          <LocationEmptyState message="장소 없음" compact />
        ) : (
          <ul className="space-y-1" aria-label={`${selectedMap.name} 장소 목록`}>
            {mapLocations.map((loc) => (
              <LocationListItem
                key={loc.id}
                location={loc}
                selected={selectedLocation?.id === loc.id}
                onSelect={onSelectLocation}
                onDelete={onDeleteLocation}
              />
            ))}
          </ul>
        )}
      </section>
      {selectedLocation ? (
        <SelectedLocationDetail
          themeId={themeId}
          theme={theme}
          map={selectedMap}
          location={selectedLocation}
        />
      ) : (
        <LocationEmptyState message="장소를 추가하거나 선택하세요" />
      )}
    </div>
  );
}

function LocationListItem({
  location,
  selected,
  onSelect,
  onDelete,
}: {
  location: LocationResponse;
  selected: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <li className="group flex items-center gap-1">
      <button
        type="button"
        aria-pressed={selected}
        onClick={() => onSelect(location.id)}
        className={`flex min-w-0 flex-1 items-center gap-2 rounded-md border px-3 py-2 text-left transition ${selected ? 'border-amber-500/50 bg-amber-500/10 text-amber-200' : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700 hover:text-slate-200'}`}
      >
        <MapPin className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate text-sm font-medium">{location.name}</span>
      </button>
      <button
        type="button"
        onClick={() => {
          if (window.confirm(`${location.name} 장소를 삭제할까요?`)) onDelete(location.id);
        }}
        aria-label={`${location.name} 삭제`}
        className="rounded-md p-2 text-slate-700 opacity-100 transition hover:bg-red-950/40 hover:text-red-300 md:opacity-0 md:group-hover:opacity-100"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}

function SelectedLocationDetail({
  themeId,
  theme,
  map,
  location,
}: {
  themeId: string;
  theme: EditorThemeResponse;
  map: MapResponse;
  location: LocationResponse;
}) {
  const updateLocation = useUpdateLocation(themeId);
  const [fromRoundInput, setFromRoundInput] = useState(roundToInput(location.from_round));
  const [untilRoundInput, setUntilRoundInput] = useState(roundToInput(location.until_round));
  const assignedCount = useMemo(
    () => readLocationClueIds(theme.config_json, location.id).length,
    [theme.config_json, location.id]
  );

  useEffect(() => {
    setFromRoundInput(roundToInput(location.from_round));
    setUntilRoundInput(roundToInput(location.until_round));
  }, [location.id, location.from_round, location.until_round]);

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
    updateLocation.mutate(
      {
        locationId: location.id,
        body: {
          name: patch.name ?? location.name,
          restricted_characters: patch.restricted_characters ?? location.restricted_characters,
          image_url: nextImageUrl,
          sort_order: patch.sort_order ?? location.sort_order,
          from_round: nextFrom,
          until_round: nextUntil,
        },
      },
      { onError: () => toast.error('장소 저장에 실패했습니다') }
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-amber-300/80">
              Selected location
            </p>
            <h3 className="mt-1 text-xl font-semibold text-slate-100">{location.name}</h3>
            <p className="mt-1 text-xs text-slate-500">트리 경로: {getPathLabel(map, location)}</p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-xs text-slate-400">
            단서 연결 <span className="font-semibold text-amber-300">{assignedCount}개</span>
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(12rem,0.42fr)_minmax(0,1fr)]">
          <div>
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-300">
              <Image className="h-3.5 w-3.5 text-amber-400" />
              장소 이미지
            </div>
            <ImageUpload
              themeId={themeId}
              target="location"
              targetId={location.id}
              currentImageUrl={location.image_url}
              aspectRatio="16 / 10"
              onUploaded={(url) => saveLocation({ image_url: url || null })}
            />
          </div>
          <div className="space-y-3">
            <RoundFields
              location={location}
              fromRoundInput={fromRoundInput}
              untilRoundInput={untilRoundInput}
              setFromRoundInput={setFromRoundInput}
              setUntilRoundInput={setUntilRoundInput}
              onCommit={saveLocation}
            />
            <InfoBox />
          </div>
        </div>
      </section>
      <LocationAccessPolicyPanel themeId={themeId} location={location} />
      <LocationClueAssignPanel themeId={themeId} theme={theme} location={location} />
    </div>
  );
}

function RoundFields({
  location,
  fromRoundInput,
  untilRoundInput,
  setFromRoundInput,
  setUntilRoundInput,
  onCommit,
}: {
  location: LocationResponse;
  fromRoundInput: string;
  untilRoundInput: string;
  setFromRoundInput: (value: string) => void;
  setUntilRoundInput: (value: string) => void;
  onCommit: (patch: Partial<LocationResponse>) => void;
}) {
  function commitRound(kind: 'from_round' | 'until_round', raw: string) {
    const parsed = parseRound(raw);
    if (parsed === undefined) {
      toast.error('라운드는 1 이상의 숫자로 입력해 주세요');
      if (kind === 'from_round') setFromRoundInput(roundToInput(location.from_round));
      else setUntilRoundInput(roundToInput(location.until_round));
      return;
    }
    onCommit({ [kind]: parsed });
  }

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
      <p className="mb-2 text-xs font-semibold text-slate-300">라운드 노출</p>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-slate-500">
          등장 라운드
          <input
            type="number"
            min={1}
            aria-label={`${location.name} 등장 라운드`}
            value={fromRoundInput}
            onChange={(e) => setFromRoundInput(e.target.value)}
            onBlur={() => commitRound('from_round', fromRoundInput)}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
          />
        </label>
        <label className="text-xs text-slate-500">
          퇴장 라운드
          <input
            type="number"
            min={1}
            aria-label={`${location.name} 퇴장 라운드`}
            value={untilRoundInput}
            onChange={(e) => setUntilRoundInput(e.target.value)}
            onBlur={() => commitRound('until_round', untilRoundInput)}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
          />
        </label>
      </div>
    </div>
  );
}

function InfoBox() {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 text-xs leading-5 text-slate-500">
      <div className="mb-1 flex items-center gap-1.5 font-semibold text-slate-300">
        <Info className="h-3.5 w-3.5 text-amber-400" />
        기본정보
      </div>
      부모 장소는 별도 입력하지 않습니다. 현재 구조에서는 맵과 장소 트리 위치가 곧 경로입니다.
    </div>
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
