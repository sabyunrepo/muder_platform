import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import type { Node } from "@xyflow/react";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

vi.mock("../PhaseNodePanel", () => ({
  PhaseNodePanel: () => <div>페이즈 설정</div>,
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { NodeDetailPanel } from "../NodeDetailPanel";

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNode(type: string, data: Record<string, unknown> = {}): Node {
  return {
    id: "node-1",
    type,
    position: { x: 0, y: 0 },
    data,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("NodeDetailPanel", () => {
  it("node가 null이면 '노드를 선택하세요' 를 표시한다", () => {
    render(
      <NodeDetailPanel
        node={null}
        themeId="t1"
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText("노드를 선택하세요")).toBeDefined();
  });

  it("start 노드이면 편집 불가 메시지를 표시한다", () => {
    render(
      <NodeDetailPanel
        node={makeNode("start")}
        themeId="t1"
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText("시작 노드는 편집할 수 없습니다")).toBeDefined();
  });

  it("start 노드에는 삭제 버튼이 없다", () => {
    render(
      <NodeDetailPanel
        node={makeNode("start")}
        themeId="t1"
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.queryByText("노드 삭제")).toBeNull();
  });

  it("phase 노드이면 PhaseNodePanel을 렌더링한다", () => {
    render(
      <NodeDetailPanel
        node={makeNode("phase", { label: "수사 단계" })}
        themeId="t1"
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText("페이즈 설정")).toBeDefined();
  });

  it("phase 노드에는 삭제 버튼이 있다", () => {
    render(
      <NodeDetailPanel
        node={makeNode("phase")}
        themeId="t1"
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText("노드 삭제")).toBeDefined();
  });

  it("삭제 버튼 클릭 시 onDelete가 노드 id와 함께 호출된다", () => {
    const onDelete = vi.fn();
    render(
      <NodeDetailPanel
        node={makeNode("phase")}
        themeId="t1"
        onUpdate={vi.fn()}
        onDelete={onDelete}
      />,
    );
    fireEvent.click(screen.getByText("노드 삭제"));
    expect(onDelete).toHaveBeenCalledWith("node-1");
  });
});
