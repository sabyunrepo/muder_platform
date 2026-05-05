import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Node } from "@xyflow/react";
import type { FlowNodeData } from "@/features/editor/flowTypes";
import { SceneInspector } from "../SceneInspector";

describe("SceneInspector", () => {
  it("장면이 선택되지 않았을 때 제작자용 점검 항목을 표시한다", () => {
    render(<SceneInspector selectedScene={null} selectedEntity={null} />);

    expect(screen.getByText("선택한 장면 없음")).toBeDefined();
    expect(screen.getByText("정보 공개")).toBeDefined();
    expect(screen.getByText("단서 배포")).toBeDefined();
    expect(screen.getByText("조사권")).toBeDefined();
    expect(screen.getByText("토론방")).toBeDefined();
    expect(screen.getByText("연출")).toBeDefined();
    expect(screen.getByText("조건")).toBeDefined();
    expect(screen.getByText("액션")).toBeDefined();
  });

  it("선택한 장면과 연결 대상 요약을 표시한다", () => {
    const scene: Node<FlowNodeData> = {
      id: "scene-1",
      type: "phase",
      position: { x: 0, y: 0 },
      data: {
        label: "오프닝",
        description: "도입 장면",
        discussionRoomPolicy: {
          enabled: true,
          mainRoomName: "전체 토론",
          privateRoomsEnabled: false,
          privateRoomName: "비밀 대화",
          availability: "phase_active",
        },
        onEnter: [{ type: "give_clue", params: {} }],
      },
    };

    render(
      <SceneInspector
        selectedScene={scene}
        selectedEntity={{
          id: "clue-1",
          kind: "clue",
          section: "단서",
          title: "찢어진 초대장",
          detail: "미배치",
        }}
      />,
    );

    expect(screen.getByText("오프닝")).toBeDefined();
    expect(screen.getByText("스토리 장면")).toBeDefined();
    expect(screen.getByText("찢어진 초대장")).toBeDefined();
    expect(screen.getByText("장면 설명 있음")).toBeDefined();
    expect(screen.getByText("입장 시 단서 동작 있음")).toBeDefined();
    expect(screen.getByText("사용")).toBeDefined();
  });
});
