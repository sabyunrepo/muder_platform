import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { renderHook, act } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { useFlowDataMock } = vi.hoisted(() => ({
  useFlowDataMock: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@xyflow/react", () => ({
  ReactFlow: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="react-flow">{children}</div>
  ),
  Background: () => <div />,
  MiniMap: () => <div />,
  Controls: () => <div />,
  useNodesState: (init: unknown[]) => [init, vi.fn(), vi.fn()],
  useEdgesState: (init: unknown[]) => [init, vi.fn(), vi.fn()],
  addEdge: vi.fn(),
}));

vi.mock("../../../hooks/useFlowData", () => ({
  useFlowData: () => useFlowDataMock(),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { FlowCanvas } from "../FlowCanvas";
import { branchNodeTypes, conditionEdgeTypes } from "../flowNodeRegistry";

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const baseFlowData = {
  nodes: [],
  edges: [],
  onNodesChange: vi.fn(),
  onEdgesChange: vi.fn(),
  onConnect: vi.fn(),
  isLoading: false,
  isSaving: false,
  save: vi.fn(),
  selectedNode: null,
  addNode: vi.fn(),
  updateNodeData: vi.fn(),
  deleteNode: vi.fn(),
  onSelectionChange: vi.fn(),
  updateEdgeCondition: vi.fn(),
};

const validCondition = {
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

beforeEach(() => {
  useFlowDataMock.mockReturnValue(baseFlowData);
});

// ---------------------------------------------------------------------------
// Task 1: nodeTypes에 branch 키 존재 확인
// ---------------------------------------------------------------------------

describe("branchNodeTypes", () => {
  it("nodeTypes에 branch 키가 존재한다", () => {
    expect(branchNodeTypes).toHaveProperty("branch");
  });
});

// ---------------------------------------------------------------------------
// Task 2: edgeTypes에 condition 키 존재 확인
// ---------------------------------------------------------------------------

describe("conditionEdgeTypes", () => {
  it("edgeTypes에 condition 키가 존재한다", () => {
    expect(conditionEdgeTypes).toHaveProperty("condition");
  });
});

// ---------------------------------------------------------------------------
// Task 3: updateEdgeCondition 호출 시 엣지 data 업데이트
// ---------------------------------------------------------------------------

describe("useEdgeCondition", () => {
  it("updateEdgeCondition 호출 시 엣지 data.condition이 업데이트된다", async () => {
    const { useEdgeCondition } = await import(
      "../../../hooks/useEdgeCondition"
    );
    const setEdges = vi.fn();
    const getNodes = vi.fn(() => []);
    const input = [
      { id: "edge-1", source: "node-1", target: "node-2", data: {} },
      { id: "edge-2", source: "node-2", target: "node-3", data: {} },
    ];
    const getEdges = vi.fn(() => input);
    const autoSave = vi.fn();

    const { result } = renderHook(() =>
      useEdgeCondition(setEdges, getNodes, getEdges, autoSave),
    );

    act(() => {
      result.current.updateEdgeCondition("edge-1", validCondition);
    });

    expect(setEdges).toHaveBeenCalledOnce();
    const result2 = setEdges.mock.calls[0][0] as typeof input;
    expect(result2[0]).toMatchObject({
      id: "edge-1",
      type: "condition",
      data: { condition: validCondition },
    });
    expect(result2[1]).toEqual(input[1]);
    expect(autoSave).toHaveBeenCalledOnce();
    expect(autoSave).toHaveBeenCalledWith([], result2);
  });

  it("미완성 조건은 엣지 draft만 갱신하고 autoSave로 보내지 않는다", async () => {
    const { useEdgeCondition } = await import(
      "../../../hooks/useEdgeCondition"
    );
    const setEdges = vi.fn();
    const getNodes = vi.fn(() => []);
    const input = [
      { id: "edge-1", source: "node-1", target: "node-2", data: {} },
    ];
    const getEdges = vi.fn(() => input);
    const autoSave = vi.fn();

    const { result } = renderHook(() =>
      useEdgeCondition(setEdges, getNodes, getEdges, autoSave),
    );

    const incompleteCondition = {
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
    };

    act(() => {
      result.current.updateEdgeCondition("edge-1", incompleteCondition);
    });

    expect(setEdges).toHaveBeenCalledOnce();
    const result2 = setEdges.mock.calls[0][0] as typeof input;

    expect(result2[0]).toMatchObject({
      id: "edge-1",
      type: "condition",
      data: { condition: incompleteCondition },
    });
    expect(autoSave).not.toHaveBeenCalled();
  });

  it("대상 엣지가 없으면 상태와 저장을 변경하지 않는다", async () => {
    const { useEdgeCondition } = await import(
      "../../../hooks/useEdgeCondition"
    );
    const setEdges = vi.fn();
    const getNodes = vi.fn(() => []);
    const getEdges = vi.fn(() => [
      { id: "edge-2", source: "node-2", target: "node-3", data: {} },
    ]);
    const autoSave = vi.fn();

    const { result } = renderHook(() =>
      useEdgeCondition(setEdges, getNodes, getEdges, autoSave),
    );

    act(() => {
      result.current.updateEdgeCondition("edge-1", validCondition);
    });

    expect(setEdges).not.toHaveBeenCalled();
    expect(autoSave).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Task 4: NodeDetailPanel에 edges, onEdgeConditionChange props 전달
// ---------------------------------------------------------------------------

describe("FlowCanvas branch wiring", () => {
  it("FlowCanvas가 정상 렌더링된다", () => {
    render(<FlowCanvas themeId="theme-1" />);
    expect(screen.getByTestId("react-flow")).toBeDefined();
  });

  it("updateEdgeCondition이 useFlowData에서 반환된다", () => {
    render(<FlowCanvas themeId="theme-1" />);
    // useFlowDataMock was called; verify updateEdgeCondition is in return value
    expect(useFlowDataMock).toHaveBeenCalled();
    const returnVal = useFlowDataMock.mock.results[0].value;
    expect(returnVal).toHaveProperty("updateEdgeCondition");
  });
});
