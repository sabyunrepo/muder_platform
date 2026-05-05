import type { Edge, Node } from "@xyflow/react";
import type {
  FlowEdgeResponse,
  FlowGraphResponse,
  FlowNodeData,
} from "../../flowTypes";
import { isCompleteConditionGroupRecord } from "../../components/design/condition/conditionTypes";
import { toPhaseEditorViewModel } from "../phase/phaseEntityAdapter";

export interface StorySceneViewModel {
  id: string;
  title: string;
  typeLabel: string;
  informationLabel: string;
  transitionLabel: string;
  startActionLabel: string;
  endActionLabel: string;
}

export interface StorySceneFlowSummary {
  scenes: StorySceneViewModel[];
  sceneCountLabel: string;
  transitionCountLabel: string;
  conditionalTransitionCountLabel: string;
}

export function toStorySceneFlowSummary(
  nodes: Node[],
  edges: Edge[],
): StorySceneFlowSummary {
  const scenes = nodes
    .filter((node) => node.type === "phase")
    .sort(compareSceneNodes)
    .map((node) => toStorySceneViewModel(node, edges));
  const conditionalCount = edges.filter(hasCompleteCondition).length;

  return {
    scenes,
    sceneCountLabel: `${scenes.length}개 장면`,
    transitionCountLabel: `${edges.length}개 이동`,
    conditionalTransitionCountLabel: conditionalCount === 0
      ? "조건 이동 없음"
      : `조건 이동 ${conditionalCount}개`,
  };
}

export function toStorySceneFlowSummaryFromGraph(
  graph: FlowGraphResponse | undefined,
): StorySceneFlowSummary {
  return toStorySceneFlowSummary(
    (graph?.nodes ?? []).map((node) => ({
      id: node.id,
      type: node.type,
      position: { x: node.position_x, y: node.position_y },
      data: node.data,
    })),
    (graph?.edges ?? []).map(toStorySceneEdge),
  );
}

function toStorySceneViewModel(node: Node, edges: Edge[]): StorySceneViewModel {
  const outgoingEdges = edges.filter((edge) => edge.source === node.id);
  const phaseViewModel = toPhaseEditorViewModel(
    node.data as FlowNodeData,
    outgoingEdges,
  );

  return {
    id: node.id,
    title: phaseViewModel.title,
    typeLabel: phaseViewModel.phaseTypeLabel,
    informationLabel: `${phaseViewModel.informationDeliveryCount}개 정보 공개`,
    transitionLabel: [
      phaseViewModel.defaultTransitionLabel,
      `조건 이동 ${phaseViewModel.conditionalTransitionCount}개`,
    ].join(" · "),
    startActionLabel: formatActionCount(phaseViewModel.enterActionLabels.length),
    endActionLabel: formatActionCount(phaseViewModel.exitActionLabels.length),
  };
}

function compareSceneNodes(left: Node, right: Node): number {
  if (left.position.y !== right.position.y) return left.position.y - right.position.y;
  if (left.position.x !== right.position.x) return left.position.x - right.position.x;
  return left.id.localeCompare(right.id);
}

function formatActionCount(count: number): string {
  if (count === 0) return "변화 없음";
  return `변화 ${count}개`;
}

function toStorySceneEdge(edge: FlowEdgeResponse): Edge {
  return {
    id: edge.id,
    source: edge.source_id,
    target: edge.target_id,
    label: edge.label ?? undefined,
    data: { condition: edge.condition, sort_order: edge.sort_order },
  };
}

function hasCompleteCondition(edge: Edge): boolean {
  const condition = (edge.data as { condition?: unknown } | undefined)?.condition;
  return isCompleteConditionGroupRecord(condition);
}
