import { describe, expect, it } from "vitest";
import type { FlowNodeResponse } from "../../../flowTypes";
import {
  buildProgressNodeRevealOptions,
  buildRoundRevealOptions,
} from "../revealTimingOptions";

function node(
  id: string,
  type: FlowNodeResponse["type"],
  label: string | undefined,
  rounds?: number,
): FlowNodeResponse {
  return {
    id,
    theme_id: "theme-1",
    type,
    data: {
      ...(label ? { label } : {}),
      ...(rounds ? { rounds } : {}),
    },
    position_x: 0,
    position_y: 0,
    created_at: "2026-05-08T00:00:00Z",
    updated_at: "2026-05-08T00:00:00Z",
  };
}

describe("revealTimingOptions", () => {
  it("flow phase rounds에서 라운드 후보를 만들고 기존 저장 라운드를 보존한다", () => {
    const options = buildRoundRevealOptions(
      [
        node("start", "start", "시작"),
        node("phase-1", "phase", "프롤로그", 2),
        node("phase-2", "phase", "조사", 4),
      ],
      [7],
    );

    expect(options.map((option) => option.value)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(options[3]).toEqual({ value: 4, label: "4라운드" });
  });

  it("flow node label과 id를 진행 노드 후보로 만들고 legacy raw id를 복원한다", () => {
    const options = buildProgressNodeRevealOptions(
      [
        node("start", "start", "시작"),
        node("phase-1", "phase", "현장 조사"),
        node("branch-1", "branch", "증언 분기"),
        node("ending-1", "ending", "진엔딩"),
      ],
      ["legacy-node"],
    );

    expect(options).toEqual([
      { value: "phase-1", label: "현장 조사 (장면)" },
      { value: "branch-1", label: "증언 분기 (분기)" },
      { value: "ending-1", label: "진엔딩 (결말)" },
      { value: "legacy-node", label: "기존 저장값 (legacy-node)" },
    ]);
  });
});
