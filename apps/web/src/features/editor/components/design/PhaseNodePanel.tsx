import type { Edge, Node } from "@xyflow/react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useEditorMaps } from "../../editorMapApi";
import { useUpdateFlowNode } from "../../flowApi";
import type {
  FlowGraphResponse,
  FlowNodeData,
  PhaseAction,
} from "../../flowTypes";
import { flowKeys } from "../../flowTypes";
import { useDebouncedMutation } from "@/hooks/useDebouncedMutation";
import { hasIncompletePresentationCueActions } from "./ActionListEditor";
import { PhasePanelBasicInfo } from "./PhasePanelBasicInfo";
import { normalizePhaseType } from "./phaseTypeOptions";
import { InvestigationPhasePanel } from "./InvestigationPhasePanel";
import { DiscussionPhasePanel } from "./DiscussionPhasePanel";
import { VotingQuestionPhasePanel } from "./VotingQuestionPhasePanel";
import { ReadingPhasePanel } from "./ReadingPhasePanel";

interface PhaseNodePanelProps {
  node: Node;
  themeId: string;
  onUpdate: (id: string, data: Partial<FlowNodeData>) => void;
  edges?: Edge[];
}

/** Debounce window for flow-node saves (W2 PR-5: 500→1500ms). */
const SAVE_DEBOUNCE_MS = 1500;

export function PhaseNodePanel({ node, themeId, onUpdate }: PhaseNodePanelProps) {
  const updateNode = useUpdateFlowNode(themeId);
  const { data: maps = [], isLoading: mapsLoading } = useEditorMaps(themeId);
  const queryClient = useQueryClient();
  const data = node.data as FlowNodeData;
  const phaseType = normalizePhaseType(data.phase_type);

  const debouncer = useDebouncedMutation<FlowNodeData>({
    debounceMs: SAVE_DEBOUNCE_MS,
    mutate: (body, opts) =>
      updateNode.mutate({ nodeId: node.id, body: { data: body } }, opts),
    applyOptimistic: (body) => {
      const cacheKey = flowKeys.graph(themeId);
      const previous = queryClient.getQueryData<FlowGraphResponse>(cacheKey);
      if (!previous) return null;
      queryClient.setQueryData<FlowGraphResponse>(cacheKey, {
        ...previous,
        nodes: previous.nodes.map((n) =>
          n.id === node.id ? { ...n, data: { ...n.data, ...body } } : n,
        ),
      });
      return () => queryClient.setQueryData(cacheKey, previous);
    },
    onError: () => toast.error("저장에 실패했습니다"),
  });
  const flush = debouncer.flush;

  const handleChange = (patch: Partial<FlowNodeData>) => {
    onUpdate(node.id, patch);
    const nextData = { ...data, ...patch };
    if (hasIncompleteActionPatch(nextData)) return;
    debouncer.schedule(
      nextData,
      (prev) => ({ ...data, ...(prev ?? {}), ...patch }),
    );
  };

  return (
    <div className="flex flex-col gap-3 p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        장면 설정
      </h3>

      <PhasePanelBasicInfo
        label={data.label}
        phaseType={data.phase_type}
        onChange={handleChange}
        onFlush={flush}
      />
      {phaseType === "investigation" ? (
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
      {phaseType === "discussion" ? (
        <DiscussionPhasePanel
          duration={data.duration}
          policy={data.discussionRoomPolicy}
          onChange={handleChange}
          onFlush={flush}
        />
      ) : null}
      {phaseType === "voting" ? (
        <VotingQuestionPhasePanel
          duration={data.duration}
          onChange={handleChange}
          onFlush={flush}
        />
      ) : null}
      {phaseType === "story_progression" ? (
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

  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] text-slate-400">사용할 맵</span>
      <select
        value={mapId ?? ""}
        disabled={isLoading}
        aria-label="사용할 맵"
        onChange={(event) =>
          onChange({ investigationMapId: event.target.value || undefined })
        }
        onBlur={onFlush}
        className="rounded border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 focus:border-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <option value="">
          {maps.length === 0 ? "등록된 맵 없음" : "맵 선택"}
        </option>
        {maps.map((map) => (
          <option key={map.id} value={map.id}>
            {map.name}
          </option>
        ))}
      </select>
      <p className="text-[11px] leading-4 text-slate-500">
        이 수사 장면에서 플레이어에게 보여줄 장소 묶음입니다.
      </p>
      {!selectedMapExists ? (
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
