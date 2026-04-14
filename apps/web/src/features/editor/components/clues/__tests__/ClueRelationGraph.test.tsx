import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { useClueGraphDataMock, useEditorCluesMock } = vi.hoisted(() => ({
  useClueGraphDataMock: vi.fn(),
  useEditorCluesMock: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@xyflow/react", () => ({
  ReactFlow: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="react-flow">{children}</div>
  ),
  Background: () => <div data-testid="rf-background" />,
  Controls: () => <div data-testid="rf-controls" />,
  Panel: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="rf-panel">{children}</div>
  ),
  useNodesState: (init: unknown[]) => [init, vi.fn(), vi.fn()],
  useEdgesState: (init: unknown[]) => [init, vi.fn(), vi.fn()],
  addEdge: vi.fn(),
}));

vi.mock("@/features/editor/api", () => ({
  useEditorClues: () => useEditorCluesMock(),
  editorKeys: {
    clues: (id: string) => ["editor", "themes", id, "clues"],
  },
}));

vi.mock("../../../hooks/useClueGraphData", () => ({
  useClueGraphData: () => useClueGraphDataMock(),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { ClueRelationGraph } from "../ClueRelationGraph";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeClue(id: string, name: string) {
  return { id, name, type: "item", description: "", imageUrl: null };
}

const defaultGraphData = {
  nodes: [],
  edges: [],
  onNodesChange: vi.fn(),
  onEdgesChange: vi.fn(),
  onConnect: vi.fn(),
  onEdgeDelete: vi.fn(),
  isSaving: false,
};

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  useClueGraphDataMock.mockReturnValue(defaultGraphData);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ClueRelationGraph", () => {
  it("renders empty state when no clues exist", () => {
    useEditorCluesMock.mockReturnValue({ data: [], isLoading: false });

    render(<ClueRelationGraph themeId="t1" />);

    expect(screen.getByText("단서를 먼저 추가하세요")).toBeDefined();
  });

  it("renders ReactFlow when clues exist", () => {
    useEditorCluesMock.mockReturnValue({
      data: [makeClue("c1", "단서A"), makeClue("c2", "단서B")],
      isLoading: false,
    });
    useClueGraphDataMock.mockReturnValue({
      ...defaultGraphData,
      nodes: [
        { id: "c1", type: "clue", position: { x: 0, y: 0 }, data: { label: "단서A" } },
        { id: "c2", type: "clue", position: { x: 200, y: 0 }, data: { label: "단서B" } },
      ],
      edges: [],
    });

    render(<ClueRelationGraph themeId="t1" />);

    expect(screen.getByTestId("react-flow")).toBeDefined();
  });

  it("renders placeholder hint when clues exist but no edges", () => {
    useEditorCluesMock.mockReturnValue({
      data: [makeClue("c1", "단서A"), makeClue("c2", "단서B")],
      isLoading: false,
    });
    useClueGraphDataMock.mockReturnValue({
      ...defaultGraphData,
      nodes: [
        { id: "c1", type: "clue", position: { x: 0, y: 0 }, data: { label: "단서A" } },
        { id: "c2", type: "clue", position: { x: 200, y: 0 }, data: { label: "단서B" } },
      ],
      edges: [],
    });

    render(<ClueRelationGraph themeId="t1" />);

    expect(screen.getByText("노드를 드래그하여 연결하면 의존 관계가 생성됩니다")).toBeDefined();
  });

  it("does not show placeholder when edges exist", () => {
    useEditorCluesMock.mockReturnValue({
      data: [makeClue("c1", "단서A"), makeClue("c2", "단서B")],
      isLoading: false,
    });
    useClueGraphDataMock.mockReturnValue({
      ...defaultGraphData,
      nodes: [
        { id: "c1", type: "clue", position: { x: 0, y: 0 }, data: { label: "단서A" } },
        { id: "c2", type: "clue", position: { x: 200, y: 0 }, data: { label: "단서B" } },
      ],
      edges: [
        { id: "r1", source: "c1", target: "c2", type: "relation", data: { mode: "AND" } },
      ],
    });

    render(<ClueRelationGraph themeId="t1" />);

    expect(screen.queryByText("노드를 드래그하여 연결하면 의존 관계가 생성됩니다")).toBeNull();
  });
});
