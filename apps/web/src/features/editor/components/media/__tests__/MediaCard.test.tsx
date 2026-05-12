import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MediaCard } from "../MediaCard";
import type { MediaResponse } from "@/features/editor/mediaApi";

const { useMediaDownloadUrlMock } = vi.hoisted(() => ({
  useMediaDownloadUrlMock: vi.fn(),
}));

vi.mock("@/features/editor/mediaApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/editor/mediaApi")>();
  return {
    ...actual,
    useMediaDownloadUrl: (mediaId?: string) => useMediaDownloadUrlMock(mediaId),
  };
});

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

beforeEach(() => {
  vi.clearAllMocks();
  useMediaDownloadUrlMock.mockReturnValue({ data: undefined, isLoading: false, isError: false });
});

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
    expect(image.className).toContain("object-contain");
    expect(image.parentElement?.className).toContain("aspect-square");
    expect(image.parentElement?.className).toContain("w-24");

    fireEvent.error(image);
    expect(screen.getByLabelText("이미지")).toBeDefined();
  });

  it("업로드 이미지는 임시 다운로드 URL로 preview를 보여준다", () => {
    useMediaDownloadUrlMock.mockReturnValue({
      data: { url: "https://download.example/clue.webp", expires_at: "2026-05-12T00:15:00Z" },
      isLoading: false,
      isError: false,
    });

    renderCard({
      ...baseMedia,
      id: "image-private-1",
      name: "보관함 단서 사진",
      type: "IMAGE",
      url: undefined,
      mime_type: "image/webp",
    });

    expect(useMediaDownloadUrlMock).toHaveBeenCalledWith("image-private-1");

    const image = document.querySelector("img") as HTMLImageElement;
    expect(image).not.toBeNull();
    expect(image.getAttribute("src")).toBe("https://download.example/clue.webp");
    expect(image.className).toContain("object-contain");
  });

  it("비이미지 미디어는 같은 프리뷰 face 안에 타입별 아이콘을 표시한다", () => {
    const { rerender } = renderCard({
      ...baseMedia,
      id: "video-1",
      name: "엔딩 영상",
      type: "VIDEO",
      url: "https://example.com/ending.mp4",
      mime_type: "video/mp4",
    });

    expect(screen.getByTestId("media-preview-face")).toBeDefined();
    expect(screen.getByTestId("media-preview-face").parentElement?.className).toContain("aspect-square");
    expect(screen.getByTestId("media-preview-face").parentElement?.className).toContain("w-24");
    expect(screen.getByLabelText("영상")).toBeDefined();
    expect(screen.getAllByText("영상").length).toBeGreaterThan(0);
    expect(document.querySelector("img")).toBeNull();
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

    expect(screen.getByTestId("media-preview-face")).toBeDefined();
    expect(screen.getByLabelText("문서")).toBeDefined();
    expect(screen.getAllByText("문서").length).toBeGreaterThan(0);
    expect(document.querySelector("img")).toBeNull();
    expect(screen.queryByRole("button", { name: "프리뷰 재생" })).toBeNull();
  });

  it("오디오 타입만 프리뷰 재생 버튼을 제공한다", () => {
    const onPreviewToggle = vi.fn();
    renderCard(baseMedia, { onPreviewToggle });

    const playButton = screen.getByRole("button", { name: "프리뷰 재생" });
    fireEvent.click(playButton);

    expect(onPreviewToggle).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText("배경음악").length).toBeGreaterThan(0);
    expect(screen.getByText("2:05")).toBeDefined();
  });
});
