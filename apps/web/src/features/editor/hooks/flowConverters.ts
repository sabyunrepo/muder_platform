import type { Node, Edge } from "@xyflow/react";
import type {
  FlowNodeResponse,
  FlowEdgeResponse,
  SaveFlowRequest,
} from "../flowTypes";
import { isCompleteConditionGroupRecord } from "../components/design/condition/conditionTypes";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const nonUuidEdgeIdMap = new Map<string, string>();

// ---------------------------------------------------------------------------
// Converters: server ↔ ReactFlow
// ---------------------------------------------------------------------------

export function toReactFlowNode(node: FlowNodeResponse): Node {
  return {
    id: node.id,
    type: node.type,
    position: { x: node.position_x, y: node.position_y },
    data: { ...node.data },
  };
}

export function toReactFlowEdge(edge: FlowEdgeResponse): Edge {
  return {
    id: edge.id,
    source: edge.source_id,
    target: edge.target_id,
    label: edge.label ?? undefined,
    data: { condition: edge.condition, sort_order: edge.sort_order },
  };
}

export function toSaveRequest(nodes: Node[], edges: Edge[]): SaveFlowRequest {
  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      type: (n.type ?? "phase") as FlowNodeResponse["type"],
      data: n.data as FlowNodeResponse["data"],
      position_x: n.position.x,
      position_y: n.position.y,
    })),
    edges: edges.map((e, i) => ({
      id: toPersistableEdgeId(e.id),
      source_id: e.source,
      target_id: e.target,
      condition: toPersistedCondition(e.data),
      label: typeof e.label === "string" ? e.label : null,
      sort_order: i,
    })),
  };
}

function toPersistableEdgeId(id: string): string {
  if (UUID_RE.test(id)) {
    return id;
  }
  const cached = nonUuidEdgeIdMap.get(id);
  if (cached) {
    return cached;
  }
  const next = crypto.randomUUID();
  nonUuidEdgeIdMap.set(id, next);
  return next;
}

function toPersistedCondition(data: Edge["data"]): Record<string, unknown> | null {
  const condition =
    (data as { condition?: Record<string, unknown> } | undefined)?.condition ??
    null;
  return isCompleteConditionGroupRecord(condition) ? condition : null;
}
