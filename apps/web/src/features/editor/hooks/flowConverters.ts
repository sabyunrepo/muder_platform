import type { Node, Edge } from "@xyflow/react";
import type {
  FlowNodeResponse,
  FlowEdgeResponse,
  SaveFlowRequest,
} from "../flowTypes";

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
      id: e.id,
      source_id: e.source,
      target_id: e.target,
      condition:
        (e.data as { condition?: Record<string, unknown> } | undefined)
          ?.condition ?? null,
      label: typeof e.label === "string" ? e.label : null,
      sort_order: i,
    })),
  };
}
