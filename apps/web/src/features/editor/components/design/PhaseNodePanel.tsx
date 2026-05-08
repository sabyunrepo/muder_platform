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
import {
  ActionListEditor,
  hasIncompletePresentationCueActions,
  isPresentationCueAction,
  PRESENTATION_CUE_ACTION_TYPES,
} from "./ActionListEditor";
import { InformationDeliveryPanel } from "./InformationDeliveryPanel";
import { StoryProgressionPanel } from "./StoryProgressionPanel";
import { DELIVER_INFORMATION_ACTION } from "../../entities/phase/phaseEntityAdapter";
import { PhasePanelBasicInfo } from "./PhasePanelBasicInfo";
import { PhasePanelTimerSettings } from "./PhasePanelTimerSettings";
import { PhasePanelAdvanceToggle } from "./PhasePanelAdvanceToggle";
import { DiscussionRoomPolicyPanel } from "./DiscussionRoomPolicyPanel";

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
  const isStoryProgression = data.phase_type === "story_progression";

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
      <PhasePanelTimerSettings
        duration={data.duration}
        rounds={data.rounds}
        onChange={handleChange}
        onFlush={flush}
      />
      <PhasePanelAdvanceToggle
        autoAdvance={data.autoAdvance}
        warningAt={data.warningAt}
        onChange={handleChange}
        onFlush={flush}
      />

      <div className="border-t border-slate-800" />

      {isStoryProgression ? (
        <StoryProgressionPanel
          key={node.id}
          themeId={themeId}
          phaseData={data}
          onChange={handleChange}
        />
      ) : (
        <InformationDeliveryPanel
          key={node.id}
          themeId={themeId}
          phaseData={data}
          onChange={handleChange}
        />
      )}

      <div className="border-t border-slate-800" />

      <DiscussionRoomPolicyPanel
        policy={data.discussionRoomPolicy}
        onChange={(discussionRoomPolicy) => handleChange({ discussionRoomPolicy })}
      />

      <div className="border-t border-slate-800" />

      <ActionListEditor
        label="장면 연출"
        actions={getPresentationCueActions((data.onEnter as PhaseAction[]) ?? [])}
        onChange={(actions) => handleChange({
          onEnter: mergePresentationCueActions((data.onEnter as PhaseAction[]) ?? [], actions),
        })}
        allowedTypes={PRESENTATION_CUE_ACTION_TYPES}
        themeId={themeId}
      />

      <div className="border-t border-slate-800" />

      <ActionListEditor
        label="장면 시작 트리거"
        actions={(data.onEnter as PhaseAction[]) ?? []}
        onChange={(actions) => handleChange({ onEnter: actions })}
        hiddenTypes={[
          ...PRESENTATION_CUE_ACTION_TYPES,
          DELIVER_INFORMATION_ACTION,
          "deliver_information",
        ]}
        themeId={themeId}
      />
      <ActionListEditor
        label="장면 종료 트리거"
        actions={(data.onExit as PhaseAction[]) ?? []}
        onChange={(actions) => handleChange({ onExit: actions })}
        themeId={themeId}
      />
    </div>
  );
}

function getPresentationCueActions(actions: PhaseAction[]): PhaseAction[] {
  return actions.filter(isPresentationCueAction);
}

function mergePresentationCueActions(
  currentActions: PhaseAction[],
  presentationActions: PhaseAction[],
): PhaseAction[] {
  const remainingPresentationActions = [...presentationActions];

  const mergedActions = currentActions.flatMap((action) => {
    if (!isPresentationCueAction(action)) {
      return [action];
    }

    const replacementAction = remainingPresentationActions.shift();
    return replacementAction ? [replacementAction] : [];
  });

  return [...mergedActions, ...remainingPresentationActions];
}

function hasIncompleteActionPatch(patch: Partial<FlowNodeData>): boolean {
  const onEnter = Array.isArray(patch.onEnter) ? (patch.onEnter as PhaseAction[]) : null;
  const onExit = Array.isArray(patch.onExit) ? (patch.onExit as PhaseAction[]) : null;
  return (
    (onEnter ? hasIncompletePresentationCueActions(onEnter) : false) ||
    (onExit ? hasIncompletePresentationCueActions(onExit) : false)
  );
}
