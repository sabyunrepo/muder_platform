import { describe, expect, it } from "vitest";
import {
  isCompleteConditionGroupRecord,
  isConditionGroupRecord,
  recordToGroup,
  type ConditionGroup,
} from "../conditionTypes";

describe("conditionTypes", () => {
  it("MMP 조건 그룹 shape를 공통 계약으로 검증한다", () => {
    const condition: ConditionGroup = {
      id: "group-1",
      operator: "AND",
      rules: [
        {
          id: "rule-1",
          variable: "investigation_token",
          target_character_id: "character-1",
          target_token_id: "basic-token",
          comparator: ">=",
          value: "1",
        },
      ],
    };

    expect(isConditionGroupRecord(condition)).toBe(true);
    expect(recordToGroup(condition).rules).toHaveLength(1);
  });

  it("unknown variable과 과도한 중첩은 빈 제작자 그룹으로 되돌린다", () => {
    const badVariable = {
      id: "group-1",
      operator: "AND",
      rules: [{ id: "rule-1", variable: "raw_engine_key", comparator: "=", value: "x" }],
    };
    const tooDeep = {
      id: "g0",
      operator: "AND",
      rules: [{
        id: "g1",
        operator: "AND",
        rules: [{
          id: "g2",
          operator: "AND",
          rules: [{
            id: "g3",
            operator: "AND",
            rules: [{
              id: "g4",
              operator: "AND",
              rules: [],
            }],
          }],
        }],
      }],
    };
    const missingTarget = {
      id: "group-1",
      operator: "AND",
      rules: [{
        id: "rule-1",
        variable: "investigation_token",
        target_character_id: "character-1",
        comparator: ">=",
        value: "1",
      }],
    };

    expect(isConditionGroupRecord(badVariable)).toBe(false);
    expect(isConditionGroupRecord(missingTarget)).toBe(true);
    expect(isCompleteConditionGroupRecord(missingTarget)).toBe(false);
    expect(isConditionGroupRecord(tooDeep)).toBe(false);
    expect(recordToGroup(badVariable).operator).toBe("AND");
    expect(recordToGroup(tooDeep).rules).toHaveLength(1);
  });
});
