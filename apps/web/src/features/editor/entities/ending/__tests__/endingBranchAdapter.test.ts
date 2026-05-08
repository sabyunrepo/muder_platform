import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { Node } from "@xyflow/react";
import {
  buildChoiceCondition,
  buildAllChoicesCondition,
  buildAnyChoicesCondition,
  buildWinningChoiceCondition,
  createEndingBranchMatrixRow,
  createEndingBranchQuestion,
  readChoiceCondition,
  readEndingBranchConfig,
  toEndingBranchEditorViewModel,
  updateMatrixCondition,
  writeEndingBranchConfig,
} from "../endingBranchAdapter";

function endingNode(id: string, label: string): Node {
  return { id, type: "ending", position: { x: 0, y: 0 }, data: { label } };
}

describe("endingBranchAdapter", () => {
  beforeEach(() => {
    vi.spyOn(Date, "now").mockReturnValue(1234);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("legacy module_configs를 읽고 canonical modules map으로 저장한다", () => {
    const config = readEndingBranchConfig({
      module_configs: {
        ending_branch: {
          questions: [{ id: "q1", text: "범인은?", type: "multi", choices: ["A", "B"], impact: "branch" }],
          matrix: [{ priority: 2, ending: "end-1", condition: buildChoiceCondition("q1", "A") }],
          defaultEnding: "end-2",
          multiVoteThreshold: 0.6,
        },
      },
    });

    expect(config.questions[0]).toMatchObject({ id: "q1", text: "범인은?", type: "multi" });
    expect(config.matrix[0].priority).toBe(2);

    const saved = writeEndingBranchConfig({ module_configs: { ending_branch: { stale: true } } }, config);
    expect(saved).toEqual({
      modules: {
        ending_branch: {
          enabled: true,
          config: expect.objectContaining({
            defaultEnding: "end-2",
            multiVoteThreshold: 0.6,
            matrix: [{ priority: 2, ending: "end-1", conditions: buildChoiceCondition("q1", "A") }],
          }),
        },
      },
    });
    expect(saved).not.toHaveProperty("module_configs");
  });

  it("제작자 UI용 질문과 결말 규칙 요약을 만든다", () => {
    const viewModel = toEndingBranchEditorViewModel({
      modules: {
        ending_branch: {
          enabled: true,
          config: {
            questions: [{ id: "q1", text: "누가 진범인가?", type: "single", choices: ["하윤", "민재"], impact: "branch" }],
            matrix: [{ priority: 1, ending: "end-truth", condition: buildChoiceCondition("q1", "하윤") }],
            defaultEnding: "end-fail",
          },
        },
      },
    }, [endingNode("end-truth", "진실"), endingNode("end-fail", "미해결")]);

    expect(viewModel.questions[0]).toMatchObject({ label: "누가 진범인가?", typeLabel: "하나 선택", impactLabel: "결말 분기" });
    expect(viewModel.matrix[0]).toMatchObject({ questionId: "q1", choice: "하윤", choices: ["하윤"], aggregation: "threshold", endingName: "진실" });
    expect(viewModel.defaultEndingName).toBe("미해결");
    expect(viewModel.thresholdPercent).toBe(50);
    expect(viewModel.warnings).toEqual([]);
  });

  it("target 없는 기존 질문은 모든 플레이어 대상으로 보정한다", () => {
    const config = readEndingBranchConfig({
      modules: {
        ending_branch: {
          enabled: true,
          config: {
            questions: [{ id: "q1", text: "범인은?", type: "single", choices: ["A", "B"], impact: "branch" }],
          },
        },
      },
    });

    expect(config.questions[0]).toMatchObject({
      respondents: "all",
      target: { type: "all_players" },
    });
  });

  it("legacy respondents 캐릭터 id를 specific_players target으로 읽는다", () => {
    const config = readEndingBranchConfig({
      modules: {
        ending_branch: {
          enabled: true,
          config: {
            questions: [{ id: "q1", text: "개인 질문", type: "single", choices: ["A", "B"], impact: "branch", respondents: "char-1" }],
          },
        },
      },
    });

    expect(config.questions[0]).toMatchObject({
      respondents: "char-1",
      target: { type: "specific_players", characterIds: ["char-1"] },
    });
  });

  it("specific_players target은 중복 없는 캐릭터 id 배열로 저장/로드한다", () => {
    const saved = writeEndingBranchConfig(null, {
      questions: [{
        id: "q1",
        text: "비밀 선택",
        type: "multi",
        choices: ["A", "B"],
        respondents: "char-1",
        target: { type: "specific_players", characterIds: ["char-1", "char-2"] },
        impact: "score",
      }],
      matrix: [],
      defaultEnding: "",
    });

    expect(saved).toMatchObject({
      modules: {
        ending_branch: {
          config: {
            questions: [expect.objectContaining({
              target: { type: "specific_players", characterIds: ["char-1", "char-2"] },
            })],
          },
        },
      },
    });
    expect(readEndingBranchConfig(saved).questions[0].target).toEqual({
      type: "specific_players",
      characterIds: ["char-1", "char-2"],
    });
  });

  it("선택지가 비어 있는 결말 규칙은 저장 전 경고로 표시한다", () => {
    const viewModel = toEndingBranchEditorViewModel({
      modules: {
        ending_branch: {
          enabled: true,
          config: {
            questions: [{ id: "q1", text: "누가 진범인가?", type: "single", choices: ["하윤", "민재"], impact: "branch" }],
            matrix: [{ priority: 1, ending: "end-truth", condition: buildChoiceCondition("q1", "") }],
            defaultEnding: "end-fail",
          },
        },
      },
    }, [endingNode("end-truth", "진실"), endingNode("end-fail", "미해결")]);

    expect(viewModel.matrix[0]).toMatchObject({ questionId: "q1", choice: null });
    expect(viewModel.warnings).toContain("결말 규칙 중 질문/선택지 조건이 비어 있습니다.");
  });

  it("선택지 조건을 JSONLogic으로 숨겨 저장하고 다시 읽는다", () => {
    const condition = buildChoiceCondition("q1", "비밀 편지 획득");
    expect(condition).toEqual({ in: ["비밀 편지 획득", { var: "answers.q1.choices" }] });
    expect(readChoiceCondition(condition)).toEqual({ questionId: "q1", choice: "비밀 편지 획득", choices: ["비밀 편지 획득"], aggregation: "threshold" });
    expect(updateMatrixCondition({ priority: 1, ending: "end-1", condition: {} }, "q2", "A").condition)
      .toEqual({ in: ["A", { var: "answers.q2.choices" }] });
  });

  it("가장 많이 선택된 답 기준 조건도 읽고 저장한다", () => {
    const condition = buildWinningChoiceCondition("q1", "하윤");

    expect(condition).toEqual({ "==": [{ var: "answers.q1.winning" }, "하윤"] });
    expect(readChoiceCondition(condition)).toEqual({ questionId: "q1", choice: "하윤", choices: ["하윤"], aggregation: "winning" });
    expect(updateMatrixCondition({ priority: 1, ending: "end-1", condition: {} }, "q2", "B", "winning").condition)
      .toEqual({ "==": [{ var: "answers.q2.winning" }, "B"] });
  });

  it("복수 답변 all/any 조건을 JSONLogic and/or로 저장하고 다시 읽는다", () => {
    const allCondition = buildAllChoicesCondition("q1", ["증거 A", "증거 B", "증거 A"]);
    const anyCondition = buildAnyChoicesCondition("q1", ["증거 A", "증거 C"]);

    expect(allCondition).toEqual({
      and: [
        { in: ["증거 A", { var: "answers.q1.choices" }] },
        { in: ["증거 B", { var: "answers.q1.choices" }] },
      ],
    });
    expect(anyCondition).toEqual({
      or: [
        { in: ["증거 A", { var: "answers.q1.choices" }] },
        { in: ["증거 C", { var: "answers.q1.choices" }] },
      ],
    });
    expect(readChoiceCondition(allCondition)).toEqual({
      questionId: "q1",
      choice: "증거 A",
      choices: ["증거 A", "증거 B"],
      aggregation: "all",
    });
    expect(readChoiceCondition(anyCondition)).toEqual({
      questionId: "q1",
      choice: "증거 A",
      choices: ["증거 A", "증거 C"],
      aggregation: "any",
    });
    expect(updateMatrixCondition({ priority: 1, ending: "end-1", condition: {} }, "q2", ["A", "B"], "all").condition)
      .toEqual({
        and: [
          { in: ["A", { var: "answers.q2.choices" }] },
          { in: ["B", { var: "answers.q2.choices" }] },
        ],
      });
  });

  it("새 질문과 규칙의 기본값은 제작자가 바로 수정 가능한 형태다", () => {
    const question = createEndingBranchQuestion(0);
    const row = createEndingBranchMatrixRow({ questions: [question], matrix: [], defaultEnding: "" }, "end-1");

    expect(question).toMatchObject({ id: "ending-question-1234-1", choices: ["선택지 1", "선택지 2"], respondents: "all", target: { type: "all_players" } });
    expect(row).toMatchObject({ priority: 1, ending: "end-1" });
    expect(readChoiceCondition(row.condition)).toEqual({ questionId: question.id, choice: "선택지 1", choices: ["선택지 1"], aggregation: "threshold" });
  });
});
