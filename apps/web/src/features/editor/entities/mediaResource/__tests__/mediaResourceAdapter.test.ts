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

  it("이미지 필드 유스케이스는 IMAGE 리소스만 선택 가능하게 한다", () => {
    const imageMedia: MediaResponse = {
      ...baseMedia,
      id: "image-1",
      name: "응접실 이미지",
      type: "IMAGE",
      mime_type: "image/png",
    };

    expect(getAllowedMediaTypesForUseCase("location_image")).toEqual(["IMAGE"]);
    expect(getAllowedMediaTypesForUseCase("cover_image")).toEqual(["IMAGE"]);
    expect(getAllowedMediaTypesForUseCase("character_image")).toEqual(["IMAGE"]);
    expect(getAllowedMediaTypesForUseCase("clue_image")).toEqual(["IMAGE"]);
    expect(getAllowedMediaTypesForUseCase("info_image")).toEqual(["IMAGE"]);
    expect(isMediaSelectableForUseCase(imageMedia, "location_image")).toBe(true);
    expect(isMediaSelectableForUseCase(baseMedia, "location_image")).toBe(false);
    const vm = toMediaResourceViewModel(baseMedia, { useCase: "location_image" });
    expect(vm.unselectableReason).toContain("이미지 리소스만 선택");
  });

  it("presentation_background는 IMAGE 리소스만 선택 가능하게 한다", () => {
    const imageMedia: MediaResponse = {
      ...baseMedia,
      id: "image-1",
      name: "응접실 배경",
      type: "IMAGE",
      mime_type: "image/png",
    };

    expect(getAllowedMediaTypesForUseCase("presentation_background")).toEqual(["IMAGE"]);
    expect(isMediaSelectableForUseCase(imageMedia, "presentation_background")).toBe(true);
    expect(isMediaSelectableForUseCase(baseMedia, "presentation_background")).toBe(false);
    expect(toMediaResourceViewModel(imageMedia, { useCase: "presentation_background" })).toMatchObject({
      typeLabel: "이미지",
      isSelectable: true,
    });
  });

  it("연출 cue 유스케이스는 BGM과 VIDEO 타입을 각각 제한한다", () => {
    const videoMedia: MediaResponse = {
      ...baseMedia,
      id: "video-1",
      name: "범인 공개 영상",
      type: "VIDEO",
      mime_type: "video/mp4",
    };

    expect(getAllowedMediaTypesForUseCase("phase_bgm")).toEqual(["BGM"]);
    expect(getAllowedMediaTypesForUseCase("video_action")).toEqual(["VIDEO"]);
    expect(isMediaSelectableForUseCase(baseMedia, "phase_bgm")).toBe(true);
    expect(isMediaSelectableForUseCase(videoMedia, "phase_bgm")).toBe(false);
    expect(isMediaSelectableForUseCase(videoMedia, "video_action")).toBe(true);
    expect(isMediaSelectableForUseCase(baseMedia, "video_action")).toBe(false);
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
    expect(formatMediaFileSize(1_048_064)).toBe("1MB");
    expect(formatMediaFileSize(undefined)).toBeNull();
  });
});
