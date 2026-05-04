import { describe, expect, it } from "vitest";
import {
  filterReadingSectionOptions,
  toReadingSectionPickerOption,
  toReadingSectionPickerOptions,
} from "../readingSectionAdapter";

const section = {
  id: "rs-1",
  themeId: "theme-1",
  name: "비밀 편지",
  bgmMediaId: "bgm-1",
  sortOrder: 2,
  version: 1,
  createdAt: "2026-05-04T00:00:00Z",
  updatedAt: "2026-05-04T00:00:00Z",
  lines: [
    { Index: 0, Text: "서재에서 발견한 편지입니다.", Speaker: "하윤" },
    { Index: 1, Text: "봉투에는 낯선 문장이 적혀 있습니다.", Speaker: "민재" },
  ],
};

describe("readingSectionAdapter", () => {
  it("스토리 정보를 제작자용 선택 ViewModel로 변환한다", () => {
    expect(toReadingSectionPickerOption(section)).toEqual({
      id: "rs-1",
      name: "비밀 편지",
      summary: "서재에서 발견한 편지입니다. 봉투에는 낯선 문장이 적혀 있습니다.",
      metaLabel: "2줄 · BGM 있음",
      groupLabel: "합독 정보",
    });
  });

  it("정렬과 빈 내용 fallback을 제공한다", () => {
    const options = toReadingSectionPickerOptions([
      { ...section, id: "rs-2", name: "나중", sortOrder: 10 },
      { ...section, id: "rs-0", name: "먼저", sortOrder: 1, lines: [] },
    ]);

    expect(options.map((option) => option.name)).toEqual(["먼저", "나중"]);
    expect(options[0].summary).toBe("아직 작성된 내용이 없습니다.");
    expect(options[0].groupLabel).toBe("빈 정보");
  });

  it("제목, 요약, 그룹명으로 검색한다", () => {
    const options = toReadingSectionPickerOptions([section]);

    expect(filterReadingSectionOptions(options, "편지")).toHaveLength(1);
    expect(filterReadingSectionOptions(options, "합독")).toHaveLength(1);
    expect(filterReadingSectionOptions(options, "없음")).toHaveLength(0);
  });
});
