import { describe, expect, it } from "vitest";

import type { ClueResponse, LocationResponse } from "@/features/editor/api";
import { buildRoundVisibilityPreview } from "../roundVisibilityPreview";

const baseLocation = {
  id: "loc-1",
  theme_id: "theme-1",
  map_id: "map-1",
  name: "응접실",
  restricted_characters: null,
  image_url: null,
  sort_order: 1,
  created_at: "2026-05-06T00:00:00Z",
} satisfies LocationResponse;

const baseClue = {
  id: "clue-1",
  theme_id: "theme-1",
  location_id: "loc-1",
  name: "찢어진 초대장",
  description: null,
  image_url: null,
  is_common: false,
  level: 1,
  sort_order: 1,
  created_at: "2026-05-06T00:00:00Z",
  is_usable: false,
  use_effect: null,
  use_target: null,
  use_consumed: false,
} satisfies ClueResponse;

describe("buildRoundVisibilityPreview", () => {
  it("장소와 단서의 공개 라운드를 라운드별 미리보기로 변환한다", () => {
    const previews = buildRoundVisibilityPreview(
      [{ ...baseClue, reveal_round: 2, hide_round: 3 }],
      [{ ...baseLocation, from_round: 1, until_round: 2 }],
    );

    expect(previews).toHaveLength(3);
    expect(previews[0].label).toBe("1라운드");
    expect(previews[0].locations.map((item) => item.name)).toEqual(["응접실"]);
    expect(previews[0].clues).toHaveLength(0);
    expect(previews[1].clues.map((item) => item.name)).toEqual(["찢어진 초대장"]);
    expect(previews[2].locations).toHaveLength(0);
  });

  it("단서가 보이는 라운드에 연결 장소가 숨겨져 있으면 제작자용 경고를 만든다", () => {
    const previews = buildRoundVisibilityPreview(
      [{ ...baseClue, reveal_round: 3, hide_round: 3 }],
      [{ ...baseLocation, from_round: 1, until_round: 2 }],
    );

    expect(previews[2].warnings).toEqual([
      {
        id: "hidden-location:clue-1:3",
        message: "찢어진 초대장 단서는 공개되지만 응접실 장소는 이 라운드에 보이지 않습니다.",
      },
    ]);
  });

  it("잘못된 라운드 범위와 삭제된 장소 연결을 raw key 없이 설명한다", () => {
    const previews = buildRoundVisibilityPreview(
      [
        { ...baseClue, id: "bad-clue", name: "잘못된 단서", reveal_round: 5, hide_round: 2 },
        { ...baseClue, id: "lost-clue", name: "분실된 단서", location_id: "missing" },
      ],
      [{ ...baseLocation, from_round: 3, until_round: 1 }],
      1,
    );

    const messages = previews[0].warnings.map((warning) => warning.message);
    expect(messages).toContain("응접실 장소의 등장/퇴장 라운드가 서로 맞지 않습니다.");
    expect(messages).toContain("잘못된 단서 단서의 공개/사라짐 라운드가 서로 맞지 않습니다.");
    expect(messages).toContain("분실된 단서 단서가 삭제되었거나 찾을 수 없는 장소에 연결되어 있습니다.");
  });
});
