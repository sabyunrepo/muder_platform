import { describe, it, expect } from "vitest";
import { toReactFlowNode, toReactFlowEdge, toSaveRequest } from "../flowConverters";
import type { FlowNodeResponse, FlowEdgeResponse } from "../../flowTypes";

const baseNode: FlowNodeResponse = {
  id: "node-1",
  theme_id: "theme-1",
  type: "phase",
  data: { label: "조사" },
  position_x: 100,
  position_y: 200,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const baseEdge: FlowEdgeResponse = {
  id: "edge-1",
  theme_id: "theme-1",
  source_id: "node-1",
  target_id: "node-2",
  condition: null,
  label: "기본",
  sort_order: 0,
  created_at: "2026-01-01T00:00:00Z",
};

const completeCondition = {
  id: "group-1",
  operator: "AND",
  rules: [
    {
      id: "rule-1",
      variable: "custom_flag",
      target_flag_key: "manual_override",
      comparator: "=",
      value: "true",
    },
  ],
};

describe("toReactFlowNode", () => {
  it("maps server node to ReactFlow node", () => {
    const result = toReactFlowNode(baseNode);
    expect(result.id).toBe("node-1");
    expect(result.type).toBe("phase");
    expect(result.position).toEqual({ x: 100, y: 200 });
    expect(result.data).toEqual({ label: "조사" });
  });
});

describe("toReactFlowEdge", () => {
  it("maps server edge to ReactFlow edge", () => {
    const result = toReactFlowEdge(baseEdge);
    expect(result.id).toBe("edge-1");
    expect(result.source).toBe("node-1");
    expect(result.target).toBe("node-2");
    expect(result.label).toBe("기본");
  });

  it("null label becomes undefined", () => {
    const result = toReactFlowEdge({ ...baseEdge, label: null });
    expect(result.label).toBeUndefined();
  });
});

describe("toSaveRequest", () => {
  it("converts nodes and edges to save request format", () => {
    const rfNode = toReactFlowNode(baseNode);
    const rfEdge = toReactFlowEdge(baseEdge);
    const req = toSaveRequest([rfNode], [rfEdge]);

    expect(req.nodes).toHaveLength(1);
    expect(req.nodes[0].id).toBe("node-1");
    expect(req.nodes[0].position_x).toBe(100);
    expect(req.nodes[0].position_y).toBe(200);

    expect(req.edges).toHaveLength(1);
    expect(req.edges[0].source_id).toBe("node-1");
    expect(req.edges[0].target_id).toBe("node-2");
    expect(req.edges[0].sort_order).toBe(0);
  });

  it("완성된 조건만 저장 요청에 포함한다", () => {
    const rfNode = toReactFlowNode(baseNode);
    const rfEdge = {
      ...toReactFlowEdge(baseEdge),
      data: { condition: completeCondition },
    };
    const req = toSaveRequest([rfNode], [rfEdge]);

    expect(req.edges[0].condition).toEqual(completeCondition);
  });

  it("미완성 조건 draft는 저장 요청에서 제외한다", () => {
    const rfNode = toReactFlowNode(baseNode);
    const rfEdge = {
      ...toReactFlowEdge(baseEdge),
      data: {
        condition: {
          id: "group-1",
          operator: "AND",
          rules: [
            {
              id: "rule-1",
              variable: "scene_visit_count",
              comparator: ">=",
              value: "1",
            },
          ],
        },
      },
    };
    const req = toSaveRequest([rfNode], [rfEdge]);

    expect(req.edges[0].condition).toBeNull();
  });
});
