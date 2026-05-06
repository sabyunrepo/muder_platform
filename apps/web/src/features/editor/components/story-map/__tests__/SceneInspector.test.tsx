import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Node } from "@xyflow/react";
import type { FlowNodeData } from "@/features/editor/flowTypes";
import { DELIVER_INFORMATION_ACTION } from "@/features/editor/entities/shared/actionAdapter";
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
          roomKind: "all",
          mainRoomName: "전체 토론",
          privateRoomsEnabled: false,
          privateRoomName: "비밀 대화",
          participantMode: "all",
          availability: "phase_active",
          closeBehavior: "close_on_exit",
        },
        onEnter: [
          {
            type: DELIVER_INFORMATION_ACTION,
            params: {
              deliveries: [
                {
                  id: "delivery-1",
                  target: { type: "all_players" },
                  reading_section_ids: ["reading-1"],
                  story_info_ids: ["info-1", "info-2"],
                },
              ],
            },
          },
          { type: "give_clue", params: {} },
          { type: "SET_BGM", params: { mediaId: "media-1" } },
        ],
        onExit: [{ type: "MUTE_CHAT" }],
      },
    };

    render(
      <SceneInspector
        selectedScene={scene}
        selectedSceneEdges={[
          {
            id: "edge-1",
            source: "scene-1",
            target: "scene-2",
            data: {
              condition: {
                id: "condition-1",
                operator: "AND",
                rules: [
                  {
                    id: "rule-1",
                    variable: "clue_held",
                    target_character_id: "char-1",
                    target_clue_id: "clue-1",
                    comparator: "=",
                    value: "true",
                  },
                ],
              },
            },
          },
        ]}
        selectedEntity={{
          id: "clue-1",
          kind: "clue",
          section: "단서",
          title: "찢어진 초대장",
          detail: "미배치",
          connectable: true,
        }}
      />,
    );

    expect(screen.getByText("오프닝")).toBeDefined();
    expect(screen.getByText("스토리 장면")).toBeDefined();
    expect(screen.getByText("찢어진 초대장")).toBeDefined();
    expect(screen.getByText("공개 설정 1개 · 읽기 대사 1개 · 스토리 정보 2개")).toBeDefined();
    expect(screen.getByText("단서 실행 1개")).toBeDefined();
    expect(screen.getByText("BGM 재생")).toBeDefined();
    expect(screen.getByText("자동 진행 · 기본 이동 없음 · 조건 이동 1개")).toBeDefined();
    expect(screen.getByText("시작: 직접 설정한 실행 · 종료: 채팅 닫기")).toBeDefined();
    expect(
      screen.getByText("장면 시작 시 · 전원 참여 · 장면 종료 시 닫기 · 전체 토론: 전체 토론"),
    ).toBeDefined();
  });
});
