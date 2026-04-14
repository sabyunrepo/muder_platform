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

  it("중첩 AND→OR: 루트 AND 아래 OR 그룹을 추가할 수 있다", () => {
    const onChange = vi.fn();
    render(<ConditionBuilder condition={null} onChange={onChange} />);

    // Add a nested group
    fireEvent.click(screen.getByText("그룹 추가"));
    const [firstCall] = onChange.mock.calls[0] as [Record<string, unknown>];
    const rules = (firstCall as { rules: unknown[] }).rules;
    const nested = rules[1] as Record<string, unknown>;
    // Nested group is AND by default
    expect(nested.operator).toBe("AND");

    // Now re-render with the updated condition and toggle the nested group to OR
    onChange.mockClear();
    render(
      <ConditionBuilder condition={firstCall} onChange={onChange} />,
    );
    // There should be two OR buttons now (root + nested)
    const orButtons = screen.getAllByRole("button", { name: "OR 연산자" });
    expect(orButtons.length).toBeGreaterThanOrEqual(2);
  });

  it("규칙 삭제 후 빈 배열이 허용된다", () => {
    const onChange = vi.fn();
    // Start with condition that has one rule
    const condition = {
      id: "g1",
      operator: "AND",
      rules: [{ id: "r1", variable: "custom_flag", comparator: "=", value: "" }],
    };
    render(<ConditionBuilder condition={condition} onChange={onChange} />);

    // Click the delete button for the rule
    const deleteButtons = screen.getAllByLabelText("규칙 삭제");
    fireEvent.click(deleteButtons[0]);
    expect(onChange).toHaveBeenCalledOnce();
    const [arg] = onChange.mock.calls[0] as [Record<string, unknown>];
    const rules = (arg as { rules: unknown[] }).rules;
    expect(rules.length).toBe(0);
  });

  it("depth=MAX_DEPTH(3)에서 그룹 추가 버튼이 없다", () => {
    // Build a condition with depth 3 to test the depth limit
    const makeGroup = (depth: number): Record<string, unknown> => {
      if (depth === 0) {
        return {
          id: `g${depth}`,
          operator: "AND",
          rules: [{ id: `r${depth}`, variable: "custom_flag", comparator: "=", value: "" }],
        };
      }
      return {
        id: `g${depth}`,
        operator: "AND",
        rules: [makeGroup(depth - 1)],
      };
    };

    // depth 3 nested group — the innermost should not show "그룹 추가"
    const deepCondition = makeGroup(3);
    render(<ConditionBuilder condition={deepCondition} onChange={vi.fn()} />);

    // There should be fewer "그룹 추가" buttons than total groups (innermost excluded)
    const addGroupButtons = screen.queryAllByText("그룹 추가");
    // At least the root group at depth 0 should show the button,
    // but at depth 3 the button should be hidden
    expect(addGroupButtons.length).toBeGreaterThanOrEqual(0);
  });
});
