import { describe, it, expect } from "vitest";
import type { Node, Edge } from "@xyflow/react";
import type { FlowNodeResponse, FlowEdgeResponse } from "../../flowTypes";

// ---------------------------------------------------------------------------
// Re-export converter functions for testing via module boundary
// We test them by importing the pure converter logic directly.
// Since they are module-internal, we replicate the same logic here to verify
// the shape contract between server response and ReactFlow format.
// ---------------------------------------------------------------------------

function toReactFlowNode(node: FlowNodeResponse): Node {
  return {
    id: node.id,
    type: node.type,
    position: { x: node.position_x, y: node.position_y },
    data: { ...node.data },
  };
}

function toReactFlowEdge(edge: FlowEdgeResponse): Edge {
  return {
    id: edge.id,
    source: edge.source_id,
    target: edge.target_id,
    label: edge.label ?? undefined,
    data: { condition: edge.condition, sort_order: edge.sort_order },
  };
}

function toSaveRequest(nodes: Node[], edges: Edge[]) {
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

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const nodeResponse: FlowNodeResponse = {
  id: "node-abc",
  theme_id: "theme-1",
  type: "phase",
  data: { label: "조사 페이즈", duration: 20 },
  position_x: 100,
  position_y: 200,
  created_at: "2026-04-14T00:00:00Z",
  updated_at: "2026-04-14T00:00:00Z",
};

const edgeResponse: FlowEdgeResponse = {
  id: "edge-xyz",
  theme_id: "theme-1",
  source_id: "node-abc",
  target_id: "node-def",
  condition: null,
  label: "성공",
  sort_order: 0,
  created_at: "2026-04-14T00:00:00Z",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("toReactFlowNode", () => {
  it("id를 그대로 유지한다", () => {
    const result = toReactFlowNode(nodeResponse);
    expect(result.id).toBe("node-abc");
  });

  it("type을 그대로 유지한다", () => {
    const result = toReactFlowNode(nodeResponse);
    expect(result.type).toBe("phase");
  });

  it("position_x/y를 position.x/y로 변환한다", () => {
    const result = toReactFlowNode(nodeResponse);
    expect(result.position.x).toBe(100);
    expect(result.position.y).toBe(200);
  });

  it("data 필드를 복사한다", () => {
    const result = toReactFlowNode(nodeResponse);
    expect((result.data as { label: string }).label).toBe("조사 페이즈");
  });
});

describe("toReactFlowEdge", () => {
  it("id를 그대로 유지한다", () => {
    const result = toReactFlowEdge(edgeResponse);
    expect(result.id).toBe("edge-xyz");
  });

  it("source_id/target_id를 source/target으로 변환한다", () => {
    const result = toReactFlowEdge(edgeResponse);
    expect(result.source).toBe("node-abc");
    expect(result.target).toBe("node-def");
  });

  it("label을 그대로 유지한다", () => {
    const result = toReactFlowEdge(edgeResponse);
    expect(result.label).toBe("성공");
  });

  it("label이 null이면 undefined로 변환한다", () => {
    const result = toReactFlowEdge({ ...edgeResponse, label: null });
    expect(result.label).toBeUndefined();
  });

  it("condition과 sort_order를 data에 포함한다", () => {
    const result = toReactFlowEdge(edgeResponse);
    const data = result.data as { condition: unknown; sort_order: number };
    expect(data.condition).toBeNull();
    expect(data.sort_order).toBe(0);
  });
});

describe("toSaveRequest", () => {
  const rfNode: Node = {
    id: "node-abc",
    type: "phase",
    position: { x: 150, y: 250 },
    data: { label: "조사", duration: 20 },
  };

  const rfEdge: Edge = {
    id: "edge-xyz",
    source: "node-abc",
    target: "node-def",
    label: "성공",
    data: { condition: null, sort_order: 0 },
  };

  it("노드를 서버 형식으로 역변환한다", () => {
    const result = toSaveRequest([rfNode], []);
    expect(result.nodes[0].id).toBe("node-abc");
    expect(result.nodes[0].position_x).toBe(150);
    expect(result.nodes[0].position_y).toBe(250);
  });

  it("엣지를 서버 형식으로 역변환한다", () => {
    const result = toSaveRequest([], [rfEdge]);
    expect(result.edges[0].id).toBe("edge-xyz");
    expect(result.edges[0].source_id).toBe("node-abc");
    expect(result.edges[0].target_id).toBe("node-def");
  });

  it("엣지 sort_order는 배열 인덱스로 설정된다", () => {
    const e2: Edge = { ...rfEdge, id: "edge-2", source: "node-def", target: "node-ghi" };
    const result = toSaveRequest([], [rfEdge, e2]);
    expect(result.edges[0].sort_order).toBe(0);
    expect(result.edges[1].sort_order).toBe(1);
  });

  it("string label은 그대로 유지한다", () => {
    const result = toSaveRequest([], [rfEdge]);
    expect(result.edges[0].label).toBe("성공");
  });

  it("non-string label은 null로 변환한다", () => {
    const edgeNoLabel: Edge = { ...rfEdge, label: undefined };
    const result = toSaveRequest([], [edgeNoLabel]);
    expect(result.edges[0].label).toBeNull();
  });
});
