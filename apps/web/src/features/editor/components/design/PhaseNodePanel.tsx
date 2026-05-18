import { useCallback, type ReactNode } from 'react';
import type { Edge, Node } from '@xyflow/react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useEditorMaps } from '../../editorMapApi';
import { useUpdateConfigJson } from '../../editorConfigApi';
import { useUpdateFlowNode } from '../../flowApi';
import type { EditorThemeResponse } from '../../api';
import { editorKeys } from '../../api';
import type { FlowGraphResponse, FlowNodeData, PhaseAction } from '../../flowTypes';
import { flowKeys } from '../../flowTypes';
import { useEditorAutosaveToast } from '@/features/editor/hooks/useEditorAutosaveToast';
import { showUnknownErrorToast } from '@/lib/show-error-toast';
import { ActionListEditor, hasIncompletePresentationCueActions } from './ActionListEditor';
import { PhasePanelBasicInfo } from './PhasePanelBasicInfo';
import { normalizePhaseType } from './phaseTypeOptions';
import { InvestigationPhasePanel } from './InvestigationPhasePanel';
import { DiscussionPhasePanel } from './DiscussionPhasePanel';
import { VotingQuestionPhasePanel } from './VotingQuestionPhasePanel';
import { ReadingPhasePanel } from './ReadingPhasePanel';
import {
  PLAYER_KILL_MODULE_ID,
  readEnabledModuleIds,
  readPlayerKillConfig,
  writePlayerKillSceneEnabled,
} from '../../utils/configShape';
import {
  createSceneActionDefaultParams,
  getSceneActionOptions,
} from '../../entities/sceneAction/sceneActionRegistry';
import { readDeckInvestigationConfig } from '../../entities/deckInvestigation/deckInvestigationAdapter';

interface PhaseNodePanelProps {
  node: Node;
  themeId: string;
  onUpdate: (id: string, data: Partial<FlowNodeData>) => void;
  edges?: Edge[];
  headerActions?: ReactNode;
}

/** Debounce window for flow-node saves (W2 PR-5: 500→1500ms). */
const SAVE_DEBOUNCE_MS = 1500;
const toastWithLoading = toast as typeof toast & {
  loading?: (message: string, options?: Record<string, unknown>) => void;
};

