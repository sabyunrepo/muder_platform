import { cleanup, render, screen } from "@testing-library/react";
import type { Node } from "@xyflow/react";
import { afterEach, describe, expect, it } from "vitest";
import type { FlowNodeData } from "@/features/editor/flowTypes";
import { SceneInspector } from "../SceneInspector";
import type { StoryLibraryEntity } from "../EditorEntityLibrary";

afterEach(() => {
  cleanup();
});

describe("SceneInspector", () => {
  it("장면이 없으면 제작자 언어의 빈 요약을 표시한다", () => {
    render(<SceneInspector selectedScene={null} selectedEntity={null} />);

    expect(screen.getByText("선택한 장면 없음")).toBeDefined();
    expect(screen.getByText("장면을 선택하면 공개할 정보를 확인합니다.")).toBeDefined();
    expect(screen.getByText("장면을 선택하면 실행 동작을 확인합니다.")).toBeDefined();
  });

  it("선택한 장면의 공개, 토론방, 조건, 액션 요약을 표시한다", () => {
    const scene: Node<FlowNodeData> = {
      id: "scene-1",
      type: "phase",
      position: { x: 0, y: 0 },
      data: {
        label: "오프닝",
        description: "도입 장면",
        autoAdvance: true,
        onEnter: [{ type: "give_clue" }],
        onExit: [{ type: "open_location" }],
        discussionRoomPolicy: {
          enabled: true,
          mainRoomName: "전체 토론",
          privateRoomsEnabled: false,
          privateRoomName: "비밀 대화",
          availability: "phase_active",
        },
      },
    };

    render(<SceneInspector selectedScene={scene} selectedEntity={null} />);

    expect(screen.getByText("오프닝")).toBeDefined();
    expect(screen.getByText("스토리 장면")).toBeDefined();
    expect(screen.getByText("장면 설명 있음")).toBeDefined();
    expect(screen.getByText("입장 시 단서 동작 있음")).toBeDefined();
    expect(screen.getByText("사용")).toBeDefined();
    expect(screen.getByText("자동 진행")).toBeDefined();
    expect(screen.getByText("입장 1개 설정됨 · 퇴장 1개 설정됨")).toBeDefined();
  });

  it("선택한 라이브러리 항목을 연결 대상으로 표시한다", () => {
    const entity: StoryLibraryEntity = {
      id: "clue-1",
      kind: "clue",
      title: "찢어진 초대장",
      detail: "공통 단서",
      section: "단서",
      connectable: true,
    };

    render(<SceneInspector selectedScene={null} selectedEntity={entity} />);

    expect(screen.getByText("찢어진 초대장")).toBeDefined();
    expect(screen.getByText("단서 · 공통 단서")).toBeDefined();
  });
});
