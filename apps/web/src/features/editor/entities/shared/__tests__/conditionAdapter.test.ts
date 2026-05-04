import { describe, expect, it } from "vitest";
import {
  describeConditionRecord,
  getConditionOperatorLabel,
  getConditionVariableLabel,
} from "../conditionAdapter";

describe("conditionAdapter", () => {
  it("조건 변수와 그룹을 제작자용 문구로 변환한다", () => {
    expect(getConditionVariableLabel("clue_held")).toBe("단서 보유");
    expect(getConditionVariableLabel("raw_engine_key")).toBe("직접 설정한 조건");
    expect(getConditionOperatorLabel("OR")).toBe("하나 이상");
  });

  it("조건 record를 내부 JSON 대신 요약 문장으로 설명한다", () => {
    expect(describeConditionRecord(null)).toBe("조건 없음");
    expect(describeConditionRecord({ operator: "AND", rules: [{ id: "r1" }, { id: "r2" }] })).toBe(
      "모든 조건 · 2개 규칙",
    );
    expect(describeConditionRecord([] as unknown as Record<string, unknown>)).toBe("조건 없음");
  });
});
