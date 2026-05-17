import { describe, expect, it, vi } from "vitest";
import type { FlowNodeData } from "../../../flowTypes";
import {
  readInfoDeliveryTarget,
  targetsEqual,
  writeInfoDeliveryTarget,
} from "../infoDeliverySettingsAdapter";

vi.stubGlobal("crypto", {
  randomUUID: vi.fn(() => "new-effect-id"),
});

describe("infoDeliverySettingsAdapter", () => {
  it("reads all-player and character delivery targets for one info", () => {
    const data: FlowNodeData = {
      onEnter: [
        {
          id: "info-action",
          type: "DELIVER_INFORMATION",
          params: {
            deliveries: [
              {
                id: "all",
                target: { type: "all_players" },
                story_info_ids: ["info-1"],
              },
              {
                id: "char",
                target: { type: "character", character_id: "char-1" },
                story_info_ids: ["info-2"],
              },
            ],
          },
        },
      ],
    };

    expect(readInfoDeliveryTarget(data, "info-1")).toEqual({ mode: "all_players", characterIds: [] });
    expect(readInfoDeliveryTarget(data, "info-2")).toEqual({ mode: "characters", characterIds: ["char-1"] });
  });

  it("writes one info target without removing other info or clue grants", () => {
    const data: FlowNodeData = {
      onEnter: [
        { id: "bgm", type: "SET_BGM", params: { mediaId: "m1" } },
        {
          id: "info-action",
          type: "DELIVER_INFORMATION",
          params: {
            deliveries: [
              {
                id: "all",
                target: { type: "all_players" },
                reading_section_ids: ["read-1"],
                story_info_ids: ["info-1", "info-2"],
              },
            ],
          },
        },
        {
          id: "clue-action",
          type: "GRANT_CLUE",
          params: {
            deliveries: [
              {
                id: "clue",
                target: { type: "all_players" },
                clue_ids: ["clue-1"],
              },
            ],
          },
        },
      ],
    };

    const patch = writeInfoDeliveryTarget(data, "info-1", {
      mode: "characters",
      characterIds: ["char-1", "char-1"],
    });

    expect(patch.onEnter).toEqual([
      { id: "bgm", type: "SET_BGM", params: { mediaId: "m1" } },
      expect.objectContaining({
        id: "info-action",
        type: "DELIVER_INFORMATION",
        params: {
          deliveries: [
            {
              id: "all",
              target: { type: "all_players" },
              reading_section_ids: ["read-1"],
              story_info_ids: ["info-2"],
            },
            {
              id: "new-effect-id",
              target: { type: "character", character_id: "char-1" },
              reading_section_ids: [],
              story_info_ids: ["info-1"],
            },
          ],
        },
      }),
      expect.objectContaining({
        id: "clue-action",
        type: "GRANT_CLUE",
      }),
    ]);
  });

  it("removes the info delivery action when the selected info is no longer delivered", () => {
    const patch = writeInfoDeliveryTarget(
      {
        onEnter: [
          {
            id: "info-action",
            type: "DELIVER_INFORMATION",
            params: {
              deliveries: [
                {
                  id: "all",
                  target: { type: "all_players" },
                  story_info_ids: ["info-1"],
                },
              ],
            },
          },
        ],
      },
      "info-1",
      { mode: "none", characterIds: [] },
    );

    expect(patch.onEnter).toEqual([]);
  });

  it("compares normalized targets", () => {
    expect(
      targetsEqual(
        { mode: "characters", characterIds: ["char-1", "char-1"] },
        { mode: "characters", characterIds: ["char-1"] },
      ),
    ).toBe(true);
    expect(targetsEqual({ mode: "characters", characterIds: [] }, { mode: "none", characterIds: [] })).toBe(true);
  });
});
