import { describe, expect, it, vi } from "vitest";
import {
  DELIVER_INFORMATION_ACTION,
  flowNodeToInformationDeliveries,
  informationDeliveriesToFlowNodePatch,
} from "../informationDeliveryAdapter";

vi.stubGlobal("crypto", { randomUUID: () => "generated-id" });

describe("informationDeliveryAdapter", () => {
  it("legacy/current 정보 전달 payload를 같은 ViewModel로 정규화한다", () => {
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
      },
    ]);
  });

  it("완성된 전달 설정만 current payload로 저장한다", () => {
    expect(
      informationDeliveriesToFlowNodePatch(
        { phase_type: "story_progression" },
        [
          { id: "empty", recipientType: "character", readingSectionIds: [] },
          { id: "all", recipientType: "all_players", readingSectionIds: ["rs-1"] },
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
              },
            ],
          },
        },
      ],
    });
  });
});
