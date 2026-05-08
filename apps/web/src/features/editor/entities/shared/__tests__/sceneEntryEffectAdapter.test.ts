import { describe, expect, it, vi } from "vitest";
import {
  DELIVER_INFORMATION_ACTION,
  GRANT_CLUE_ACTION,
  flowNodeToSceneEntryEffects,
  sceneEntryEffectsToFlowNodePatch,
} from "../sceneEntryEffectAdapter";

vi.stubGlobal("crypto", { randomUUID: () => "generated-id" });

describe("sceneEntryEffectAdapter", () => {
  it("정보 공개와 단서 지급 action을 대상별 장면 진입 효과로 병합한다", () => {
    expect(
      flowNodeToSceneEntryEffects({
        onEnter: [
          {
            id: "info-action",
            type: DELIVER_INFORMATION_ACTION,
            params: {
              deliveries: [
                {
                  id: "effect-1",
                  target: { type: "character", character_id: "char-1" },
                  story_info_ids: ["info-1", "info-1"],
                },
              ],
            },
          },
          {
            id: "clue-action",
            type: GRANT_CLUE_ACTION,
            params: {
              deliveries: [
                {
                  id: "effect-1",
                  target: { type: "character", character_id: "char-1" },
                  clue_ids: ["clue-2", "clue-1", "clue-1"],
                },
              ],
            },
          },
        ],
      }),
    ).toEqual([
      {
        id: "effect-1",
        recipientType: "character",
        characterId: "char-1",
        storyInfoIds: ["info-1"],
        clueIds: ["clue-2", "clue-1"],
      },
    ]);
  });

  it("정보와 단서를 각각 런타임 action으로 저장하고 빈 effect는 제거한다", () => {
    expect(
      sceneEntryEffectsToFlowNodePatch(
        { onEnter: [{ id: "keep", type: "SET_BGM" }] },
        [
          {
            id: "empty",
            recipientType: "character",
            characterId: "char-1",
            storyInfoIds: [],
            clueIds: [],
          },
          {
            id: "effect-1",
            recipientType: "all_players",
            storyInfoIds: ["info-1", "info-1"],
            clueIds: ["clue-1", "clue-1"],
          },
        ],
      ),
    ).toEqual({
      onEnter: [
        { id: "keep", type: "SET_BGM" },
        {
          id: "generated-id",
          type: DELIVER_INFORMATION_ACTION,
          params: {
            deliveries: [
              {
                id: "effect-1",
                target: { type: "all_players" },
                reading_section_ids: [],
                story_info_ids: ["info-1"],
              },
            ],
          },
        },
        {
          id: "generated-id",
          type: GRANT_CLUE_ACTION,
          params: {
            deliveries: [
              {
                id: "effect-1",
                target: { type: "all_players" },
                clue_ids: ["clue-1"],
              },
            ],
          },
        },
      ],
    });
  });
});
