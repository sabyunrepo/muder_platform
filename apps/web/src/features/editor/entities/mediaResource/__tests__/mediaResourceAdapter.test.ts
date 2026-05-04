import { describe, expect, it } from "vitest";

import type { MediaResponse } from "@/features/editor/mediaApi";
import {
  filterMediaResourceViewModels,
  formatMediaDuration,
  formatMediaFileSize,
  getAllowedMediaTypesForUseCase,
  isMediaSelectableForUseCase,
  toMediaResourceViewModel,
} from "../mediaResourceAdapter";

const baseMedia: MediaResponse = {
  id: "media-1",
  theme_id: "theme-1",
  name: "  오프닝 테마  ",
  type: "BGM",
  source_type: "FILE",
  url: "https://storage.example.com/private/object-key.mp3",
  duration: 125,
  file_size: 1_572_864,
  mime_type: "audio/mpeg",
  tags: ["오프닝", "긴장"],
  sort_order: 1,
  created_at: "2026-05-04T00:00:00Z",
};

describe("mediaResourceAdapter", () => {
  it("MediaResponse를 제작자용 ViewModel로 변환하고 raw URL을 노출하지 않는다", () => {
    const vm = toMediaResourceViewModel(baseMedia, { useCase: "phase_bgm" });

    expect(vm).toMatchObject({
      id: "media-1",
      name: "오프닝 테마",
      typeLabel: "배경음악",
      sourceLabel: "업로드 파일",
      durationLabel: "2:05",
      fileSizeLabel: "1.5MB",
      isExternal: false,
      canPreview: true,
      isSelectable: true,
      unselectableReason: null,
    });
    expect(JSON.stringify(vm)).not.toContain("storage.example.com");
    expect(JSON.stringify(vm)).not.toContain("object-key");
  });

  it("사용 위치에 맞지 않는 리소스는 선택 불가 사유를 제공한다", () => {
    const vm = toMediaResourceViewModel(
      { ...baseMedia, type: "VIDEO", name: "엔딩 영상" },
      { useCase: "phase_bgm" },
    );

    expect(vm.isSelectable).toBe(false);
    expect(vm.unselectableReason).toContain("배경음악만 선택");
  });

  it("유스케이스별 허용 타입을 복사본으로 반환한다", () => {
    const allowed = getAllowedMediaTypesForUseCase("phase_sound_effect");
    allowed.push("BGM");

    expect(getAllowedMediaTypesForUseCase("phase_sound_effect")).toEqual([
      "SFX",
      "VOICE",
    ]);
  });

  it("location_image는 현재 미디어 타입으로 직접 선택하지 않도록 막는다", () => {
    expect(isMediaSelectableForUseCase(baseMedia, "location_image")).toBe(false);
    const vm = toMediaResourceViewModel(baseMedia, { useCase: "location_image" });
    expect(vm.unselectableReason).toContain("이미지 업로드 흐름");
  });

  it("검색어로 이름, 라벨, 태그를 필터링한다", () => {
    const resources = [
      toMediaResourceViewModel(baseMedia),
      toMediaResourceViewModel({
        ...baseMedia,
        id: "media-2",
        name: "문 닫는 소리",
        type: "SFX",
        tags: ["문", "효과"],
      }),
    ];

    expect(filterMediaResourceViewModels(resources, "효과")).toHaveLength(1);
    expect(filterMediaResourceViewModels(resources, "배경음악")).toHaveLength(1);
    expect(filterMediaResourceViewModels(resources, "")).toHaveLength(2);
  });

  it("시간과 파일 크기를 읽기 쉬운 값으로 포맷한다", () => {
    expect(formatMediaDuration(0)).toBeNull();
    expect(formatMediaDuration(65.9)).toBe("1:05");
    expect(formatMediaFileSize(512)).toBe("512B");
    expect(formatMediaFileSize(20_480)).toBe("20KB");
    expect(formatMediaFileSize(1_572_864)).toBe("1.5MB");
    expect(formatMediaFileSize(undefined)).toBeNull();
  });
});
