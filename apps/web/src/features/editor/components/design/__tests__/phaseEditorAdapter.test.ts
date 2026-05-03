import { describe, expect, it, vi } from "vitest";
import type { FlowNodeData } from "../../../flowTypes";
import {
  DELIVER_INFORMATION_ACTION,
  flowNodeToInformationDeliveries,
  informationDeliveriesToFlowNodePatch,
} from "../phaseEditorAdapter";

vi.stubGlobal("crypto", { randomUUID: () => "generated-id" });

describe("phaseEditorAdapter", () => {
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

  it("미완성 전달 설정은 저장 payload에서 제외한다", () => {
    const data: FlowNodeData = { onEnter: [{ id: "chat", type: "enable_chat" }] };

    expect(
      informationDeliveriesToFlowNodePatch(data, [
        { id: "empty", recipientType: "character", readingSectionIds: [] },
        { id: "no-character", recipientType: "character", readingSectionIds: ["rs-1"] },
        { id: "no-section", recipientType: "all_players", readingSectionIds: [] },
      ]),
    ).toEqual({ onEnter: [{ id: "chat", type: "enable_chat" }] });
  });

});
