import { cleanup, render, screen } from "@testing-library/react";
import type { CSSProperties, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { EdgeProps } from "@xyflow/react";
import { ConditionEdge } from "../ConditionEdge";

vi.mock("@xyflow/react", () => ({
  BaseEdge: ({ style }: { style?: CSSProperties }) => (
    <div data-testid="condition-edge-path" style={style} />
  ),
  EdgeLabelRenderer: ({ children }: { children: ReactNode }) => <>{children}</>,
  getBezierPath: () => ["M0,0 C0,0 1,1 1,1", 0, 0],
}));

afterEach(() => cleanup());

const baseProps = {
  id: "edge-1",
  sourceX: 0,
  sourceY: 0,
  targetX: 10,
  targetY: 10,
  sourcePosition: "right",
  targetPosition: "left",
  source: "source",
  target: "target",
  selected: false,
  animated: false,
  markerStart: undefined,
  markerEnd: undefined,
  interactionWidth: 0,
} as unknown as EdgeProps;

const completeCondition = {
  id: "group-1",
  operator: "AND",
  rules: [
    {
      id: "rule-1",
      variable: "custom_flag",
      target_flag_key: "route_open",
      comparator: "=",
      value: "true",
    },
  ],
};

describe("ConditionEdge", () => {
  it("미완성 조건은 기본 이동 스타일로 렌더링한다", () => {
    render(
      <ConditionEdge
        {...baseProps}
        data={{ condition: { id: "draft", operator: "AND", rules: [] } }}
      />,
    );

    const path = screen.getByTestId("condition-edge-path");
    expect(path.style.stroke).toBe("rgb(100, 116, 139)");
    expect(path.style.strokeDasharray).toBe("5 5");
  });

  it("완성된 공통 조건 그룹은 조건 이동 스타일로 렌더링한다", () => {
    render(<ConditionEdge {...baseProps} data={{ condition: completeCondition }} />);

    const path = screen.getByTestId("condition-edge-path");
    expect(path.style.stroke).toBe("rgb(139, 92, 246)");
    expect(path.style.strokeDasharray).toBe("");
  });
});
