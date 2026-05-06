import { describe, expect, it, vi } from "vitest";
import {
  DELIVER_INFORMATION_ACTION,
  flowNodeToInformationDeliveries,
  informationDeliveriesToFlowNodePatch,
} from "../informationDeliveryAdapter";

vi.stubGlobal("crypto", { randomUUID: () => "generated-id" });

describe("informationDeliveryAdapter", () => {
  it("legacy/current 정보 공개 payload를 같은 ViewModel로 정규화한다", () => {
    expect(
      flowNodeToInformationDeliveries({
        onEnter: [
          {
            type: "deliver_information",
            params: {
              deliveries: [
                {
                  id: "d1",
                  recipient_type: "character",
                  character_id: "char-1",
                  readingSectionIds: ["rs-1", "rs-1"],
                  storyInfoIds: ["info-1", "info-1"],
                },
              ],
            },
          },
        ],
      }),
    ).toEqual([
      {
        id: "d1",
        recipientType: "character",
        characterId: "char-1",
        readingSectionIds: ["rs-1"],
        storyInfoIds: ["info-1"],
      },
    ]);
  });

  it("완성된 공개 설정을 모든 페이즈에서 current payload로 저장한다", () => {
    expect(
      informationDeliveriesToFlowNodePatch(
        { phase_type: "investigation" },
        [
          {
            id: "empty",
            recipientType: "character",
            readingSectionIds: [],
            storyInfoIds: [],
          },
          {
            id: "all",
            recipientType: "all_players",
            readingSectionIds: ["rs-1"],
            storyInfoIds: ["info-1"],
          },
        ],
      ),
    ).toEqual({
      onEnter: [
        {
          id: "generated-id",
          type: DELIVER_INFORMATION_ACTION,
          params: {
            deliveries: [
              {
                id: "all",
                target: { type: "all_players" },
                reading_section_ids: ["rs-1"],
                story_info_ids: ["info-1"],
              },
            ],
          },
        },
      ],
    });
  });

  it("정보 카드만 연결한 공개 설정도 완성된 payload로 저장한다", () => {
    expect(
      informationDeliveriesToFlowNodePatch(
        { phase_type: "story_progression" },
        [
          {
            id: "info-only",
            recipientType: "character",
            characterId: "char-1",
            readingSectionIds: [],
            storyInfoIds: ["info-1", "info-1"],
          },
        ],
      ),
    ).toEqual({
      onEnter: [
        {
          id: "generated-id",
          type: DELIVER_INFORMATION_ACTION,
          params: {
            deliveries: [
              {
                id: "info-only",
                target: { type: "character", character_id: "char-1" },
                reading_section_ids: [],
                story_info_ids: ["info-1"],
              },
            ],
          },
        },
      ],
    });
  });
});
