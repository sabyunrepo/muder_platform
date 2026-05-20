import { describe, expect, it } from "vitest";

import { getMediaPreviewUrl, getMediaThumbnailUrl, hasPublicMediaUrl } from "../mediaVisuals";
import type { MediaResponse } from "@/features/editor/mediaApi";

const imageMedia: MediaResponse = {
  id: "image-1",
  theme_id: "theme-1",
  name: "단서 이미지",
  type: "IMAGE",
  source_type: "FILE",
  tags: [],
  sort_order: 1,
  created_at: "2026-05-20T00:00:00Z",
};

describe("mediaVisuals", () => {
  it("thumbnail은 thumbnail, preview, master, url 순서로 선택한다", () => {
    expect(
      getMediaThumbnailUrl({
        ...imageMedia,
        url: "https://cdn.example/original.webp",
        master_url: "https://cdn.example/master.webp",
        preview_url: "https://cdn.example/preview.webp",
        thumbnail_url: "https://cdn.example/thumb.webp",
      }),
    ).toBe("https://cdn.example/thumb.webp");

    expect(
      getMediaThumbnailUrl({
        ...imageMedia,
        url: "https://cdn.example/original.webp",
        master_url: "https://cdn.example/master.webp",
      }),
    ).toBe("https://cdn.example/master.webp");
  });

  it("preview는 preview, master, url, thumbnail 순서로 선택한다", () => {
    expect(
      getMediaPreviewUrl({
        ...imageMedia,
        url: "https://cdn.example/original.webp",
        master_url: "https://cdn.example/master.webp",
        preview_url: "https://cdn.example/preview.webp",
        thumbnail_url: "https://cdn.example/thumb.webp",
      }),
    ).toBe("https://cdn.example/preview.webp");

    expect(
      getMediaPreviewUrl({
        ...imageMedia,
        thumbnail_url: "https://cdn.example/thumb.webp",
      }),
    ).toBe("https://cdn.example/thumb.webp");
  });

  it("YouTube thumbnail 동작은 기존처럼 YouTube 이미지 URL을 우선한다", () => {
    expect(
      getMediaThumbnailUrl({
        ...imageMedia,
        source_type: "YOUTUBE",
        type: "VIDEO",
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        master_url: "https://cdn.example/master.webp",
      }),
    ).toBe("https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg");
  });

  it("공개 URL 존재 여부는 thumbnail, preview, master, url을 모두 인정한다", () => {
    expect(hasPublicMediaUrl({ ...imageMedia })).toBe(false);
    expect(hasPublicMediaUrl({ ...imageMedia, master_url: "https://cdn.example/master.webp" })).toBe(true);
    expect(hasPublicMediaUrl({ ...imageMedia, thumbnail_url: "https://cdn.example/thumb.webp" })).toBe(true);
  });
});
