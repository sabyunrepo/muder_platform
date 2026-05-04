import type { Edge } from "@xyflow/react";
import { describe, expect, it, vi } from "vitest";
import type { FlowNodeData } from "../../../flowTypes";
import {
  DELIVER_INFORMATION_ACTION,
  flowNodeToInformationDeliveries,
  informationDeliveriesToFlowNodePatch,
  toPhaseEditorViewModel,
} from "../phaseEntityAdapter";

vi.stubGlobal("crypto", { randomUUID: () => "generated-id" });

describe("phaseEntityAdapter", () => {
  it("API flow node의 정보 전달 action을 제작자용 ViewModel로 변환한다", () => {
    const data: FlowNodeData = {
      onEnter: [
        { id: "a1", type: "broadcast", params: { message: "시작" } },
        {
          id: "info-1",
          type: DELIVER_INFORMATION_ACTION,
          params: {
            deliveries: [
              {
                id: "d1",
                target: { type: "character", character_id: "char-1" },
                reading_section_ids: ["rs-1", "rs-2", "rs-1"],
              },
              {
                id: "d2",
                target: { type: "all_players" },
                reading_section_ids: ["rs-common"],
              },
            ],
          },
        },
      ],
    };

    expect(flowNodeToInformationDeliveries(data)).toEqual([
      {
        id: "d1",
        recipientType: "character",
        characterId: "char-1",
        readingSectionIds: ["rs-1", "rs-2"],
      },
      {
        id: "d2",
        recipientType: "all_players",
        readingSectionIds: ["rs-common"],
      },
    ]);
  });

  it("정보 전달 ViewModel을 기존 onEnter action과 함께 round-trip 저장 payload로 되돌린다", () => {
    const data: FlowNodeData = {
      onEnter: [
        { id: "legacy", type: "deliver_information", params: { deliveries: [] } },
        { id: "bgm", type: "play_bgm", params: { mediaId: "bgm-1" } },
      ],
    };

    const patch = informationDeliveriesToFlowNodePatch(data, [
      {
        id: "draft",
        recipientType: "character",
        readingSectionIds: [],
      },
      {
        id: "d1",
        recipientType: "character",
        characterId: "char-1",
        readingSectionIds: ["rs-1", "rs-2", "rs-1"],
      },
    ]);

    expect(patch.onEnter).toEqual([
      { id: "bgm", type: "play_bgm", params: { mediaId: "bgm-1" } },
      {
        id: "legacy",
        type: DELIVER_INFORMATION_ACTION,
        params: {
          deliveries: [
            {
              id: "d1",
              target: { type: "character", character_id: "char-1" },
              reading_section_ids: ["rs-1", "rs-2"],
            },
          ],
        },
      },
    ]);
  });

  it("마지막 전달 설정을 삭제하면 정보 전달 action만 제거하고 다른 action은 유지한다", () => {
    const data: FlowNodeData = {
      onEnter: [
        { id: "info", type: DELIVER_INFORMATION_ACTION, params: { deliveries: [] } },
        { id: "chat", type: "enable_chat" },
      ],
    };

    expect(informationDeliveriesToFlowNodePatch(data, [])).toEqual({
      onEnter: [{ id: "chat", type: "enable_chat" }],
    });
  });

  it("스토리 진행 페이즈가 아니면 all_players 전달 설정을 저장하지 않는다", () => {
    expect(
      informationDeliveriesToFlowNodePatch(
        { phase_type: "investigation" },
        [
          {
            id: "all",
            recipientType: "all_players",
            readingSectionIds: ["rs-common"],
          },
        ],
      ),
    ).toEqual({ onEnter: [] });

    expect(
      informationDeliveriesToFlowNodePatch(
        { phase_type: "story_progression" },
        [
          {
            id: "all",
            recipientType: "all_players",
            readingSectionIds: ["rs-common"],
          },
        ],
      ).onEnter,
    ).toEqual([
      {
        id: "generated-id",
        type: DELIVER_INFORMATION_ACTION,
        params: {
          deliveries: [
            {
              id: "all",
              target: { type: "all_players" },
              reading_section_ids: ["rs-common"],
            },
          ],
        },
      },
    ]);
  });

  it("페이즈 설정과 연결 상태를 제작자용 요약 ViewModel로 변환한다", () => {
    const data: FlowNodeData = {
      label: "1차 조사",
      phase_type: "investigation",
      duration: 25,
      rounds: 3,
      autoAdvance: true,
      warningAt: 120,
      onEnter: [
        { type: "play_bgm" },
        {
          type: DELIVER_INFORMATION_ACTION,
          params: { deliveries: [{ target: { type: "character", character_id: "char-1" }, reading_section_ids: ["rs-1"] }] },
        },
      ],
      onExit: [{ type: "disable_chat" }],
    };
    const edges: Edge[] = [
      { id: "e1", source: "phase-1", target: "phase-2" },
      {
        id: "e2",
        source: "phase-1",
        target: "ending-1",
        data: { condition: { type: "has_clue", clueId: "clue-1" } },
      },
    ];

    expect(toPhaseEditorViewModel(data, edges)).toMatchObject({
      title: "1차 조사",
      phaseTypeLabel: "수사",
      durationLabel: "25분",
      roundLabel: "3라운드",
      autoAdvanceLabel: "자동 진행",
      warningLabel: "120초 전에 경고",
      informationDeliveryCount: 1,
      enterActionLabels: ["BGM 재생"],
      exitActionLabels: ["채팅 닫기"],
      defaultTransitionLabel: "기본 이동 1개",
      conditionalTransitionCount: 1,
    });
  });
});
