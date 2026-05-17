import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import type {
  ClueResponse,
  EditorCharacterResponse,
  LocationResponse,
  UpdateClueRequest,
} from '@/features/editor/api';
import type { FlowNodeResponse } from '@/features/editor/flowTypes';
import {
  PLAYER_KILL_MODULE_ID,
  readClueItemEffect,
  readCluePlacement,
  readEnabledModuleIds,
  readLocationDiscoveries,
  type EditorConfig,
} from '@/features/editor/utils/configShape';
import {
  DECK_INVESTIGATION_MODULE_ID,
  readDeckInvestigationConfig,
} from '@/features/editor/entities/deckInvestigation/deckInvestigationAdapter';
import { readLocationClueInvestigationCost } from '@/features/editor/entities/deckInvestigation/locationClueInvestigationCost';
import { getLocationPathLabel } from '@/features/editor/entities/location/locationHierarchy';
import { EntityEditorShell } from '@/features/editor/entities/shell/EntityEditorShell';
import {
  buildClueUsageMap,
  getClueBacklinks,
  type EntityReference,
} from '@/features/editor/utils/entityReferences';
import { ClueRuntimeEffectCard } from './ClueRuntimeEffectCard';
import type {
  ClueRuntimeEffectCardHandle,
  ClueRuntimeEffectDraftState,
} from './ClueRuntimeEffectCard';
import { ClueBasicInfoCard } from './ClueBasicInfoCard';
import type {
  ClueBasicInfoCardHandle,
  ClueBasicInfoDraftState,
} from './ClueBasicInfoCard';
import {
  buildProgressNodeRevealOptions,
} from '@/features/editor/entities/reveal/revealTimingOptions';
import { useDebouncedMutation } from '@/hooks/useDebouncedMutation';

const CLUE_DETAIL_AUTOSAVE_MS = 1500;
const CLUE_AUTOSAVE_TOAST_ID = 'clue-detail-autosave';

interface AutosaveMutationOptions {
  onSuccess?: () => void;
  onError?: (error?: unknown) => void;
}

interface ClueDetailAutosaveBody {
  clueId: string;
  rowBody: UpdateClueRequest | null;
  nextConfig: EditorConfig | null;
}

interface ClueEntityWorkspaceProps {
  themeId?: string;
  clues: ClueResponse[];
  configJson: EditorConfig | null | undefined;
  flowNodes?: FlowNodeResponse[];
  locations: LocationResponse[];
  characters: EditorCharacterResponse[];
  onCreate: () => void;
  onUpdate: (clueId: string, body: UpdateClueRequest, options?: AutosaveMutationOptions) => void;
  onDelete: (clue: ClueResponse) => void;
  isClueSaving?: boolean;
  onConfigChange?: (configJson: EditorConfig, options?: AutosaveMutationOptions) => void;
  isConfigSaving?: boolean;
}

