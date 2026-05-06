import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MediaCard } from "../MediaCard";
import type { MediaResponse } from "@/features/editor/mediaApi";

const baseMedia: MediaResponse = {
  id: "media-1",
  theme_id: "theme-1",
  name: "오프닝 BGM",
  type: "BGM",
  source_type: "FILE",
  url: "https://example.com/bgm.mp3",
  duration: 125,
  file_size: 1234567,
  mime_type: "audio/mpeg",
  tags: [],
  sort_order: 1,
  created_at: "2026-04-05T00:00:00Z",
};

afterEach(() => cleanup());

function renderCard(media: MediaResponse, options: Partial<React.ComponentProps<typeof MediaCard>> = {}) {
  return render(
    <MediaCard
      media={media}
      selected={false}
      onClick={vi.fn()}
      isPreviewPlaying={false}
      onPreviewToggle={vi.fn()}
      {...options}
    />,
  );
}

describe("MediaCard", () => {
  it("이미지는 실제 preview를 보여주고 로드 실패 시 이미지 fallback 아이콘으로 전환한다", () => {
    renderCard({
      ...baseMedia,
      id: "image-1",
      name: "단서 사진",
      type: "IMAGE",
      url: "https://example.com/clue.webp",
      mime_type: "image/webp",
    });

    const image = document.querySelector("img") as HTMLImageElement;
    expect(image).not.toBeNull();
    expect(image.getAttribute("src")).toBe("https://example.com/clue.webp");

    fireEvent.error(image);
    expect(screen.getByLabelText("이미지")).toBeDefined();
  });

  it("영상과 문서는 깨진 이미지 없이 타입별 fallback 아이콘을 표시한다", () => {
    const { rerender } = renderCard({
      ...baseMedia,
      id: "video-1",
      name: "엔딩 영상",
      type: "VIDEO",
      url: "https://example.com/ending.mp4",
      mime_type: "video/mp4",
    });

    expect(screen.getByLabelText("영상")).toBeDefined();
    expect(screen.queryByRole("button", { name: "프리뷰 재생" })).toBeNull();

    rerender(
      <MediaCard
        media={{
          ...baseMedia,
          id: "doc-1",
          name: "역할지 PDF",
          type: "DOCUMENT",
          url: "https://example.com/role.pdf",
          mime_type: "application/pdf",
        }}
        selected={false}
        onClick={vi.fn()}
        isPreviewPlaying={false}
        onPreviewToggle={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("문서")).toBeDefined();
    expect(screen.queryByRole("button", { name: "프리뷰 재생" })).toBeNull();
  });

  it("오디오 타입만 프리뷰 재생 버튼을 제공한다", () => {
    const onPreviewToggle = vi.fn();
    renderCard(baseMedia, { onPreviewToggle });

    const playButton = screen.getByRole("button", { name: "프리뷰 재생" });
    fireEvent.click(playButton);

    expect(onPreviewToggle).toHaveBeenCalledTimes(1);
    expect(screen.getByText("배경음악")).toBeDefined();
    expect(screen.getByText("2:05")).toBeDefined();
  });
});
