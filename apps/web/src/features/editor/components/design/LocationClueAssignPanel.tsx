import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { MapPin, Package } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Spinner } from '@/shared/components/ui/Spinner';
import type { EditorThemeResponse, LocationResponse, ClueResponse } from '@/features/editor/api';
import { editorKeys, useEditorClues, useUpdateConfigJson } from '@/features/editor/api';
import {
  readAllLocationDiscoveries,
  readLocationDiscoveries,
  writeLocationDiscoveries,
  type LocationDiscoveryConfig,
} from '@/features/editor/editorTypes';
import {
  readDeckInvestigationConfig,
  writeDeckInvestigationConfig,
} from '@/features/editor/entities/deckInvestigation/deckInvestigationAdapter';
import {
  readLocationClueInvestigationCost,
  removeLocationClueInvestigationCost,
  syncLocationClueInvestigationRequirements,
  writeLocationClueInvestigationCost,
  type InvestigationCostDraft,
} from '@/features/editor/entities/deckInvestigation/locationClueInvestigationCost';
import { getLocationPathLabel } from '@/features/editor/entities/location/locationHierarchy';
import { ClueSearchMultiSelect, type ClueSearchSelectItem } from './ClueSearchMultiSelect';
import { LocationSelectedClueItem } from './LocationSelectedClueItem';

interface LocationClueAssignPanelProps {
  themeId: string;
  theme: EditorThemeResponse;
  location: LocationResponse;
  allLocations?: LocationResponse[];
  allClues?: ClueResponse[];
  onChange?: (clueIds: string[]) => void;
}

function clueMeta(clue: ClueResponse) {
  return [clue.location_id ? '장소 단서' : '미배치', clue.is_common ? '공용' : null]
    .filter(Boolean)
    .join(' · ');
}

function roundLabel(clue: ClueResponse) {
  return typeof clue.reveal_round === 'number' ? `R${clue.reveal_round}` : 'CL';
}

function toClueSearchItem(clue: ClueResponse): ClueSearchSelectItem {
  return {
    id: clue.id,
    name: clue.name,
    meta: clueMeta(clue),
    badge: roundLabel(clue),
  };
}

