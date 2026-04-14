import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@xyflow/react", () => ({
  Handle: ({ type }: { type: string }) => (
    <div data-testid={`handle-${type}`} />
  ),
  Position: { Top: "top", Bottom: "bottom" },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { EndingNode } from "../EndingNode";

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

function makeProps(data: Record<string, unknown>, selected = false) {
  return {
    id: "node-1",
    type: "ending",
    data,
    selected,
    isConnectable: true,
    dragging: false,
    zIndex: 0,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
  } as Parameters<typeof EndingNode>[0];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("EndingNode", () => {
  it("기본 라벨 '새 엔딩'을 표시한다", () => {
    render(<EndingNode {...makeProps({})} />);
    expect(screen.getByText("새 엔딩")).toBeDefined();
  });

  it("data.label이 있으면 해당 라벨을 표시한다", () => {
    render(<EndingNode {...makeProps({ label: "배드 엔딩" })} />);
    expect(screen.getByText("배드 엔딩")).toBeDefined();
  });

  it("target 핸들만 렌더링된다 (source 없음)", () => {
    render(<EndingNode {...makeProps({})} />);
    expect(screen.getByTestId("handle-target")).toBeDefined();
    expect(screen.queryByTestId("handle-source")).toBeNull();
  });

  it("score_multiplier > 1이면 emerald 색상 배지를 표시한다", () => {
    const { container } = render(
      <EndingNode {...makeProps({ score_multiplier: 1.5 })} />,
    );
    const badge = container.querySelector(".text-emerald-400");
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toContain("1.5");
  });

  it("score_multiplier < 1이면 red 색상 배지를 표시한다", () => {
    const { container } = render(
      <EndingNode {...makeProps({ score_multiplier: 0.5 })} />,
    );
    const badge = container.querySelector(".text-red-400");
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toContain("0.5");
  });

  it("score_multiplier = 1이면 slate 색상 배지를 표시한다", () => {
    const { container } = render(
      <EndingNode {...makeProps({ score_multiplier: 1 })} />,
    );
    const badge = container.querySelector(".text-slate-400");
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toContain("1");
  });

  it("score_multiplier가 없으면 배지를 표시하지 않는다", () => {
    const { container } = render(<EndingNode {...makeProps({})} />);
    expect(container.querySelector(".text-emerald-400")).toBeNull();
    expect(container.querySelector(".text-red-400")).toBeNull();
  });

  it("description이 있으면 표시한다", () => {
    render(
      <EndingNode
        {...makeProps({ description: "이 엔딩은 범인을 놓쳤을 때 발생합니다." })}
      />,
    );
    expect(
      screen.getByText("이 엔딩은 범인을 놓쳤을 때 발생합니다."),
    ).toBeDefined();
  });

  it("description이 없으면 설명 텍스트를 표시하지 않는다", () => {
    render(<EndingNode {...makeProps({})} />);
    // No p element with description class
    expect(screen.queryByText(/이 엔딩/)).toBeNull();
  });

  it("selected=true이면 amber 테두리를 렌더링한다", () => {
    const { container } = render(
      <EndingNode {...makeProps({}, true)} />,
    );
    expect(container.querySelector(".border-amber-500")).not.toBeNull();
  });

  it("selected=false이면 기본 rose 테두리를 렌더링한다", () => {
    const { container } = render(
      <EndingNode {...makeProps({}, false)} />,
    );
    expect(container.querySelector(".border-rose-700\\/60")).not.toBeNull();
  });
});
