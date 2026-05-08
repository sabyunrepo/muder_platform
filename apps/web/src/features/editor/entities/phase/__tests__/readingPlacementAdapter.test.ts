import { describe, expect, it } from "vitest";
import type { FlowNodeData } from "../../../flowTypes";
import { DELIVER_INFORMATION_ACTION } from "../../shared/actionAdapter";
import {
  flowNodeToReadingPlacement,
  readingPlacementToFlowNodePatch,
} from "../readingPlacementAdapter";

describe("readingPlacementAdapter", () => {
  it("기존 정보 공개 action에 섞인 읽기 대사 id를 전용 ViewModel로 모은다", () => {
    const data: FlowNodeData = {
      onEnter: [
        {
          id: "info",
          type: DELIVER_INFORMATION_ACTION,
          params: {
            deliveries: [
              { id: "d1", target: { type: "character", character_id: "char-1" }, reading_section_ids: ["rs-1", "rs-2", "rs-1"] },
              { id: "d2", target: { type: "all_players" }, readingSectionIds: ["rs-common"] },
            ],
          },
        },
      ],
    };

    expect(flowNodeToReadingPlacement(data)).toEqual({
      readingSectionIds: ["rs-1", "rs-2", "rs-common"],
    });
  });

  it("신규 저장은 모든 플레이어 대상의 읽기 대사 전용 delivery로 분리한다", () => {
    const patch = readingPlacementToFlowNodePatch(
      { onEnter: [{ id: "bgm", type: "play_bgm" }] },
      ["rs-1", "rs-2", "rs-1"],
    );

    expect(patch.onEnter).toEqual([
      { id: "bgm", type: "play_bgm" },
      {
        id: expect.any(String),
        type: DELIVER_INFORMATION_ACTION,
        params: {
          deliveries: [
            {
              id: "reading-placement",
              target: { type: "all_players" },
              reading_section_ids: ["rs-1", "rs-2"],
              story_info_ids: [],
            },
          ],
        },
      },
    ]);
  });

  it("읽기 대사만 제거해도 기존 정보 공개 delivery는 보존한다", () => {
    const data: FlowNodeData = {
      onEnter: [
        {
          id: "info",
          type: DELIVER_INFORMATION_ACTION,
          params: {
            deliveries: [
              {
                id: "mixed",
                target: { type: "character", character_id: "char-1" },
                reading_section_ids: ["rs-1"],
                story_info_ids: ["info-1"],
              },
            ],
          },
        },
      ],
    };

    expect(readingPlacementToFlowNodePatch(data, [])).toEqual({
      onEnter: [
        {
          id: "info",
          type: DELIVER_INFORMATION_ACTION,
          params: {
            deliveries: [
              {
                id: "mixed",
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