export function ClueEntityWorkspace({
  themeId,
  clues,
  configJson,
  flowNodes,
  locations,
  characters,
  onCreate,
  onUpdate,
  onDelete,
  isClueSaving,
  onConfigChange,
  isConfigSaving,
}: ClueEntityWorkspaceProps) {
  const [selectedId, setSelectedId] = useState(clues[0]?.id ?? '');
  const basicInfoRef = useRef<ClueBasicInfoCardHandle | null>(null);
  const runtimeEffectRef = useRef<ClueRuntimeEffectCardHandle | null>(null);
  const [basicInfoState, setBasicInfoState] = useState<ClueBasicInfoDraftState>({
    dirty: false,
    valid: true,
  });
  const [runtimeEffectState, setRuntimeEffectState] = useState<ClueRuntimeEffectDraftState>({
    dirty: false,
    valid: true,
  });
  const [draftRevision, setDraftRevision] = useState(0);
  const usageMap = useMemo(
    () => buildClueUsageMap({ configJson, clues, locations, characters }),
    [configJson, clues, locations, characters]
  );
  const sceneOptions = useMemo(
    () => buildProgressNodeRevealOptions(
      flowNodes,
      clues.flatMap((clue) => [
        clue.reveal_scene_id,
        clue.hide_scene_id,
      ]),
    ),
    [flowNodes, clues],
  );
  const isPlayerKillEnabled = useMemo(
    () => readEnabledModuleIds(configJson).includes(PLAYER_KILL_MODULE_ID),
    [configJson],
  );
  const enabledModuleIds = useMemo(() => readEnabledModuleIds(configJson), [configJson]);
  const isDeckInvestigationEnabled = enabledModuleIds.includes(DECK_INVESTIGATION_MODULE_ID);
  const deckInvestigationDraft = useMemo(
    () => readDeckInvestigationConfig(configJson),
    [configJson],
  );
  const cluePlacement = useMemo(() => readCluePlacement(configJson), [configJson]);
  const locationById = useMemo(
    () => new Map(locations.map((location) => [location.id, location])),
    [locations],
  );
  const getClueLocationContext = useCallback(
    (clue: ClueResponse) => {
      const placedLocationId = cluePlacement[clue.id] ?? clue.location_id ?? null;
      const placedLocation = placedLocationId ? locationById.get(placedLocationId) ?? null : null;
      const locationName = placedLocation
        ? getLocationPathLabel(placedLocation, locations)
        : null;
      return { placedLocationId, locationName };
    },
    [cluePlacement, locationById, locations],
  );
  const buildListBadges = useCallback(
    (clue: ClueResponse) => {
      const { placedLocationId, locationName } = getClueLocationContext(clue);
      const effect = readClueItemEffect(configJson, clue.id);
      const badges: string[] = [locationName ? `장소: ${locationName}` : '미배치'];
      if (clue.is_common) badges.push('전체 공개');
      if (clue.is_usable) badges.push('사용 가능');
      if (effect?.effect === 'kill') {
        badges.push('살해 요청');
        if ((effect.attackPower ?? 0) > 0) badges.push(`공격력 ${effect.attackPower}`);
        if ((effect.defensePower ?? 0) > 0) badges.push(`방어력 ${effect.defensePower}`);
      }
      if (isDeckInvestigationEnabled && placedLocationId) {
        const cost = readLocationClueInvestigationCost(deckInvestigationDraft, placedLocationId, clue.id);
        badges.push(cost.mode === 'free' ? '조사권 무료' : `조사권 ${Math.max(1, cost.tokenCost)}개`);
      }
      return badges;
    },
    [configJson, deckInvestigationDraft, getClueLocationContext, isDeckInvestigationEnabled],
  );
  const saveDetailBody = useCallback(
    (body: ClueDetailAutosaveBody, opts?: { onError?: (error?: unknown) => void }) => {
      const saveOperations =
        (body.rowBody ? 1 : 0) + (body.nextConfig && onConfigChange ? 1 : 0);
      if (saveOperations === 0) return;

      toast.loading('단서 자동저장 중...', { id: CLUE_AUTOSAVE_TOAST_ID });

      let remaining = saveOperations;
      let failed = false;
      const markSuccess = () => {
        if (failed) return;
        remaining -= 1;
        if (remaining === 0) {
          toast.success('단서가 자동저장되었습니다', {
            id: CLUE_AUTOSAVE_TOAST_ID,
            duration: 1200,
          });
        }
      };
      const markError = (error?: unknown) => {
        if (failed) return;
        failed = true;
        opts?.onError?.(error);
      };

      if (body.rowBody) {
        onUpdate(body.clueId, body.rowBody, {
          onSuccess: markSuccess,
          onError: markError,
        });
      }
      if (body.nextConfig && onConfigChange) {
        onConfigChange(body.nextConfig, {
          onSuccess: markSuccess,
          onError: markError,
        });
      }
    },
    [onConfigChange, onUpdate],
  );

  const showFailureToast = useCallback((body: ClueDetailAutosaveBody | null) => {
    toast.error('단서 자동저장에 실패했습니다', {
      id: CLUE_AUTOSAVE_TOAST_ID,
      duration: 6000,
      action: body
        ? {
            label: '재시도',
            onClick: () => {
              saveDetailBody(body, {
                onError: () => showFailureToast(body),
              });
            },
          }
        : undefined,
    });
  }, [saveDetailBody]);

  const { schedule, flush } = useDebouncedMutation<ClueDetailAutosaveBody>({
    debounceMs: CLUE_DETAIL_AUTOSAVE_MS,
    mutate: (body, opts) => {
      saveDetailBody(body, {
        onError: (error) => {
          opts.onError(error);
          showFailureToast(body);
        },
      });
    },
  });

  const buildAutosaveBody = useCallback(
    (clue: ClueResponse): ClueDetailAutosaveBody | null => {
      const basicRequest = basicInfoRef.current?.getSaveRequest();
      const runtimeRequest = runtimeEffectRef.current?.getSaveRequest();
      if (!basicRequest?.valid || !runtimeRequest?.valid) return null;
      if (!basicRequest.dirty && !runtimeRequest.dirty) return null;

      let nextConfig = configJson ?? {};
      let shouldSaveConfig = false;
      if (basicRequest.configDirty) {
        nextConfig = basicRequest.writeConfig(nextConfig);
        shouldSaveConfig = true;
      }
      if (runtimeRequest.dirty) {
        nextConfig = runtimeRequest.writeConfig(nextConfig);
        shouldSaveConfig = true;
      }

      const body = {
        clueId: clue.id,
        rowBody: basicRequest.rowDirty ? basicRequest.body : null,
        nextConfig: shouldSaveConfig ? nextConfig : null,
      };
      return body.rowBody || body.nextConfig ? body : null;
    },
    [configJson],
  );

  const scheduleAutosave = useCallback(
    (clue: ClueResponse) => {
      if (!basicInfoState.valid || !runtimeEffectState.valid) return;
      if (!basicInfoState.dirty && !runtimeEffectState.dirty) return;
      const body = buildAutosaveBody(clue);
      if (!body) return;
      schedule(body);
    },
    [basicInfoState, buildAutosaveBody, runtimeEffectState, schedule],
  );

  const selectedClue = clues.find((clue) => clue.id === selectedId) ?? clues[0];
  useEffect(() => {
    if (!selectedClue) return;
    scheduleAutosave(selectedClue);
  }, [draftRevision, scheduleAutosave, selectedClue]);

  const handleSelect = useCallback(
    (id: string) => {
      flush();
      setSelectedId(id);
    },
    [flush],
  );

  const handleFlushAutosave = useCallback(() => {
    if (
      selectedClue &&
      basicInfoState.valid &&
      runtimeEffectState.valid &&
      (basicInfoState.dirty || runtimeEffectState.dirty)
    ) {
      const body = buildAutosaveBody(selectedClue);
      if (body) {
        schedule(body);
      }
    }
    flush();
  }, [basicInfoState, buildAutosaveBody, flush, runtimeEffectState, schedule, selectedClue]);

  const handleBasicInfoStateChange = useCallback((state: ClueBasicInfoDraftState) => {
    setDraftRevision((revision) => revision + 1);
    setBasicInfoState((current) =>
      current.dirty === state.dirty && current.valid === state.valid ? current : state,
    );
  }, []);
  const handleRuntimeEffectStateChange = useCallback((state: ClueRuntimeEffectDraftState) => {
    setDraftRevision((revision) => revision + 1);
    setRuntimeEffectState((current) =>
      current.dirty === state.dirty && current.valid === state.valid ? current : state,
    );
  }, []);

  return (
    <EntityEditorShell
      title="단서"
      items={clues}
      selectedId={selectedId}
      onSelect={handleSelect}
      onCreate={onCreate}
      getItemId={(clue) => clue.id}
      getItemTitle={(clue) => clue.name}
      getItemDescription={() => ''}
      getItemSearchText={(clue) => clue.description ?? ''}
      getItemBadges={buildListBadges}
      renderDetail={(clue) => {
        const { placedLocationId, locationName } = getClueLocationContext(clue);
        const discovery = placedLocationId
          ? readLocationDiscoveries(configJson, placedLocationId).find((item) => item.clueId === clue.id)
          : undefined;
        return (
          <div className="space-y-4">
            <ClueBasicInfoCard
              ref={basicInfoRef}
              themeId={themeId ?? ''}
              clue={clue}
              configJson={configJson}
              isSaving={isClueSaving}
              isConfigSaving={isConfigSaving}
              sceneOptions={sceneOptions}
              investigationSettings={{
                enabled: isDeckInvestigationEnabled,
                tokens: deckInvestigationDraft.tokens,
                cost: placedLocationId
                  ? readLocationClueInvestigationCost(deckInvestigationDraft, placedLocationId, clue.id)
                  : null,
                locationId: placedLocationId,
                locationName,
                requiredClueIds: discovery?.requiredClueIds ?? [],
              }}
              onDelete={onDelete}
              onDraftStateChange={handleBasicInfoStateChange}
              onAutoSaveFlush={handleFlushAutosave}
            />
            <ClueRuntimeEffectCard
              ref={runtimeEffectRef}
              clue={clue}
              clues={clues}
              configJson={configJson}
              isPlayerKillEnabled={isPlayerKillEnabled}
              onDraftStateChange={handleRuntimeEffectStateChange}
              onAutoSaveFlush={handleFlushAutosave}
            />
          </div>
        );
      }}
      renderInspector={(clue) => <ClueUsageCard references={getClueBacklinks(usageMap, clue.id)} />}
    />
  );
}

