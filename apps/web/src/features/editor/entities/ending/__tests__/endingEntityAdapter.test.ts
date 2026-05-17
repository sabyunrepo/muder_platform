import { describe, expect, it } from "vitest";
import type { Edge, Node } from "@xyflow/react";
import {
  buildCharacterEndcardSummary,
  buildEndingDecisionSummary,
  toEndingEditorViewModel,
} from "../endingEntityAdapter";

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
      endingContent: "범인이 밝혀졌다.",
    }));

    expect(vm).toMatchObject({
      id: "end-1",
      name: "진실",
      contentPreview: "범인이 밝혀졌다.",
      isReady: true,
    });
    expect(vm.badges).toContain("조건 없음");
    expect(vm.badges).not.toContain("참가자에게만 공개");
  });

  it("결말 목록 배지는 조건 그룹과 기본 결말 상태를 표시한다", () => {
    const vm = toEndingEditorViewModel(node("end-1", {
      label: "진실",
      endingContent: "범인이 밝혀졌다.",
    }), {
      conditionGroupCount: 2,
      isDefaultEnding: true,
    });

    expect(vm.badges).toEqual(["이름 있음", "본문 작성됨", "기본 결말", "조건 그룹 2개"]);
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

  it("캐릭터별 결과 카드 작성 현황을 요약한다", () => {
    const summary = buildCharacterEndcardSummary([
      { name: "하윤", endcard_title: "후일담", endcard_body: "", endcard_image_url: null },
      { name: "민재", endcard_title: null, endcard_body: null, endcard_image_url: null },
      { name: "서윤", endcard_title: "", endcard_body: "남겨진 이야기", endcard_image_url: "" },
    ]);

    expect(summary).toEqual({
      totalCount: 3,
      readyCount: 2,
      missingNames: ["민재"],
    });
  });
});
