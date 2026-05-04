import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { Node } from "@xyflow/react";
import {
  buildChoiceCondition,
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
          config: expect.objectContaining({ defaultEnding: "end-2", multiVoteThreshold: 0.6 }),
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
    expect(viewModel.matrix[0]).toMatchObject({ questionId: "q1", choice: "하윤", endingName: "진실" });
    expect(viewModel.defaultEndingName).toBe("미해결");
    expect(viewModel.thresholdPercent).toBe(50);
    expect(viewModel.warnings).toEqual([]);
  });

  it("선택지 조건을 JSONLogic으로 숨겨 저장하고 다시 읽는다", () => {
    const condition = buildChoiceCondition("q1", "비밀 편지 획득");
    expect(condition).toEqual({ in: ["비밀 편지 획득", { var: "answers.q1.choices" }] });
    expect(readChoiceCondition(condition)).toEqual({ questionId: "q1", choice: "비밀 편지 획득" });
    expect(updateMatrixCondition({ priority: 1, ending: "end-1", condition: {} }, "q2", "A").condition)
      .toEqual({ in: ["A", { var: "answers.q2.choices" }] });
  });

  it("새 질문과 규칙의 기본값은 제작자가 바로 수정 가능한 형태다", () => {
    const question = createEndingBranchQuestion(0);
    const row = createEndingBranchMatrixRow({ questions: [question], matrix: [], defaultEnding: "" }, "end-1");

    expect(question).toMatchObject({ id: "ending-question-1234-1", choices: ["선택지 1", "선택지 2"], respondents: "all" });
    expect(row).toMatchObject({ priority: 1, ending: "end-1" });
    expect(readChoiceCondition(row.condition)).toEqual({ questionId: question.id, choice: "선택지 1" });
  });
});
