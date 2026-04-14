import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { useFlowDataMock } = vi.hoisted(() => ({
  useFlowDataMock: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock @xyflow/react
// ---------------------------------------------------------------------------

vi.mock("@xyflow/react", () => ({
  ReactFlow: (props: Record<string, unknown>) => (
    <div
      data-testid="react-flow"
      data-delete-key-code={String(props.deleteKeyCode)}
      data-edges-focusable={String(props.edgesFocusable)}
      data-edges-reconnectable={String(props.edgesReconnectable)}
    />
  ),
  Background: () => null,
  MiniMap: () => null,
  Controls: () => null,
}));

// ---------------------------------------------------------------------------
// Mock useFlowData
// ---------------------------------------------------------------------------

vi.mock("@/features/editor/hooks/useFlowData", () => ({
  useFlowData: () => useFlowDataMock(),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { FlowCanvas } from "../FlowCanvas";
import type { EditorThemeResponse } from "@/features/editor/api";

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const baseTheme: EditorThemeResponse = {
  id: "theme-1",
  title: "테스트 테마",
  slug: "test-theme",
  description: null,
  cover_image: null,
  min_players: 4,
  max_players: 6,
  duration_min: 90,
  price: 0,
  coin_price: 0,
  status: "DRAFT",
  config_json: {},
  version: 1,
  created_at: "2026-04-13T00:00:00Z",
  review_note: null,
  reviewed_at: null,
  reviewed_by: null,
};

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  useFlowDataMock.mockReturnValue({
    nodes: [],
    edges: [],
    setNodes: vi.fn(),
    setEdges: vi.fn(),
    onNodesChange: vi.fn(),
    onEdgesChange: vi.fn(),
    onConnect: vi.fn(),
    saveStatus: "idle",
  });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("FlowCanvas", () => {
  it('ReactFlow에 deleteKeyCode="Delete" prop이 전달된다', () => {
    render(<FlowCanvas themeId="theme-1" theme={baseTheme} />);
    const el = screen.getByTestId("react-flow");
    expect(el.getAttribute("data-delete-key-code")).toBe("Delete");
  });

  it("ReactFlow에 edgesFocusable={true} prop이 전달된다", () => {
    render(<FlowCanvas themeId="theme-1" theme={baseTheme} />);
    const el = screen.getByTestId("react-flow");
    expect(el.getAttribute("data-edges-focusable")).toBe("true");
  });

  it("ReactFlow에 edgesReconnectable={true} prop이 전달된다", () => {
    render(<FlowCanvas themeId="theme-1" theme={baseTheme} />);
    const el = screen.getByTestId("react-flow");
    expect(el.getAttribute("data-edges-reconnectable")).toBe("true");
  });
});
