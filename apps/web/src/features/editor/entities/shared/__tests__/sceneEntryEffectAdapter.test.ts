import { afterAll, describe, expect, it, vi } from "vitest";
import {
  DELIVER_INFORMATION_ACTION,
  GRANT_CLUE_ACTION,
  flowNodeToSceneEntryEffects,
  sceneEntryEffectsToFlowNodePatch,
} from "../sceneEntryEffectAdapter";

vi.stubGlobal("crypto", { randomUUID: () => "generated-id" });

afterAll(() => {
  vi.unstubAllGlobals();
});

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

  it("같은 타입의 장면 진입 action이 여러 개면 모두 읽어서 병합한다", () => {
    expect(
      flowNodeToSceneEntryEffects({
        onEnter: [
          {
            id: "info-action-1",
            type: DELIVER_INFORMATION_ACTION,
            params: {
              deliveries: [
                {
                  id: "effect-1",
                  target: { type: "character", character_id: "char-1" },
                  story_info_ids: ["info-1"],
                },
              ],
            },
          },
          {
            id: "info-action-2",
            type: DELIVER_INFORMATION_ACTION,
            params: {
              deliveries: [
                {
                  id: "effect-2",
                  target: { type: "character", character_id: "char-2" },
                  story_info_ids: ["info-2"],
                },
              ],
            },
          },
          {
            id: "clue-action-1",
            type: GRANT_CLUE_ACTION,
            params: {
              deliveries: [
                {
                  id: "effect-1",
                  target: { type: "character", character_id: "char-1" },
                  clue_ids: ["clue-1"],
                },
              ],
            },
          },
          {
            id: "clue-action-2",
            type: GRANT_CLUE_ACTION,
            params: {
              deliveries: [
                {
                  id: "effect-2",
                  target: { type: "character", character_id: "char-2" },
                  clue_ids: ["clue-2"],
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
        clueIds: ["clue-1"],
      },
      {
        id: "effect-2",
        recipientType: "character",
        characterId: "char-2",
        storyInfoIds: ["info-2"],
        clueIds: ["clue-2"],
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

  it("장면 진입 효과 저장 시 기존 읽기 대사 delivery 연결을 보존한다", () => {
    expect(
      sceneEntryEffectsToFlowNodePatch(
        {
          onEnter: [
            {
              id: "info-action",
              type: DELIVER_INFORMATION_ACTION,
              params: {
                deliveries: [
                  {
                    id: "effect-1",
                    target: { type: "character", character_id: "char-1" },
                    reading_section_ids: ["reading-1", "reading-1"],
                    story_info_ids: ["old-info"],
                  },
                ],
              },
            },
          ],
        },
        [
          {
            id: "effect-1",
            recipientType: "character",
            characterId: "char-1",
            storyInfoIds: ["new-info"],
            clueIds: [],
          },
        ],
      ),
    ).toEqual({
      onEnter: [
        {
          id: "info-action",
          type: DELIVER_INFORMATION_ACTION,
          params: {
            deliveries: [
              {
                id: "effect-1",
                target: { type: "character", character_id: "char-1" },
                reading_section_ids: ["reading-1"],
                story_info_ids: ["new-info"],
              },
            ],
          },
        },
      ],
    });
  });

  it("읽기 대사 delivery 연결은 같은 effect id라도 대상이 다르면 섞지 않는다", () => {
    expect(
      sceneEntryEffectsToFlowNodePatch(
        {
          onEnter: [
            {
              id: "info-action",
              type: DELIVER_INFORMATION_ACTION,
              params: {
                deliveries: [
                  {
                    id: "effect-1",
                    target: { type: "character", character_id: "char-old" },
                    reading_section_ids: ["reading-old"],
                    story_info_ids: ["old-info"],
                  },
                ],
              },
            },
          ],
        },
        [
          {
            id: "effect-1",
            recipientType: "character",
            characterId: "char-new",
            storyInfoIds: ["new-info"],
            clueIds: [],
          },
        ],
      ),
    ).toEqual({
      onEnter: [
        {
          id: "info-action",
          type: DELIVER_INFORMATION_ACTION,
          params: {
            deliveries: [
              {
                id: "effect-1",
                target: { type: "character", character_id: "char-new" },
                reading_section_ids: [],
                story_info_ids: ["new-info"],
              },
            ],
          },
        },
      ],
    });
  });
});
