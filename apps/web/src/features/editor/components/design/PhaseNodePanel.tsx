import type { Node } from "@xyflow/react";
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
import { ActionListEditor } from "./ActionListEditor";
import { PhasePanelBasicInfo } from "./PhasePanelBasicInfo";
import { PhasePanelTimerSettings } from "./PhasePanelTimerSettings";
import { PhasePanelAdvanceToggle } from "./PhasePanelAdvanceToggle";

interface PhaseNodePanelProps {
  node: Node;
  themeId: string;
  onUpdate: (id: string, data: Partial<FlowNodeData>) => void;
}

/** Debounce window for flow-node saves (W2 PR-5: 500→1500ms). */
const SAVE_DEBOUNCE_MS = 1500;

export function PhaseNodePanel({ node, themeId, onUpdate }: PhaseNodePanelProps) {
  const updateNode = useUpdateFlowNode(themeId);
  const queryClient = useQueryClient();
  const data = node.data as FlowNodeData;

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
    debouncer.schedule(
      { ...data, ...patch },
      (prev) => ({ ...data, ...(prev ?? {}), ...patch }),
    );
  };

  return (
    <div className="flex flex-col gap-3 p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        페이즈 설정
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

      <ActionListEditor
        label="진입 액션 (onEnter)"
        actions={(data.onEnter as PhaseAction[]) ?? []}
        onChange={(actions) => handleChange({ onEnter: actions })}
      />
      <ActionListEditor
        label="퇴장 액션 (onExit)"
        actions={(data.onExit as PhaseAction[]) ?? []}
        onChange={(actions) => handleChange({ onExit: actions })}
      />
    </div>
  );
}
