import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ImageMediaReferenceField } from "../ImageMediaReferenceField";
import type { MediaResponse } from "@/features/editor/mediaApi";

const { useMediaListMock, useMediaDownloadUrlMock } = vi.hoisted(() => ({
  useMediaListMock: vi.fn(),
  useMediaDownloadUrlMock: vi.fn(),
}));

vi.mock("@/features/editor/mediaApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/editor/mediaApi")>();
  return {
    ...actual,
    useMediaList: (...args: unknown[]) => useMediaListMock(...args),
    useMediaDownloadUrl: (...args: unknown[]) => useMediaDownloadUrlMock(...args),
  };
});

vi.mock("../MediaPicker", () => ({
  MediaPicker: ({ open }: { open: boolean }) => (open ? <div>미디어 선택</div> : null),
}));

const imageMedia: MediaResponse = {
  id: "image-1",
  theme_id: "theme-1",
  name: "우산걸이",
  type: "IMAGE",
  source_type: "FILE",
  file_size: 1234,
  mime_type: "image/webp",
  tags: [],
  sort_order: 1,
  created_at: "2026-05-17T00:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  useMediaListMock.mockReturnValue({ data: [imageMedia], isLoading: false, isError: false });
  useMediaDownloadUrlMock.mockReturnValue({
    data: { url: "https://download.example/umbrella.webp", expires_at: "2026-05-17T00:15:00Z" },
    isLoading: false,
    isError: false,
  });
});

afterEach(() => cleanup());

describe("ImageMediaReferenceField", () => {
  it("선택 상태는 이미지 타일 위 overlay group에 교체와 제거를 항상 표시한다", () => {
    const longName = "아주 긴 파일 이름이 레이아웃을 밀어내면 안 되는 단서 이미지 파일.webp";
    useMediaListMock.mockReturnValue({
      data: [{ ...imageMedia, name: longName, preview_url: "https://cdn.example/preview.webp" }],
      isLoading: false,
      isError: false,
    });

    render(
      <ImageMediaReferenceField
        themeId="theme-1"
        label="단서 이미지"
        imageMediaId="image-1"
        onSelect={vi.fn()}
        onClear={vi.fn()}
      />,
    );

    const tile = screen.getByRole("button", { name: "단서 이미지 미리보기" });
    expect(tile.className).toContain("aspect-[16/10]");
    expect(tile.className).toContain("overflow-hidden");
    expect(tile.className).toContain("focus-visible:ring-2");
    expect(tile.parentElement?.className).toBe("relative");
    expect(tile.parentElement?.parentElement?.className).not.toContain("p-3");
    expect(tile.parentElement?.parentElement?.className).not.toContain("border-slate-800");
    expect(screen.getByText("교체").parentElement?.className).toContain("absolute");
    expect(screen.getByRole("button", { name: "단서 이미지 교체" }).className).toContain(
      "focus-visible:ring-2",
    );
    expect(screen.queryByText(longName)).toBeNull();
    expect(screen.getByRole("button", { name: "단서 이미지 제거" }).className).toContain(
      "focus-visible:ring-2",
    );
    expect(useMediaDownloadUrlMock).toHaveBeenCalledWith(undefined);
  });

  it("overlay 제거 버튼은 picker를 열지 않고 onClear만 호출한다", () => {
    const onClear = vi.fn();

    render(
      <ImageMediaReferenceField
        themeId="theme-1"
        label="단서 이미지"
        imageMediaId="image-1"
        onSelect={vi.fn()}
        onClear={onClear}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "단서 이미지 제거" }));

    expect(onClear).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("미디어 선택")).toBeNull();
  });

  it("disabled 선택 상태는 overlay action을 숨기고 picker를 열지 않는다", () => {
    render(
      <ImageMediaReferenceField
        themeId="theme-1"
        label="단서 이미지"
        imageMediaId="image-1"
        disabled
        onSelect={vi.fn()}
        onClear={vi.fn()}
      />,
    );

    const tile = screen.getByRole("button", { name: "단서 이미지 미리보기" });
    expect(tile).toHaveProperty("disabled", true);
    expect(tile.className).toContain("focus-visible:ring-2");
    expect(screen.queryByRole("button", { name: "단서 이미지 교체" })).toBeNull();
    expect(screen.queryByRole("button", { name: "단서 이미지 제거" })).toBeNull();

    fireEvent.click(tile);

    expect(screen.queryByText("미디어 선택")).toBeNull();
  });

  it("공개 master_url이 있으면 다운로드 URL 없이 선택 이미지 프리뷰를 보여준다", () => {
    useMediaListMock.mockReturnValue({
      data: [{ ...imageMedia, master_url: "https://cdn.example/master.webp" }],
      isLoading: false,
      isError: false,
    });

    render(
      <ImageMediaReferenceField
        themeId="theme-1"
        label="단서 이미지"
        imageMediaId="image-1"
        onSelect={vi.fn()}
        onClear={vi.fn()}
      />,
    );

    const preview = screen.getByAltText("우산걸이 미리보기") as HTMLImageElement;
    expect(preview.getAttribute("src")).toBe("https://cdn.example/master.webp");
    expect(useMediaDownloadUrlMock).toHaveBeenCalledWith(undefined);
    expect(useMediaDownloadUrlMock).not.toHaveBeenCalledWith("image-1");
  });

  it("선택된 FILE 이미지는 다운로드 URL로 프리뷰를 보여준다", () => {
    render(
      <ImageMediaReferenceField
        themeId="theme-1"
        label="단서 이미지"
        imageMediaId="image-1"
        onSelect={vi.fn()}
        onClear={vi.fn()}
      />,
    );

    expect(useMediaListMock).toHaveBeenCalledWith("theme-1", "IMAGE");
    expect(useMediaDownloadUrlMock).toHaveBeenCalledWith("image-1");

    const preview = screen.getByAltText("우산걸이 미리보기") as HTMLImageElement;
    expect(preview.getAttribute("src")).toBe("https://download.example/umbrella.webp");
  });

  it("프리뷰 로드가 실패하면 이미지 아이콘 fallback으로 돌아간다", () => {
    render(
      <ImageMediaReferenceField
        themeId="theme-1"
        label="단서 이미지"
        imageMediaId="image-1"
        onSelect={vi.fn()}
        onClear={vi.fn()}
      />,
    );

    fireEvent.error(screen.getByAltText("우산걸이 미리보기"));

    screen.getByLabelText("이미지");
    expect(screen.queryByAltText("우산걸이 미리보기")).toBeNull();
  });
});
