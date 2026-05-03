import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

vi.mock("@xyflow/react", () => ({
  Handle: ({ type, position }: { type: string; position: string }) => (
    <div data-testid={`handle-${type}`} data-position={position} />
  ),
  Position: { Top: "top", Bottom: "bottom" },
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { PhaseNode } from "../PhaseNode";

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

function makeProps(data: Record<string, unknown> = {}, selected = false) {
  return {
    id: "node-1",
    type: "phase",
    data,
    selected,
    dragging: false,
    zIndex: 0,
    isConnectable: true,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
  } as Parameters<typeof PhaseNode>[0];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PhaseNode", () => {
  it("기본 라벨 '새 페이즈'를 렌더링한다", () => {
    render(<PhaseNode {...makeProps()} />);
    expect(screen.getByText("새 페이즈")).toBeDefined();
  });

  it("data.label이 있으면 해당 라벨을 렌더링한다", () => {
    render(<PhaseNode {...makeProps({ label: "수사 페이즈" })} />);
    expect(screen.getByText("수사 페이즈")).toBeDefined();
  });

  it("data.phase_type이 있으면 한국어 타입명을 표시한다", () => {
    render(<PhaseNode {...makeProps({ phase_type: "investigation" })} />);
    expect(screen.getByText("수사")).toBeDefined();
  });

  it("스토리 진행 phase type을 제작자용 라벨로 표시한다", () => {
    render(<PhaseNode {...makeProps({ phase_type: "story_progression" })} />);
    expect(screen.getByText("스토리 진행")).toBeDefined();
  });

  it("data.duration이 있으면 분 단위로 표시한다", () => {
    render(<PhaseNode {...makeProps({ duration: 15 })} />);
    expect(screen.getByText("15분")).toBeDefined();
  });

  it("selected=true 일 때 amber 테두리 클래스를 포함한다", () => {
    const { container } = render(<PhaseNode {...makeProps({}, true)} />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("border-amber-500");
    expect(wrapper.className).toContain("ring-1");
  });

  it("selected=false 일 때 기본 테두리 클래스를 사용한다", () => {
    const { container } = render(<PhaseNode {...makeProps({}, false)} />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("border-slate-700");
    expect(wrapper.className).not.toContain("border-amber-500");
  });

  it("입력/출력 핸들을 모두 렌더링한다", () => {
    render(<PhaseNode {...makeProps()} />);
    expect(screen.getByTestId("handle-target")).toBeDefined();
    expect(screen.getByTestId("handle-source")).toBeDefined();
  });
});
