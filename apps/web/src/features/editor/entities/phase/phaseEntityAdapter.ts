import type { Edge } from "@xyflow/react";
import type { FlowNodeData } from "../../flowTypes";
import { isCompleteConditionGroupRecord } from "../../components/design/condition/conditionTypes";
import {
  DELIVER_INFORMATION_ACTION,
  LEGACY_DELIVER_INFORMATION_ACTION,
  flowNodeToInformationDeliveries,
  informationDeliveriesToFlowNodePatch,
  isCompleteInformationDelivery,
  isInformationDeliveryAction,
  makeEmptyInformationDelivery,
  type InformationDeliveryViewModel,
  type InformationRecipientType,
} from "../shared/informationDeliveryAdapter";
import { toCreatorActionLabels } from "../shared/actionAdapter";
import type { DiscussionRoomPolicy } from "../../flowTypes";

const PHASE_TYPE_LABELS: Record<string, string> = {
  investigation: "수사",
  discussion: "토론",
  voting: "투표",
  free: "자유",
  intermission: "인터미션",
  story_progression: "스토리 진행",
};

export interface PhaseEditorViewModel {
  title: string;
  phaseType: string;
  phaseTypeLabel: string;
  durationLabel: string;
  roundLabel: string;
  autoAdvanceLabel: string;
  warningLabel: string;
  informationDeliveryCount: number;
  enterActionLabels: string[];
  exitActionLabels: string[];
  defaultTransitionLabel: string;
  conditionalTransitionCount: number;
  discussionRoomPolicy?: DiscussionRoomPolicy;
}

export {
  DELIVER_INFORMATION_ACTION,
  LEGACY_DELIVER_INFORMATION_ACTION,
  flowNodeToInformationDeliveries,
  informationDeliveriesToFlowNodePatch,
  isCompleteInformationDelivery,
  isInformationDeliveryAction as isDeliverInformationAction,
  makeEmptyInformationDelivery,
  type InformationDeliveryViewModel,
  type InformationRecipientType,
};

export function toPhaseEditorViewModel(
  data: FlowNodeData,
  outgoingEdges: Edge[] = [],
): PhaseEditorViewModel {
  const phaseType = data.phase_type || "investigation";
  const defaultEdges = outgoingEdges.filter((edge) => !hasEdgeCondition(edge));
  const conditionalEdges = outgoingEdges.filter(hasEdgeCondition);

  return {
    title: data.label?.trim() || "새 장면",
    phaseType,
    phaseTypeLabel: PHASE_TYPE_LABELS[phaseType] ?? "직접 설정한 페이즈",
    durationLabel: formatMinutes(data.duration),
    roundLabel: formatRounds(data.rounds),
    autoAdvanceLabel: data.autoAdvance === false ? "수동 진행" : "자동 진행",
    warningLabel: data.warningAt ? `${data.warningAt}초 전에 경고` : "경고 없음",
    informationDeliveryCount: flowNodeToInformationDeliveries(data).length,
    enterActionLabels: toCreatorActionLabels(data.onEnter ?? [], {
      excludeInformationDelivery: true,
    }),
    exitActionLabels: toCreatorActionLabels(data.onExit ?? [], {
      excludeInformationDelivery: true,
    }),
    defaultTransitionLabel: formatDefaultTransition(defaultEdges.length),
    conditionalTransitionCount: conditionalEdges.length,
    discussionRoomPolicy: data.discussionRoomPolicy,
  };
}

export function getPhaseTypeLabel(phaseType?: string): string {
  if (!phaseType) return PHASE_TYPE_LABELS.investigation;
  return PHASE_TYPE_LABELS[phaseType] ?? "직접 설정한 페이즈";
}

function formatMinutes(value?: number): string {
  if (value == null || value <= 0) return "시간 미설정";
  return `${value}분`;
}

function formatRounds(value?: number): string {
  if (value == null || value <= 0) return "라운드 미설정";
  return `${value}라운드`;
}

function formatDefaultTransition(count: number): string {
  if (count === 0) return "기본 이동 없음";
  if (count === 1) return "기본 이동 1개";
  return `기본 이동 ${count}개`;
}

function hasEdgeCondition(edge: Edge): boolean {
  const condition = (edge.data as { condition?: unknown } | undefined)?.condition;
  return isCompleteConditionGroupRecord(condition);
}