export function LocationClueAssignPanel({
  themeId,
  theme,
  location,
  allLocations,
  allClues,
  onChange,
}: LocationClueAssignPanelProps) {
  const { data: fetchedClues, isLoading, isError, refetch } = useEditorClues(themeId);
  const clues = useMemo(() => allClues ?? fetchedClues ?? [], [allClues, fetchedClues]);
  const updateConfig = useUpdateConfigJson(themeId);
  const queryClient = useQueryClient();
  const [activeClueId, setActiveClueId] = useState<string | null>(null);

  const discoveries = useMemo(
    () => readLocationDiscoveries(theme.config_json, location.id),
    [theme.config_json, location.id]
  );
  const investigationDraft = useMemo(
    () => readDeckInvestigationConfig(theme.config_json),
    [theme.config_json]
  );
  const assignedIds = useMemo(
    () => discoveries.map((discovery) => discovery.clueId),
    [discoveries]
  );
  const globallyAssignedClueIds = useMemo(
    () =>
      new Set(
        readAllLocationDiscoveries(theme.config_json)
          .filter((discovery) => discovery.locationId !== location.id)
          .map((discovery) => discovery.clueId)
      ),
    [location.id, theme.config_json]
  );
  const assignedSet = useMemo(() => new Set(assignedIds), [assignedIds]);
  const clueById = useMemo(() => new Map(clues.map((clue) => [clue.id, clue])), [clues]);
  const selectedClues = clues.filter((clue) => assignedSet.has(clue.id));
  const activeClue = selectedClues.find((clue) => clue.id === activeClueId) ?? selectedClues[0] ?? null;
  const clueSearchItems = useMemo(() => clues.map(toClueSearchItem), [clues]);
  const locationPathLabel = useMemo(
    () => getLocationPathLabel(location, allLocations ?? [location]),
    [allLocations, location]
  );

  function readLatestConfigJson() {
    return queryClient.getQueryData<EditorThemeResponse>(editorKeys.theme(themeId))?.config_json
      ?? theme.config_json;
  }

  function commit(
    next: LocationDiscoveryConfig[],
    deckDraft?: typeof investigationDraft,
    baseConfig = theme.config_json,
  ) {
    const locationConfig = writeLocationDiscoveries(baseConfig, location.id, next);
    const nextConfig = deckDraft
      ? writeDeckInvestigationConfig(locationConfig, deckDraft)
      : locationConfig;
    const nextIds = next.map((discovery) => discovery.clueId);
    const cacheKey = editorKeys.theme(themeId);
    const previous = queryClient.getQueryData<EditorThemeResponse>(cacheKey);
    if (previous)
      queryClient.setQueryData<EditorThemeResponse>(cacheKey, {
        ...previous,
        config_json: nextConfig,
      });
    updateConfig.mutate(nextConfig, {
      onSuccess: () => {
        toast.success('단서 조사가 저장되었습니다');
        onChange?.(nextIds);
      },
      onError: () => {
        if (previous) queryClient.setQueryData(cacheKey, previous);
        toast.error('단서 조사 저장에 실패했습니다');
      },
    });
  }

  function addClue(clueId: string) {
    const baseConfig = readLatestConfigJson();
    const currentDiscoveries = readLocationDiscoveries(baseConfig, location.id);
    const currentInvestigationDraft = readDeckInvestigationConfig(baseConfig);
    const currentAssignedSet = new Set(currentDiscoveries.map((discovery) => discovery.clueId));
    const currentGloballyAssignedClueIds = new Set(
      readAllLocationDiscoveries(baseConfig)
        .filter((discovery) => discovery.locationId !== location.id)
        .map((discovery) => discovery.clueId)
    );

    if (currentAssignedSet.has(clueId)) {
      setActiveClueId(clueId);
      return;
    }
    if (currentGloballyAssignedClueIds.has(clueId)) {
      toast.error('이미 다른 장소에 배치된 단서입니다');
      return;
    }
    const clue = clueById.get(clueId);
    const nextDiscoveries = [
      ...currentDiscoveries,
      { locationId: location.id, clueId, requiredClueIds: [], oncePerPlayer: true },
    ];
    const nextDeckDraft = clue
      ? writeLocationClueInvestigationCost(currentInvestigationDraft, {
          locationId: location.id,
          locationName: locationPathLabel,
          clueId,
          clueName: clue.name,
          requiredClueIds: [],
          cost: currentInvestigationDraft.tokens[0]
            ? {
                mode: 'token',
                tokenId: currentInvestigationDraft.tokens[0].id,
                tokenCost: 1,
              }
            : { mode: 'free' },
        })
      : currentInvestigationDraft;
    setActiveClueId(clueId);
    commit(nextDiscoveries, nextDeckDraft, baseConfig);
  }

  function removeClue(clueId: string) {
    const nextDiscoveries = discoveries.filter((discovery) => discovery.clueId !== clueId);
    setActiveClueId((current) => (current === clueId ? null : current));
    commit(
      nextDiscoveries,
      removeLocationClueInvestigationCost(investigationDraft, location.id, clueId)
    );
  }

  function toggleRequiredClue(clueId: string, requiredClueId: string) {
    let nextRequiredIds: string[] = [];
    const nextDiscoveries = discoveries.map((discovery) => {
      if (discovery.clueId !== clueId) return discovery;
      const requiredSet = new Set(discovery.requiredClueIds);
      if (requiredSet.has(requiredClueId)) requiredSet.delete(requiredClueId);
      else requiredSet.add(requiredClueId);
      nextRequiredIds = Array.from(requiredSet).filter((id) => id !== clueId);
      return {
        ...discovery,
        requiredClueIds: nextRequiredIds,
        oncePerPlayer: true,
      };
    });
    commit(
      nextDiscoveries,
      readLocationClueInvestigationCost(investigationDraft, location.id, clueId).mode === 'token'
        ? syncLocationClueInvestigationRequirements(
            investigationDraft,
            location.id,
            clueId,
            nextRequiredIds
          )
        : undefined
    );
  }

  function updateInvestigationCost(clue: ClueResponse, cost: InvestigationCostDraft) {
    const discovery = discoveries.find((item) => item.clueId === clue.id);
    if (!discovery) return;
    commit(
      discoveries,
      writeLocationClueInvestigationCost(investigationDraft, {
        locationId: location.id,
        locationName: locationPathLabel,
        clueId: clue.id,
        clueName: clue.name,
        requiredClueIds: discovery.requiredClueIds,
        cost,
      })
    );
  }

  if (!allClues && isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Spinner size="sm" />
      </div>
    );
  }

  if (!allClues && isError) {
    return (
      <section
        aria-label={`${locationPathLabel} 단서 조사`}
        className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-center text-xs text-red-100"
      >
        <p>단서 목록을 불러오지 못했습니다.</p>
        <button
          type="button"
          onClick={() => refetch?.()}
          className="mt-2 rounded-md border border-red-300/30 px-2 py-1 text-red-50 hover:bg-red-500/20"
        >
          다시 불러오기
        </button>
      </section>
    );
  }

  return (
    <section
      aria-label={`${locationPathLabel} 단서 조사`}
      className="rounded-lg border border-slate-800 bg-slate-950/70 p-3"
    >
      <header className="mb-3 flex flex-wrap items-center gap-2">
        <MapPin className="h-3.5 w-3.5 text-amber-500/70" />
        <h4 className="text-sm font-semibold text-slate-200">{locationPathLabel} 단서 조사</h4>
        <span className="text-xs text-slate-600">
          ({assignedIds.length}/{clues.length})
        </span>
        <p className="basis-full text-xs text-slate-500">
          이 장소를 조사했을 때 얻는 단서와 먼저 필요한 단서를 정합니다.
        </p>
      </header>
      {clues.length === 0 ? (
        <EmptyClues />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(13rem,0.65fr)]">
          <ClueSearchMultiSelect
            title="배치된 단서"
            items={clueSearchItems}
            selectedIds={assignedIds}
            activeId={activeClue?.id}
            disabled={updateConfig.isPending}
            searchLabel="배치할 단서 검색"
            searchPlaceholder="단서명, 상태, 라운드 검색"
            emptySelectedText="아직 배정된 단서가 없습니다. 단서명으로 검색해 이 장소에서 발견할 단서를 추가하세요."
            idleSearchText="전체 단서를 펼치지 않고 검색 결과만 보여줍니다. 단서명을 입력해 추가하세요."
            getDisabledReason={(item) => (globallyAssignedClueIds.has(item.id) ? '배치됨' : null)}
            getAddAriaLabel={(item) => `${item.name} 추가`}
            getSelectedAriaLabel={(item) => `${item.name} 설정 열기`}
            getRemoveAriaLabel={(item) => `${item.name} 해제`}
            onAdd={addClue}
            onRemove={removeClue}
            onSelectSelected={setActiveClueId}
          />
          <section className="rounded-lg border border-amber-500/20 bg-amber-950/10 p-2.5">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-amber-300/80">
                조사 설정
              </p>
              <span className="text-[10px] text-slate-600">
                {activeClue ? activeClue.name : '선택 없음'}
              </span>
            </div>
            {!activeClue ? (
              <p className="rounded-md border border-dashed border-slate-800 px-2.5 py-5 text-center text-xs text-slate-600">
                아직 배정된 단서가 없습니다. 좌측 목록에서 조사 시 발견할 단서를 클릭하세요.
              </p>
            ) : (
              <LocationSelectedClueItem
                key={activeClue.id}
                clue={activeClue}
                discovery={discoveries.find((item) => item.clueId === activeClue.id)}
                availableClues={clues.filter((candidate) => candidate.id !== activeClue.id)}
                clueById={clueById}
                tokens={investigationDraft.tokens}
                cost={readLocationClueInvestigationCost(
                  investigationDraft,
                  location.id,
                  activeClue.id
                )}
                disabled={updateConfig.isPending}
                manageHref={`/editor/${themeId}/design/modules`}
                onRemove={removeClue}
                onToggleRequired={toggleRequiredClue}
                onCostChange={updateInvestigationCost}
              />
            )}
          </section>
        </div>
      )}
    </section>
  );
}

function EmptyClues() {
  return (
    <div className="rounded-md border border-dashed border-slate-800 py-6 text-center">
      <Package className="mx-auto mb-2 h-5 w-5 text-slate-800" />
      <p className="text-[10px] font-mono uppercase tracking-widest text-slate-700">
        단서가 없습니다
      </p>
    </div>
  );
}
