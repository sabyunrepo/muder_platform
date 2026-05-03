import { describe, expect, it } from "vitest";
import type { Edge, Node } from "@xyflow/react";
import { buildEndingDecisionSummary, toEndingEditorViewModel } from "../endingEntityAdapter";

function node(id: string, data: Record<string, unknown> = {}): Node {
  return { id, type: "ending", position: { x: 0, y: 0 }, data };
}

function edge(id: string, target: string): Edge {
  return { id, source: "phase-1", target };
}

describe("endingEntityAdapter", () => {
  it("제작자에게 필요한 결말 표시 정보만 만든다", () => {
    const vm = toEndingEditorViewModel(node("end-1", {
      label: "진실",
      icon: "⚖️",
      description: "정답 결말",
      endingContent: "범인이 밝혀졌다.",
    }), 2);

    expect(vm).toMatchObject({
      id: "end-1",
      name: "진실",
      icon: "⚖️",
      description: "정답 결말",
      contentPreview: "범인이 밝혀졌다.",
      isReady: true,
    });
    expect(vm.badges).toContain("도달 경로 2개");
  });

  it("결말 준비 상태와 제작자용 경고를 요약한다", () => {
    const nodes: Node[] = [
      node("end-1", { label: "진실", endingContent: "범인이 밝혀졌다." }),
      node("end-2", { label: "오판" }),
      { id: "phase-1", type: "phase", position: { x: 0, y: 0 }, data: { label: "투표" } },
    ];

    const summary = buildEndingDecisionSummary(nodes, [edge("e1", "end-1")]);

    expect(summary.totalCount).toBe(2);
    expect(summary.readyCount).toBe(1);
    expect(summary.connectedCount).toBe(1);
    expect(summary.defaultEndingName).toBe("진실");
    expect(summary.warnings).toContain("1개 결말은 이름 또는 본문이 비어 있습니다.");
  });

  it("결말이 없으면 다음 행동을 알려준다", () => {
    const summary = buildEndingDecisionSummary([], []);

    expect(summary.totalCount).toBe(0);
    expect(summary.warnings).toEqual(["최종 장면에서 보여줄 결말을 1개 이상 추가해 주세요."]);
  });
});
