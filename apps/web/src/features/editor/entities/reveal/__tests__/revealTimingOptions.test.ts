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
  phaseType?: string,
): FlowNodeResponse {
  return {
    id,
    theme_id: "theme-1",
    type,
    data: {
      ...(label ? { label } : {}),
      ...(rounds ? { rounds } : {}),
      ...(phaseType ? { phase_type: phaseType } : {}),
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

  it("flow node label과 id를 장면 후보로 만들되 branch는 제외하고 legacy raw id를 복원한다", () => {
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
      { value: "ending-1", label: "진엔딩 (결말)" },
      { value: "legacy-node", label: "기존 저장값 (legacy-node)" },
    ]);
  });

  it("phase 범위에서는 결말을 제외하고 장면만 복원한다", () => {
    const options = buildProgressNodeRevealOptions(
      [
        node("phase-0", "phase", "기존 장면"),
        node("phase-1", "phase", "현장 조사", undefined, "investigation"),
        node("phase-2", "phase", "토론", undefined, "discussion"),
        node("ending-1", "ending", "진엔딩"),
      ],
      ["legacy-node"],
      { scope: "phase" },
    );

    expect(options).toEqual([
      { value: "phase-0", label: "기존 장면 (장면)" },
      { value: "phase-1", label: "현장 조사 (장면)" },
      { value: "phase-2", label: "토론 (장면)" },
      { value: "legacy-node", label: "기존 저장값 (legacy-node)" },
    ]);
  });

  it("수사 phase 범위에서는 investigation 장면만 노출하고 기존 저장값은 보존한다", () => {
    const options = buildProgressNodeRevealOptions(
      [
        node("phase-0", "phase", "기존 장면"),
        node("phase-1", "phase", "현장 조사", undefined, "investigation"),
        node("phase-2", "phase", "토론", undefined, "discussion"),
        node("ending-1", "ending", "진엔딩"),
      ],
      ["phase-2", "legacy-node"],
      { scope: "investigation_phase" },
    );

    expect(options).toEqual([
      { value: "phase-0", label: "기존 장면 (장면)" },
      { value: "phase-1", label: "현장 조사 (장면)" },
      { value: "phase-2", label: "기존 저장값 (phase-2)" },
      { value: "legacy-node", label: "기존 저장값 (legacy-node)" },
    ]);
  });
});
