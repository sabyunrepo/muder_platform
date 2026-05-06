import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, cleanup } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { reactFlowProps, useFlowDataMock } = vi.hoisted(() => ({
  reactFlowProps: { current: {} as Record<string, unknown> },
  useFlowDataMock: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@xyflow/react", () => ({
  ReactFlow: (props: Record<string, unknown>) => {
    reactFlowProps.current = props;
    return <div data-testid="react-flow" />;
  },
  Background: () => null,
  MiniMap: () => null,
  Controls: () => null,
}));

vi.mock("../../../hooks/useFlowData", () => ({
  useFlowData: () => useFlowDataMock(),
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { FlowCanvas } from "../FlowCanvas";

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
  deleteEdge: vi.fn(),
  onSelectionChange: vi.fn(),
  updateEdgeCondition: vi.fn(),
  applyPreset: vi.fn(),
};

beforeEach(() => {
  useFlowDataMock.mockReturnValue(baseFlowData);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("FlowCanvas edge delete props", () => {
  it("키보드 Delete 즉시 삭제를 비활성화한다", () => {
    render(<FlowCanvas themeId="t1" />);
    expect(reactFlowProps.current.deleteKeyCode).toBeNull();
  });

  it("edgesFocusable={true} prop이 전달된다", () => {
    render(<FlowCanvas themeId="t1" />);
    expect(reactFlowProps.current.edgesFocusable).toBe(true);
  });

  it("edgesReconnectable={true} prop이 전달된다", () => {
    render(<FlowCanvas themeId="t1" />);
    expect(reactFlowProps.current.edgesReconnectable).toBe(true);
  });
});
