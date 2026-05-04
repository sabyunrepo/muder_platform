import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("../../../flowApi", () => ({
  useUpdateFlowNode: () => ({ mutate: vi.fn() }),
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { PhaseNodePanel } from "../PhaseNodePanel";

afterEach(cleanup);

/** Wrap render with a fresh QueryClient (PhaseNodePanel now uses useQueryClient). */
function renderWithQC(ui: ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

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
    renderWithQC(
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
    renderWithQC(
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
    renderWithQC(
      <PhaseNodePanel
        node={makeNode({ autoAdvance: true })}
        themeId="t1"
        onUpdate={vi.fn()}
      />,
    );
    expect(screen.getByPlaceholderText("30")).toBeDefined();
  });

  it("autoAdvance=false 시 경고타이머가 숨겨진다", () => {
    renderWithQC(
      <PhaseNodePanel
        node={makeNode({ autoAdvance: false })}
        themeId="t1"
        onUpdate={vi.fn()}
      />,
    );
    expect(screen.queryByPlaceholderText("30")).toBeNull();
  });

  it("장면 시작/종료 트리거 섹션이 렌더링된다", () => {
    renderWithQC(
      <PhaseNodePanel
        node={makeNode()}
        themeId="t1"
        onUpdate={vi.fn()}
      />,
    );
    expect(screen.getByText("장면 시작 트리거")).toBeDefined();
    expect(screen.getByText("장면 종료 트리거")).toBeDefined();
    expect(screen.getAllByText("트리거 실행 결과 없음")).toHaveLength(2);
  });
});
