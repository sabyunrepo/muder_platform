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
    expect(image.parentElement?.className).toContain("h-full");
    expect(image.parentElement?.className).toContain("w-full");
    expect(screen.getByRole("button", { name: /단서 사진/ }).className).toContain("h-56");

    fireEvent.error(image);
    expect(screen.getByLabelText("이미지")).toBeDefined();
  });

  it("최적화된 thumbnail_url이 있으면 원본 url보다 먼저 사용한다", () => {
    renderCard({
      ...baseMedia,
      id: "image-optimized-1",
      name: "최적화 단서 사진",
      type: "IMAGE",
      url: "https://example.com/original.webp",
      preview_url: "https://example.com/preview.webp",
      thumbnail_url: "https://example.com/thumbnail.webp",
      mime_type: "image/webp",
    });

    const image = document.querySelector("img") as HTMLImageElement;
    expect(image).not.toBeNull();
    expect(image.getAttribute("src")).toBe("https://example.com/thumbnail.webp");
    expect(useMediaDownloadUrlMock).toHaveBeenCalledWith(undefined);
    expect(useMediaDownloadUrlMock).not.toHaveBeenCalledWith("image-optimized-1");
  });

  it("master_url만 있는 이미지는 다운로드 fallback 없이 master 이미지를 사용한다", () => {
    renderCard({
      ...baseMedia,
      id: "image-master-1",
      name: "마스터 단서 사진",
      type: "IMAGE",
      url: undefined,
      master_url: "https://example.com/master.webp",
      mime_type: "image/webp",
    });

    const image = document.querySelector("img") as HTMLImageElement;
    expect(image).not.toBeNull();
    expect(image.getAttribute("src")).toBe("https://example.com/master.webp");
    expect(useMediaDownloadUrlMock).toHaveBeenCalledWith(undefined);
    expect(useMediaDownloadUrlMock).not.toHaveBeenCalledWith("image-master-1");
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
    expect(screen.getByTestId("media-preview-face").parentElement?.className).toContain("h-full");
    expect(screen.getByTestId("media-preview-face").parentElement?.className).toContain("w-full");
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

  it("선택 상태는 editor list item 토큰 클래스를 사용한다", () => {
    renderCard(baseMedia, { selected: true });

    const card = screen.getByRole("button", { name: /오프닝 BGM/ });
    expect(card.className).toContain("mmp-editor-list-item");
    expect(card.className).toContain("mmp-editor-list-item-active");
  });

  it("긴 이름과 긴 태그도 고정 카드/하단 gradient overlay 안에 제한한다", () => {
    renderCard({
      ...baseMedia,
      name: "매우 긴 미디어 이름이 여러 줄로 들어와도 카드 전체 높이를 바꾸면 안 됩니다",
      tags: ["긴태그".repeat(12), "두번째태그".repeat(8), "세번째태그".repeat(8), "숨겨질태그"],
    });

    const card = screen.getByRole("button", { name: /매우 긴 미디어 이름/ });
    expect(card.className).toContain("h-56");
    expect(card.className).toContain("min-w-0");
    expect(screen.getByText(/매우 긴 미디어 이름/).className).toContain("line-clamp-2");
    expect(screen.getByText(/긴태그/).className).toContain("truncate");
    expect(screen.getByText(/긴태그/).parentElement?.className).toContain("bg-gradient-to-t");
  });
});
