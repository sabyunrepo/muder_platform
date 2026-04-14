import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

import { ConditionRuleRow } from "../ConditionRule";
import type { ConditionRule } from "../conditionTypes";

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

function makeRule(overrides: Partial<ConditionRule> = {}): ConditionRule {
  return {
    id: "rule-1",
    variable: "mission_status",
    comparator: "=",
    value: "",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ConditionRuleRow", () => {
  it("변수 선택 드롭다운이 렌더링된다", () => {
    render(
      <ConditionRuleRow
        rule={makeRule()}
        onChange={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByRole("combobox", { name: "변수" })).toBeDefined();
  });

  it("mission_status일 때 캐릭터·미션 select가 표시된다", () => {
    const characters = [{ id: "c1", name: "탐정" }];
    const missions = [{ id: "m1", name: "단서 수집" }];
    render(
      <ConditionRuleRow
        rule={makeRule({ variable: "mission_status" })}
        onChange={vi.fn()}
        onDelete={vi.fn()}
        characters={characters}
        missions={missions}
      />,
    );
    expect(screen.getByRole("combobox", { name: "캐릭터" })).toBeDefined();
    expect(screen.getByRole("combobox", { name: "미션" })).toBeDefined();
  });

  it("clue_held일 때 단서 select가 표시된다", () => {
    const clues = [{ id: "cl1", name: "혈흔" }];
    render(
      <ConditionRuleRow
        rule={makeRule({ variable: "clue_held" })}
        onChange={vi.fn()}
        onDelete={vi.fn()}
        clues={clues}
      />,
    );
    expect(screen.getByRole("combobox", { name: "단서" })).toBeDefined();
  });

  it("vote_target일 때 추가 select가 표시되지 않는다", () => {
    render(
      <ConditionRuleRow
        rule={makeRule({ variable: "vote_target" })}
        onChange={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.queryByRole("combobox", { name: "캐릭터" })).toBeNull();
    expect(screen.queryByRole("combobox", { name: "미션" })).toBeNull();
    expect(screen.queryByRole("combobox", { name: "단서" })).toBeNull();
  });

  it("삭제 버튼 클릭 시 onDelete가 호출된다", () => {
    const onDelete = vi.fn();
    render(
      <ConditionRuleRow
        rule={makeRule()}
        onChange={vi.fn()}
        onDelete={onDelete}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "규칙 삭제" }));
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it("값 입력 변경 시 onChange가 호출된다", () => {
    const onChange = vi.fn();
    render(
      <ConditionRuleRow
        rule={makeRule()}
        onChange={onChange}
        onDelete={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByRole("textbox", { name: "값" }), {
      target: { value: "success" },
    });
    expect(onChange).toHaveBeenCalledOnce();
    const [updated] = onChange.mock.calls[0] as [ConditionRule];
    expect(updated.value).toBe("success");
  });
});
