import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Mock @xyflow/react — only Handle and Position are needed
// ---------------------------------------------------------------------------

vi.mock("@xyflow/react", () => ({
  Handle: ({ type, position, id, className }: {
    type: string;
    position: string;
    id?: string;
    className?: string;
  }) => (
    <div
      data-testid={`handle-${type}-${id ?? position}`}
      data-type={type}
      data-position={position}
      className={className}
    />
  ),
  Position: {
    Top: "top",
    Bottom: "bottom",
    Left: "left",
    Right: "right",
  },
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { BranchNode } from "../BranchNode";
import type { NodeProps } from "@xyflow/react";

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

function makeProps(overrides: Partial<NodeProps> = {}): NodeProps {
  return {
    id: "node-1",
    type: "branch",
    data: {},
    selected: false,
    dragging: false,
    zIndex: 0,
    isConnectable: true,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    ...overrides,
  } as NodeProps;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("BranchNode", () => {
  it("기본 라벨 '분기'가 렌더링된다", () => {
    render(<BranchNode {...makeProps()} />);
    expect(screen.getByText("분기")).toBeDefined();
  });

  it("data.label이 있으면 해당 라벨이 렌더링된다", () => {
    render(<BranchNode {...makeProps({ data: { label: "조건 분기" } })} />);
    expect(screen.getByText("조건 분기")).toBeDefined();
  });

  it("target 핸들(상단)이 존재한다", () => {
    render(<BranchNode {...makeProps()} />);
    expect(screen.getByTestId("handle-target-top")).toBeDefined();
  });

  it("source 핸들 3개(default, branch-1, branch-2)가 존재한다", () => {
    render(<BranchNode {...makeProps()} />);
    expect(screen.getByTestId("handle-source-default")).toBeDefined();
    expect(screen.getByTestId("handle-source-branch-1")).toBeDefined();
    expect(screen.getByTestId("handle-source-branch-2")).toBeDefined();
  });

  it("selected=true 시 amber 테두리 클래스가 적용된다", () => {
    const { container } = render(<BranchNode {...makeProps({ selected: true })} />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.className).toContain("border-amber-500");
  });

  it("selected=false 시 violet 테두리 클래스가 적용된다", () => {
    const { container } = render(<BranchNode {...makeProps({ selected: false })} />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.className).toContain("border-violet-600");
  });
});
