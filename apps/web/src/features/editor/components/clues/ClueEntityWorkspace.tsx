import { useCallback, useMemo, useRef, useState } from 'react';
import { Save } from 'lucide-react';
import type {
  ClueResponse,
  EditorCharacterResponse,
  LocationResponse,
  UpdateClueRequest,
} from '@/features/editor/api';
import type { FlowNodeResponse } from '@/features/editor/flowTypes';
import type { EditorConfig } from '@/features/editor/utils/configShape';
import { EntityEditorShell } from '@/features/editor/entities/shell/EntityEditorShell';
import {
  buildClueUsageMap,
  getClueBacklinks,
  type EntityReference,
} from '@/features/editor/utils/entityReferences';
import {
  buildClueBadges,
} from '@/features/editor/entities/clue/clueEntityAdapter';
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

interface ClueEntityWorkspaceProps {
  themeId?: string;
  clues: ClueResponse[];
  configJson: EditorConfig | null | undefined;
  flowNodes?: FlowNodeResponse[];
  locations: LocationResponse[];
  characters: EditorCharacterResponse[];
  onCreate: () => void;
  onUpdate: (clueId: string, body: UpdateClueRequest) => void;
  onDelete: (clue: ClueResponse) => void;
  isClueSaving?: boolean;
  onConfigChange?: (configJson: EditorConfig) => void;
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
  const isSaving = Boolean(isClueSaving || isConfigSaving);
  const hasDetailChanges = basicInfoState.dirty || runtimeEffectState.dirty;
  const canSaveDetail =
    hasDetailChanges && basicInfoState.valid && runtimeEffectState.valid && !isSaving;
  const handleBasicInfoStateChange = useCallback((state: ClueBasicInfoDraftState) => {
    setBasicInfoState(state);
  }, []);
  const handleRuntimeEffectStateChange = useCallback((state: ClueRuntimeEffectDraftState) => {
    setRuntimeEffectState(state);
  }, []);
  const handleSaveDetail = useCallback(
    (clue: ClueResponse) => {
      const basicRequest = basicInfoRef.current?.getSaveRequest();
      const runtimeRequest = runtimeEffectRef.current?.getSaveRequest();
      if (!basicRequest?.valid || !runtimeRequest?.valid) return;
      if (!basicRequest.dirty && !runtimeRequest.dirty) return;

      if (basicRequest.rowDirty && basicRequest.body) {
        onUpdate(clue.id, basicRequest.body);
      }

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
      if (shouldSaveConfig) {
        onConfigChange?.(nextConfig);
      }
    },
    [configJson, onConfigChange, onUpdate],
  );

  return (
    <EntityEditorShell
      title="단서"
      items={clues}
      selectedId={selectedId}
      onSelect={setSelectedId}
      onCreate={onCreate}
      getItemId={(clue) => clue.id}
      getItemTitle={(clue) => clue.name}
      getItemDescription={(clue) => clue.description || '설명 없음'}
      getItemBadges={(clue) => buildClueBadges(clue, usageMap[clue.id]?.references.length ?? 0)}
      renderDetail={(clue) => (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950/70 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-100">단서 상세 저장</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                기본 정보와 사용 설정을 한 번에 저장합니다.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleSaveDetail(clue)}
              disabled={!canSaveDetail}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:border-slate-800 disabled:bg-transparent disabled:text-slate-600"
            >
              <Save className="h-4 w-4" />
              {isSaving ? '저장 중' : '단서 저장'}
            </button>
          </div>
          <ClueBasicInfoCard
            ref={basicInfoRef}
            themeId={themeId ?? ''}
            clue={clue}
            configJson={configJson}
            isSaving={isClueSaving}
            isConfigSaving={isConfigSaving}
            sceneOptions={sceneOptions}
            onDelete={onDelete}
            onDraftStateChange={handleBasicInfoStateChange}
          />
          <ClueRuntimeEffectCard
            ref={runtimeEffectRef}
            clue={clue}
            clues={clues}
            configJson={configJson}
            onDraftStateChange={handleRuntimeEffectStateChange}
          />
        </div>
      )}
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
