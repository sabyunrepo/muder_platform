import type { Edge, Node } from "@xyflow/react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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
        <InvestigationPhasePanel
          duration={data.duration}
          onChange={handleChange}
          onFlush={flush}
        />
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

function hasIncompleteActionPatch(patch: Partial<FlowNodeData>): boolean {
  const onEnter = Array.isArray(patch.onEnter) ? (patch.onEnter as PhaseAction[]) : null;
  const onExit = Array.isArray(patch.onExit) ? (patch.onExit as PhaseAction[]) : null;
  return (
    (onEnter ? hasIncompletePresentationCueActions(onEnter) : false) ||
    (onExit ? hasIncompletePresentationCueActions(onExit) : false)
  );
}