function ClueUsageCard({ references }: { references: EntityReference[] }) {
  return (
    <aside className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
      <p className="text-sm font-semibold text-slate-200">이 단서가 쓰이는 곳</p>
      <p className="mt-1 text-xs text-slate-500">
        삭제하거나 수정할 때 함께 확인해야 하는 연결입니다.
      </p>
      {references.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-slate-800 px-3 py-6 text-center text-xs text-slate-600">
          아직 배치된 장소나 시작 단서가 없습니다.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {references.map((ref, index) => (
            <li
              key={`${ref.sourceType}-${ref.sourceId}-${ref.relation}-${index}`}
              className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-300"
            >
              {formatReference(ref)}
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

function formatReference(ref: EntityReference) {
  if (ref.relation === 'location_clue') return `${ref.sourceName}의 발견 단서`;
  if (ref.relation === 'evidence') return `${ref.sourceName}의 증거 설정`;
  if (ref.relation === 'starting_clue') return `${ref.sourceName}의 시작 단서`;
  if (ref.relation === 'combination_input') return `${ref.sourceName}의 조합 조건`;
  if (ref.relation === 'combination_output') return `${ref.sourceName}의 조합 보상`;
  if (ref.relation === 'trigger') return `${ref.sourceName}의 트리거`;
  return `${ref.sourceName}의 연결 설정`;
}
