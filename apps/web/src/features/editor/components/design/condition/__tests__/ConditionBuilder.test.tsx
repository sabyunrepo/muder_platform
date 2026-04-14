import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { ConditionBuilder } from "../ConditionBuilder";

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ConditionBuilder", () => {
  it("null condition이면 빈 AND 그룹을 렌더링한다", () => {
    render(
      <ConditionBuilder condition={null} onChange={vi.fn()} />,
    );
    expect(screen.getAllByRole("button", { name: "AND 연산자" }).length).toBeGreaterThan(0);
  });

  it("'규칙 추가' 클릭 시 onChange가 호출된다", () => {
    const onChange = vi.fn();
    render(<ConditionBuilder condition={null} onChange={onChange} />);

    fireEvent.click(screen.getByText("규칙 추가"));
    expect(onChange).toHaveBeenCalledOnce();
    const [arg] = onChange.mock.calls[0] as [Record<string, unknown>];
    const rules = (arg as { rules: unknown[] }).rules;
    expect(Array.isArray(rules)).toBe(true);
    expect(rules.length).toBe(2); // initial 1 + added 1
  });

  it("AND/OR 토글 시 operator가 변경된다", () => {
    const onChange = vi.fn();
    render(<ConditionBuilder condition={null} onChange={onChange} />);

    // Initial is AND, clicking OR button toggles
    fireEvent.click(screen.getByRole("button", { name: "OR 연산자" }));
    expect(onChange).toHaveBeenCalledOnce();
    const [arg] = onChange.mock.calls[0] as [Record<string, unknown>];
    expect(arg.operator).toBe("OR");
  });

  it("초기화 버튼 클릭 시 빈 그룹으로 리셋된다", () => {
    const onChange = vi.fn();
    const condition = { id: "g1", operator: "AND", rules: [] };
    render(<ConditionBuilder condition={condition} onChange={onChange} />);

    fireEvent.click(screen.getByText("초기화"));
    expect(onChange).toHaveBeenCalledOnce();
    const [arg] = onChange.mock.calls[0] as [Record<string, unknown>];
    expect(arg.operator).toBe("AND");
    expect(Array.isArray(arg.rules)).toBe(true);
  });

  it("label prop이 헤더에 표시된다", () => {
    render(
      <ConditionBuilder
        condition={null}
        onChange={vi.fn()}
        label="엣지 조건 테스트"
      />,
    );
    expect(screen.getByText("엣지 조건 테스트")).toBeDefined();
  });

  it("그룹 추가 클릭 시 중첩 그룹이 생성된다", () => {
    const onChange = vi.fn();
    render(<ConditionBuilder condition={null} onChange={onChange} />);

    fireEvent.click(screen.getByText("그룹 추가"));
    expect(onChange).toHaveBeenCalledOnce();
    const [arg] = onChange.mock.calls[0] as [Record<string, unknown>];
    const rules = (arg as { rules: unknown[] }).rules;
    // Second item should be a group (has operator)
    const nested = rules[1] as Record<string, unknown>;
    expect(nested.operator).toBeDefined();
  });
});
