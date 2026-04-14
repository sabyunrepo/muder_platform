import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("../../../flowApi", () => ({
  useUpdateFlowNode: () => ({ mutate: vi.fn() }),
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { PhaseNodePanel } from "../PhaseNodePanel";

afterEach(cleanup);

const makeNode = (data: Record<string, unknown> = {}) => ({
  id: "node-1",
  type: "phase" as const,
  position: { x: 0, y: 0 },
  data: { label: "테스트 페이즈", ...data },
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PhaseNodePanel extended fields", () => {
  it("자동진행 토글이 렌더링된다", () => {
    render(
      <PhaseNodePanel
        node={makeNode()}
        themeId="t1"
        onUpdate={vi.fn()}
      />,
    );
    expect(screen.getByRole("switch")).toBeDefined();
  });

  it("자동진행 토글 클릭 시 onUpdate가 호출된다", () => {
    const onUpdate = vi.fn();
    render(
      <PhaseNodePanel
        node={makeNode()}
        themeId="t1"
        onUpdate={onUpdate}
      />,
    );
    fireEvent.click(screen.getByRole("switch"));
    expect(onUpdate).toHaveBeenCalledWith("node-1", { autoAdvance: true });
  });

  it("autoAdvance=true 시 경고타이머 입력이 표시된다", () => {
    render(
      <PhaseNodePanel
        node={makeNode({ autoAdvance: true })}
        themeId="t1"
        onUpdate={vi.fn()}
      />,
    );
    expect(screen.getByPlaceholderText("30")).toBeDefined();
  });

  it("autoAdvance=false 시 경고타이머가 숨겨진다", () => {
    render(
      <PhaseNodePanel
        node={makeNode({ autoAdvance: false })}
        themeId="t1"
        onUpdate={vi.fn()}
      />,
    );
    expect(screen.queryByPlaceholderText("30")).toBeNull();
  });

  it("onEnter 액션 섹션이 렌더링된다", () => {
    render(
      <PhaseNodePanel
        node={makeNode()}
        themeId="t1"
        onUpdate={vi.fn()}
      />,
    );
    expect(screen.getByText("진입 액션 (onEnter)")).toBeDefined();
    expect(screen.getByText("퇴장 액션 (onExit)")).toBeDefined();
  });
});
