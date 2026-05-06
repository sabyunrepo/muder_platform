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
import {
  DELIVER_INFORMATION_ACTION,
  toPhaseEditorViewModel,
  type PhaseEditorViewModel,
} from "../../entities/phase/phaseEntityAdapter";
import { PhasePanelBasicInfo } from "./PhasePanelBasicInfo";
import { PhasePanelTimerSettings } from "./PhasePanelTimerSettings";
import { PhasePanelAdvanceToggle } from "./PhasePanelAdvanceToggle";
import { DiscussionRoomPolicyPanel } from "./DiscussionRoomPolicyPanel";
import { formatDiscussionRoomSummary } from "../../entities/phase/discussionRoomPolicyAdapter";

interface PhaseNodePanelProps {
  node: Node;
  themeId: string;
  onUpdate: (id: string, data: Partial<FlowNodeData>) => void;
  edges?: Edge[];
}

/** Debounce window for flow-node saves (W2 PR-5: 500→1500ms). */
const SAVE_DEBOUNCE_MS = 1500;

export function PhaseNodePanel({ node, themeId, onUpdate, edges = [] }: PhaseNodePanelProps) {
  const updateNode = useUpdateFlowNode(themeId);
  const queryClient = useQueryClient();
  const data = node.data as FlowNodeData;
  const viewModel = toPhaseEditorViewModel(
    data,
    edges.filter((edge) => edge.source === node.id),
  );

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

      <PhaseSummaryCard viewModel={viewModel} />

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

      <InformationDeliveryPanel
        key={node.id}
        themeId={themeId}
        phaseData={data}
        onChange={handleChange}
      />

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
  return [
    ...currentActions.filter((action) => !isPresentationCueAction(action)),
    ...presentationActions,
  ];
}

function hasIncompleteActionPatch(patch: Partial<FlowNodeData>): boolean {
  const onEnter = Array.isArray(patch.onEnter) ? (patch.onEnter as PhaseAction[]) : null;
  const onExit = Array.isArray(patch.onExit) ? (patch.onExit as PhaseAction[]) : null;
  return (
    (onEnter ? hasIncompletePresentationCueActions(onEnter) : false) ||
    (onExit ? hasIncompletePresentationCueActions(onExit) : false)
  );
}


function PhaseSummaryCard({ viewModel }: { viewModel: PhaseEditorViewModel }) {
  const enterActions = viewModel.enterActionLabels.length > 0
    ? viewModel.enterActionLabels.join(", ")
    : "시작 변화 없음";
  const exitActions = viewModel.exitActionLabels.length > 0
    ? viewModel.exitActionLabels.join(", ")
    : "마무리 변화 없음";

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
      <div className="flex flex-col gap-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-300/80">
          장면 요약
        </p>
        <h4 className="text-sm font-semibold text-slate-100">{viewModel.title}</h4>
        <p className="text-xs leading-5 text-slate-500">
          {viewModel.phaseTypeLabel} · {viewModel.durationLabel} · {viewModel.roundLabel}
        </p>
      </div>

      <dl className="mt-3 grid gap-2 text-xs text-slate-400">
        <SummaryRow label="진행 방식" value={`${viewModel.autoAdvanceLabel} · ${viewModel.warningLabel}`} />
        <SummaryRow
          label="다음 이동"
          value={`${viewModel.defaultTransitionLabel} · 조건 이동 ${viewModel.conditionalTransitionCount}개`}
        />
        <SummaryRow label="정보 공개" value={`${viewModel.informationDeliveryCount}개 설정`} />
        <SummaryRow label="토론방" value={formatDiscussionRoomSummary(viewModel.discussionRoomPolicy)} />
        <SummaryRow label="시작 트리거" value={enterActions} />
        <SummaryRow label="종료 트리거" value={exitActions} />
      </dl>
    </section>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded border border-slate-800/80 bg-slate-900/50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
      <dt className="text-[11px] text-slate-500">{label}</dt>
      <dd className="text-slate-200">{value}</dd>
    </div>
  );
}