export function PhaseNodePanel({ node, themeId, onUpdate, headerActions }: PhaseNodePanelProps) {
  const updateNode = useUpdateFlowNode(themeId);
  const updateConfig = useUpdateConfigJson(themeId);
  const { data: maps = [], isLoading: mapsLoading } = useEditorMaps(themeId);
  const queryClient = useQueryClient();
  const data = node.data as FlowNodeData;
  const phaseType = normalizePhaseType(data.phase_type);
  const theme = queryClient.getQueryData<EditorThemeResponse>(editorKeys.theme(themeId));
  const configJson = theme?.config_json ?? {};
  const enabledModuleIds = readEnabledModuleIds(configJson);
  const playerKillEnabled = enabledModuleIds.includes(PLAYER_KILL_MODULE_ID);
  const sceneActionOptions = getSceneActionOptions({ enabledModuleIds });
  const sceneActionTypes = sceneActionOptions.map((option) => option.value);
  const investigationTokens = readDeckInvestigationConfig(configJson).tokens;
  const createSceneActionParams = useCallback(
    (type: string) => {
      const params = createSceneActionDefaultParams(type);
      if (
        (type === 'GRANT_INVESTIGATION_TOKEN' || type === 'RESET_INVESTIGATION_TOKEN') &&
        params &&
        !params.tokenId &&
        investigationTokens[0]?.id
      ) {
        return { ...params, tokenId: investigationTokens[0].id };
      }
      return params;
    },
    [investigationTokens]
  );
  const playerKillConfig = readPlayerKillConfig(configJson);
  const sceneKillEnabled = playerKillConfig.allowedSceneIds.includes(node.id);
  const isPhaseSceneNode = node.type === 'phase';

  const debouncer = useEditorAutosaveToast<FlowNodeData>({
    debounceMs: SAVE_DEBOUNCE_MS,
    messages: {
      toastId: `phase-node-autosave-${node.id}`,
      loading: '장면 설정을 저장 중입니다',
      success: '장면 설정이 저장되었습니다',
      error: '저장에 실패했습니다',
    },
    mutate: (body, opts) => updateNode.mutate({ nodeId: node.id, body: { data: body } }, opts),
    applyOptimistic: (body) => {
      const cacheKey = flowKeys.graph(themeId);
      const previous = queryClient.getQueryData<FlowGraphResponse>(cacheKey);
      if (!previous) return null;
      queryClient.setQueryData<FlowGraphResponse>(cacheKey, {
        ...previous,
        nodes: previous.nodes.map((n) =>
          n.id === node.id ? { ...n, data: { ...n.data, ...body } } : n
        ),
      });
      return () => queryClient.setQueryData(cacheKey, previous);
    },
  });
  const flush = debouncer.flush;

  const handleChange = (patch: Partial<FlowNodeData>) => {
    onUpdate(node.id, patch);
    const nextData = { ...data, ...patch };
    if (hasIncompleteActionPatch(nextData)) return;
    debouncer.schedule(nextData, (prev) => ({ ...data, ...(prev ?? {}), ...patch }));
  };

  const handleSceneKillToggle = (enabled: boolean) => {
    if (!theme || updateConfig.isPending || !isPhaseSceneNode) return;
    const nextConfig = writePlayerKillSceneEnabled(configJson, node.id, enabled);
    toastWithLoading.loading?.('장면 설정을 저장 중입니다', {
      id: `phase-kill-autosave-${node.id}`,
    });
    updateConfig.mutate(
      { ...nextConfig, version: theme.version },
      {
        onSuccess: () =>
          toast.success('장면 설정이 저장되었습니다', {
            id: `phase-kill-autosave-${node.id}`,
            duration: 1200,
          }),
        onError: (error) =>
          showUnknownErrorToast(error, '장면 설정 저장에 실패했습니다', {
            id: `phase-kill-autosave-${node.id}`,
          }),
      }
    );
  };

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">장면 설정</h3>
        {headerActions ? (
          <div className="flex shrink-0 items-center gap-1.5">{headerActions}</div>
        ) : null}
      </div>

      <PhasePanelBasicInfo
        label={data.label}
        phaseType={data.phase_type}
        onChange={handleChange}
        onFlush={flush}
      />
      {isPhaseSceneNode && playerKillEnabled ? (
        <label className="flex items-start gap-2 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-100">
          <input
            type="checkbox"
            aria-label="살해 가능 장면"
            checked={sceneKillEnabled}
            disabled={updateConfig.isPending}
            onChange={(event) => handleSceneKillToggle(event.currentTarget.checked)}
            className="mt-0.5 h-4 w-4 rounded border-red-500/40 bg-slate-950 text-red-500 focus:ring-red-500"
          />
          <span>
            <span className="block font-semibold">살해 가능</span>
            <span className="mt-1 block leading-4 text-red-100/70">
              이 장면에서만 플레이어킬 단서 사용이 사망 판정까지 진행됩니다.
            </span>
          </span>
        </label>
      ) : null}
      {isPhaseSceneNode ? (
        <section className="space-y-3 rounded-lg border border-slate-800 bg-slate-950/60 p-3">
          <div>
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              장면 액션
            </h4>
            <p className="mt-1 text-[11px] leading-4 text-slate-500">
              장면이 시작되거나 끝날 때 BGM, 알림, 단서 지급 같은 실행 결과를 순서대로 처리합니다.
            </p>
          </div>
          <ActionListEditor
            label="장면 시작 액션"
            actions={data.onEnter ?? []}
            allowedTypes={sceneActionTypes}
            actionOptions={sceneActionOptions}
            createDefaultParamsForType={createSceneActionParams}
            preserveDisallowedActions
            themeId={themeId}
            investigationTokens={investigationTokens}
            onChange={(actions) => handleChange({ onEnter: actions })}
          />
          <ActionListEditor
            label="장면 종료 액션"
            actions={data.onExit ?? []}
            allowedTypes={sceneActionTypes}
            actionOptions={sceneActionOptions}
            createDefaultParamsForType={createSceneActionParams}
            preserveDisallowedActions
            themeId={themeId}
            investigationTokens={investigationTokens}
            onChange={(actions) => handleChange({ onExit: actions })}
          />
        </section>
      ) : null}
      {phaseType === 'investigation' ? (
        <>
          <InvestigationMapField
            mapId={data.investigationMapId}
            maps={maps}
            isLoading={mapsLoading}
            onChange={handleChange}
            onFlush={flush}
          />
          <InvestigationPhasePanel
            duration={data.duration}
            onChange={handleChange}
            onFlush={flush}
          />
        </>
      ) : null}
      {phaseType === 'discussion' ? (
        <DiscussionPhasePanel
          duration={data.duration}
          policy={data.discussionRoomPolicy}
          onChange={handleChange}
          onFlush={flush}
        />
      ) : null}
      {phaseType === 'voting' ? (
        <VotingQuestionPhasePanel
          duration={data.duration}
          onChange={handleChange}
          onFlush={flush}
        />
      ) : null}
      {phaseType === 'story_progression' ? (
        <ReadingPhasePanel
          key={node.id}
          themeId={themeId}
          phaseData={data}
          onChange={handleChange}
        />
      ) : null}
    </div>
  );
}

function InvestigationMapField({
  mapId,
  maps,
  isLoading,
  onChange,
  onFlush,
}: {
  mapId?: string;
  maps: Array<{ id: string; name: string }>;
  isLoading: boolean;
  onChange: (patch: Partial<FlowNodeData>) => void;
  onFlush: () => void;
}) {
  const selectedMapExists = !mapId || maps.some((map) => map.id === mapId);
  const showMissingMapWarning = !isLoading && !selectedMapExists;

  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] text-slate-400">사용할 맵</span>
      <select
        value={mapId ?? ''}
        disabled={isLoading}
        aria-label="사용할 맵"
        onChange={(event) => onChange({ investigationMapId: event.target.value || undefined })}
        onBlur={onFlush}
        className="rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 focus:border-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <option value="">{maps.length === 0 ? '등록된 맵 없음' : '맵 선택'}</option>
        {maps.map((map) => (
          <option key={map.id} value={map.id}>
            {map.name}
          </option>
        ))}
      </select>
      <p className="text-[11px] leading-4 text-slate-500">
        이 수사 장면에서 플레이어에게 보여줄 장소 묶음입니다.
      </p>
      {showMissingMapWarning ? (
        <p className="rounded border border-amber-500/20 bg-amber-500/10 px-2 py-1.5 text-[11px] leading-4 text-amber-100">
          이전에 선택한 맵을 찾을 수 없습니다. 사용할 맵을 다시 선택해 주세요.
        </p>
      ) : null}
    </label>
  );
}

function hasIncompleteActionPatch(patch: Partial<FlowNodeData>): boolean {
  const onEnter = Array.isArray(patch.onEnter) ? (patch.onEnter as PhaseAction[]) : null;
  const onExit = Array.isArray(patch.onExit) ? (patch.onExit as PhaseAction[]) : null;
  return (
    (onEnter ? hasIncompletePresentationCueActions(onEnter) : false) ||
    (onExit ? hasIncompletePresentationCueActions(onExit) : false)
  );
}
